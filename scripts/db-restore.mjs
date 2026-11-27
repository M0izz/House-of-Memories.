// ============================================================================
// House of Memories — PostgreSQL Database Restore Tool (Disaster Recovery)
// Checksum Verified, AES-256-GCM Decrypted, Test-DB Safe Restore
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { deriveKey, APPLICATION_TABLES } from "./db-backup.mjs";

const BACKUP_DIR = path.join(process.cwd(), ".data", "db-backups");

/**
 * Decrypts AES-256-GCM payload.
 */
export function decryptPayload(encryptedObject, passphrase) {
  const salt = Buffer.from(encryptedObject.salt, "hex");
  const iv = Buffer.from(encryptedObject.iv, "hex");
  const tag = Buffer.from(encryptedObject.tag, "hex");
  const key = deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedObject.ciphertext, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

/**
 * Finds the latest encrypted backup in BACKUP_DIR.
 */
export function getLatestBackup(dir = BACKUP_DIR) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith("hom_pg_backup_") && f.endsWith(".enc"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return files.length > 0 ? files[0] : null;
}

/**
 * Verifies backup file against its SHA-256 manifest.
 */
export function verifyBackupIntegrity(backupFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }

  const manifestPath = `${backupFilePath.replace(/\.enc$/, "")}.manifest.json`;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Integrity manifest missing for backup: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const rawContent = fs.readFileSync(backupFilePath);
  const calculatedSha256 = crypto.createHash("sha256").update(rawContent).digest("hex");

  if (calculatedSha256.toLowerCase() !== manifest.sha256Checksum.toLowerCase()) {
    throw new Error(
      `CRITICAL INTEGRITY ERROR: SHA-256 mismatch for ${backupFilePath}!\n` +
      `Expected: ${manifest.sha256Checksum}\n` +
      `Calculated: ${calculatedSha256}`
    );
  }

  return {
    valid: true,
    fileSizeBytes: rawContent.length,
    sha256: calculatedSha256,
    manifest,
  };
}

/**
 * Restores database metadata from verified, decrypted backup.
 */
export async function restoreDatabase(options = {}) {
  const {
    backupPath = getLatestBackup(options.backupDir || BACKUP_DIR),
    passphrase = process.env.HOM_BACKUP_ENCRYPTION_KEY || "house-of-memories-secure-dr-key-2027",
    verifyOnly = false,
    confirmProductionOverwrite = false,
    targetSupabaseUrl = null,
    targetServiceKey = null,
    customStore = null, // Mock DB for isolated test environments
  } = options;

  console.log("============================================================");
  console.log("📥 House of Memories — Database Restore & Decryption");
  console.log("============================================================\n");

  if (!backupPath) {
    throw new Error("No backup file provided or found in directory.");
  }

  console.log(`Checking encrypted backup: ${backupPath}`);
  const integrity = verifyBackupIntegrity(backupPath);
  console.log(`✓ Integrity verified! SHA-256: ${integrity.sha256}`);
  console.log(`✓ File size: ${integrity.fileSizeBytes} bytes`);
  console.log(`✓ Export timestamp: ${integrity.manifest.exportedAt}`);
  console.log(`✓ Algorithm: ${integrity.manifest.algorithm}`);

  // Decrypt payload
  const encryptedObject = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const decryptedJson = decryptPayload(encryptedObject, passphrase);
  const parsedDoc = JSON.parse(decryptedJson);

  console.log(`✓ Decrypted successfully! Engine: ${parsedDoc.engine}, Version: ${parsedDoc.version}`);
  console.log(`✓ Schema migrations included: ${parsedDoc.schema?.migrationCount || 0}`);

  if (verifyOnly) {
    console.log("\n[VERIFY ONLY] Backup integrity and decryption verified successfully. Skipping restoration.");
    return {
      verified: true,
      backupPath,
      manifest: integrity.manifest,
      tablesIncluded: Object.keys(parsedDoc.tables || {}),
    };
  }

  // Safety checks
  const isTargetingProduction = !targetSupabaseUrl && !customStore;
  if (isTargetingProduction && !confirmProductionOverwrite) {
    throw new Error(
      "SAFETY VIOLATION: Refusing to overwrite production database without explicit confirmation. " +
      "Pass --confirm-production-overwrite or specify a test database via --target-db."
    );
  }

  if (customStore) {
    // Restore into mock test store
    for (const [table, rows] of Object.entries(parsedDoc.tables || {})) {
      customStore[table] = rows;
    }
    console.log(`✓ Restored into isolated test store: ${Object.keys(parsedDoc.tables).length} tables.`);
    return { restored: true, target: "test-store", tables: parsedDoc.tables };
  }

  const supabaseUrl = targetSupabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = targetServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("placeholder")) {
    throw new Error("Supabase credentials missing for restore target.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Restore in foreign-key dependency order
  for (const table of APPLICATION_TABLES) {
    const rows = parsedDoc.tables[table] || [];
    if (rows.length === 0) continue;

    console.log(`Restoring ${rows.length} rows to ${table}...`);
    const { error } = await supabase.from(table).upsert(rows);
    if (error) {
      throw new Error(`Failed to restore table ${table}: ${error.message}`);
    }
  }

  console.log("\n🎉 Database restoration completed successfully.");
  return {
    restored: true,
    target: supabaseUrl,
    tablesRestored: Object.keys(parsedDoc.tables || {}),
  };
}

if (process.argv[1] && process.argv[1].endsWith("db-restore.mjs")) {
  const args = process.argv.slice(2);
  let backupFile = null;
  let verifyOnly = false;
  let confirmOverwrite = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--backup" && args[i + 1]) {
      backupFile = args[i + 1];
      i++;
    } else if (args[i] === "--verify-only") {
      verifyOnly = true;
    } else if (args[i] === "--confirm-production-overwrite") {
      confirmOverwrite = true;
    }
  }

  restoreDatabase({
    backupPath: backupFile,
    verifyOnly,
    confirmProductionOverwrite: confirmOverwrite,
  }).catch((err) => {
    console.error("Restore failed:", err.message);
    process.exit(1);
  });
}
