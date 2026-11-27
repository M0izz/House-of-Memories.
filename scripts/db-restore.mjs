// ============================================================================
// House of Memories — Database Metadata Restore Tool (Disaster Recovery)
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const BACKUP_DIR = path.join(process.cwd(), ".data", "db-backups");

/**
 * Finds the most recent backup in BACKUP_DIR.
 */
export function getLatestBackup(dir = BACKUP_DIR) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith("hom_db_export_") && f.endsWith(".json") && !f.endsWith(".manifest.json"))
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

  const manifestPath = `${backupFilePath}.manifest.json`;
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
 * Restores database metadata from verified backup.
 */
export async function restoreDatabaseMetadata(options = {}) {
  const backupPath = options.backupPath || getLatestBackup(options.backupDir || BACKUP_DIR);
  const verifyOnly = options.verifyOnly || false;
  const targetFile = options.targetFile || path.join(process.cwd(), ".data", "albums-store.json");

  console.log("============================================================");
  console.log("📥 House of Memories — Database Metadata Restore");
  console.log("============================================================\n");

  if (!backupPath) {
    throw new Error(`No backup file provided or found in directory.`);
  }

  console.log(`Checking backup: ${backupPath}`);
  const integrity = verifyBackupIntegrity(backupPath);
  console.log(`✓ Integrity verified! SHA-256: ${integrity.sha256}`);
  console.log(`✓ File size: ${integrity.fileSizeBytes} bytes`);
  console.log(`✓ Export timestamp: ${integrity.manifest.exportedAt}`);

  if (verifyOnly) {
    console.log("\n[VERIFY ONLY] Skipping data restoration.");
    return { verified: true, backupPath, integrity };
  }

  const parsedDoc = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  if (!parsedDoc.tables) {
    throw new Error("Invalid backup document format: missing 'tables' root key.");
  }

  const targetDir = path.dirname(targetFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Atomically write restored database
  const tempTarget = `${targetFile}.tmp-${Date.now()}`;
  fs.writeFileSync(tempTarget, JSON.stringify(parsedDoc.tables, null, 2), "utf-8");
  fs.renameSync(tempTarget, targetFile);

  const tableSummary = Object.entries(parsedDoc.tables).map(([tbl, rows]) => {
    return `  - ${tbl}: ${Array.isArray(rows) ? rows.length : 'object'} records`;
  }).join("\n");

  console.log(`\n✓ Restored data to: ${targetFile}`);
  console.log(`Restored Tables:\n${tableSummary}`);
  console.log("\n🎉 Database restoration completed successfully.");

  return {
    restored: true,
    targetFile,
    tables: parsedDoc.tables,
    manifest: integrity.manifest,
  };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith("db-restore.mjs")) {
  const args = process.argv.slice(2);
  let backupFile = null;
  let verifyOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--backup" && args[i + 1]) {
      backupFile = args[i + 1];
      i++;
    } else if (args[i] === "--verify-only") {
      verifyOnly = true;
    }
  }

  restoreDatabaseMetadata({ backupPath: backupFile, verifyOnly }).catch((err) => {
    console.error("❌ Restore failed:", err.message);
    process.exit(1);
  });
}
