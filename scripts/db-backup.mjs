// ============================================================================
// House of Memories — Database Metadata Export Tool (Disaster Recovery)
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const BACKUP_DIR = path.join(process.cwd(), ".data", "db-backups");

export async function exportDatabaseMetadata(customDir = BACKUP_DIR) {
  console.log("============================================================");
  console.log("🗄️  House of Memories — Database Metadata Export");
  console.log("============================================================\n");

  if (!fs.existsSync(customDir)) {
    fs.mkdirSync(customDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `hom_db_export_${timestamp}.json`;
  const exportPath = path.join(customDir, filename);

  // Read local/Supabase database tables
  let dataPayload = {};
  const localStoreFile = path.join(process.cwd(), ".data", "albums-store.json");
  if (fs.existsSync(localStoreFile)) {
    dataPayload = JSON.parse(fs.readFileSync(localStoreFile, "utf-8"));
  } else {
    dataPayload = {
      albums: [],
      albumMemories: [],
      memories: [],
      mediaAssets: [],
      mediaReplicas: [],
    };
  }

  const exportDocument = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    source: process.env.NEXT_PUBLIC_SUPABASE_URL || "local-development",
    tables: dataPayload,
  };

  const rawJson = JSON.stringify(exportDocument, null, 2);
  const sha256 = crypto.createHash("sha256").update(rawJson).digest("hex");

  fs.writeFileSync(exportPath, rawJson, "utf-8");

  // Write integrity manifest
  const manifestPath = `${exportPath}.manifest.json`;
  const manifest = {
    backupFile: filename,
    fileSizeBytes: Buffer.byteLength(rawJson),
    sha256Checksum: sha256,
    exportedAt: exportDocument.exportedAt,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`✓ Export completed: ${exportPath}`);
  console.log(`✓ Manifest created: ${manifestPath}`);
  console.log(`✓ Checksum (SHA-256): ${sha256}\n`);

  return { exportPath, manifestPath, sha256 };
}

if (process.argv[1] && process.argv[1].endsWith("db-backup.mjs")) {
  exportDatabaseMetadata().catch(console.error);
}
