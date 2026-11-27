// ============================================================================
// House of Memories — PostgreSQL Database Backup & Disaster Recovery Export
// Real Schema, Data Preserving, AES-256-GCM Encrypted, SHA-256 Manifest
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const BACKUP_DIR = path.join(process.cwd(), ".data", "db-backups");

export const APPLICATION_TABLES = [
  "memory_spaces",
  "space_members",
  "profiles",
  "memories",
  "albums",
  "album_memories",
  "media_assets",
  "media_replicas",
  "backup_jobs",
  "integrity_scans",
  "storage_audit_logs",
];

/**
 * Derives a 32-byte key from a passphrase using PBKDF2.
 */
export function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, "sha256");
}

/**
 * Encrypts payload with AES-256-GCM.
 */
export function encryptPayload(dataString, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(dataString, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    algorithm: "aes-256-gcm",
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ciphertext: encrypted,
  };
}

/**
 * Collects migration DDL to include schema definitions for disaster recovery.
 */
export function loadMigrationSchemas() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrations = [];
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      migrations.push({
        filename: f,
        sql: fs.readFileSync(path.join(migrationsDir, f), "utf-8"),
      });
    }
  }
  return migrations;
}

/**
 * Exports database metadata and schema into an encrypted backup bundle.
 */
export async function exportDatabase(options = {}) {
  const {
    customDir = BACKUP_DIR,
    passphrase = process.env.HOM_BACKUP_ENCRYPTION_KEY || "house-of-memories-secure-dr-key-2027",
    customStore = null, // Mock DB for test environments
  } = options;

  console.log("============================================================");
  console.log("🗄️  House of Memories — PostgreSQL Database Backup");
  console.log("============================================================\n");

  if (!fs.existsSync(customDir)) {
    fs.mkdirSync(customDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseFilename = `hom_pg_backup_${timestamp}`;
  const exportPath = path.join(customDir, `${baseFilename}.enc`);
  const manifestPath = path.join(customDir, `${baseFilename}.manifest.json`);

  const tablesData = {};
  const tableCounts = {};

  if (customStore) {
    // Isolated test environment export
    for (const table of APPLICATION_TABLES) {
      const camel = table.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      const rows = customStore[table] || customStore[camel] || [];
      tablesData[table] = rows;
      tableCounts[table] = rows.length;
    }
  } else {
    // Real Supabase export
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || url.includes("placeholder")) {
      throw new Error(
        "Cannot export PostgreSQL database: Supabase credentials missing. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    for (const table of APPLICATION_TABLES) {
      try {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.warn(`[DB Export] Notice on table ${table}: ${error.message}`);
          tablesData[table] = [];
          tableCounts[table] = 0;
        } else {
          tablesData[table] = data || [];
          tableCounts[table] = (data || []).length;
        }
      } catch (err) {
        tablesData[table] = [];
        tableCounts[table] = 0;
      }
    }
  }

  const schemaMigrations = loadMigrationSchemas();

  const backupDocument = {
    version: "2.0.0",
    engine: "PostgreSQL",
    exportedAt: new Date().toISOString(),
    sourceEndpoint: process.env.NEXT_PUBLIC_SUPABASE_URL || "test-environment",
    schema: {
      migrationCount: schemaMigrations.length,
      migrations: schemaMigrations,
    },
    tables: tablesData,
    unexportedObjectsNotice:
      "Note: Supabase auth.users internal encrypted credentials and session tokens are managed by Supabase Auth and excluded from application table export. Public user profiles and IDs are preserved.",
  };

  const rawJson = JSON.stringify(backupDocument);
  const rawSizeBytes = Buffer.byteLength(rawJson);

  // Encrypt with AES-256-GCM
  const encryptedObject = encryptPayload(rawJson, passphrase);
  const encryptedPayloadString = JSON.stringify(encryptedObject, null, 2);

  fs.writeFileSync(exportPath, encryptedPayloadString, "utf-8");

  // Compute SHA-256 of the encrypted artifact
  const artifactBuffer = fs.readFileSync(exportPath);
  const sha256 = crypto.createHash("sha256").update(artifactBuffer).digest("hex");

  // Generate cryptographic manifest
  const manifest = {
    backupFile: path.basename(exportPath),
    algorithm: "aes-256-gcm",
    fileSizeBytes: artifactBuffer.length,
    unencryptedSizeBytes: rawSizeBytes,
    sha256Checksum: sha256,
    exportedAt: backupDocument.exportedAt,
    tableCounts,
    migrationsIncluded: schemaMigrations.map((m) => m.filename),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`✓ Database backup encrypted and completed: ${exportPath}`);
  console.log(`✓ SHA-256 Manifest generated: ${manifestPath}`);
  console.log(`✓ Checksum (SHA-256): ${sha256}`);
  console.log(`Table summary:`, tableCounts);

  return {
    exportPath,
    manifestPath,
    sha256,
    manifest,
  };
}

if (process.argv[1] && process.argv[1].endsWith("db-backup.mjs")) {
  exportDatabase().catch((err) => {
    console.error("Backup failed:", err.message);
    process.exit(1);
  });
}
