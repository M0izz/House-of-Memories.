// ============================================================================
// House of Memories — Idempotent Media Archive Migration CLI
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), ".data", "albums-store.json");
const MIGRATION_MANIFESTS_DIR = path.join(process.cwd(), ".data", "migrations");

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  };
  return map[ext] || "application/octet-stream";
}

function loadStore() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      albums: [],
      albumMemories: [],
      memories: [],
      mediaAssets: [],
      mediaReplicas: [],
      backupJobs: [],
      integrityScans: [],
    };
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  data.mediaAssets = data.mediaAssets || [];
  data.mediaReplicas = data.mediaReplicas || [];
  data.backupJobs = data.backupJobs || [];
  return data;
}

function saveStore(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DATA_FILE);
}

function scanLocalFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

export async function runMigration(options = {}) {
  const {
    sourceDir,
    dryRun = false,
    resume = true,
    batchSize = 20,
    verifyOnly = false,
    spaceId = "00000000-0000-0000-0000-000000000001",
    userId = "00000000-0000-0000-0000-000000000001",
  } = options;

  console.log("============================================================");
  console.log("🚀 House of Memories — Media Archive Migration CLI");
  console.log("============================================================\n");
  console.log(`Source directory: ${sourceDir}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN (no files will be written)" : verifyOnly ? "VERIFY ONLY" : "MIGRATE & UPLOAD"}`);
  console.log(`Resume mode: ${resume ? "Enabled (skipping existing checksums)" : "Disabled"}\n`);

  if (!sourceDir || !fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  const allFiles = scanLocalFiles(sourceDir);
  console.log(`Discovered ${allFiles.length} files in source.`);

  const store = loadStore();
  const existingChecksums = new Map(store.mediaAssets.map((a) => [a.sha256_checksum?.toLowerCase(), a]));

  const inventory = [];
  const duplicates = [];
  let totalBytes = 0;

  console.log("Generating SHA-256 inventory...");
  for (const filePath of allFiles) {
    const stat = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const mimeType = getMimeType(filePath);

    totalBytes += stat.size;

    if (existingChecksums.has(checksum)) {
      duplicates.push({
        filePath,
        checksum,
        existingAssetId: existingChecksums.get(checksum).id,
      });
    } else {
      inventory.push({
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: stat.size,
        mimeType,
        checksum,
        buffer,
      });
    }
  }

  console.log(`✓ Inventory analyzed:`);
  console.log(`  - Total files: ${allFiles.length}`);
  console.log(`  - Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - Unique new files: ${inventory.length}`);
  console.log(`  - Existing / Duplicates: ${duplicates.length}\n`);

  if (dryRun) {
    console.log("[DRY-RUN COMPLETE] No changes made.");
    return {
      dryRun: true,
      totalFiles: allFiles.length,
      newFiles: inventory.length,
      duplicates: duplicates.length,
      totalBytes,
    };
  }

  // Upload to primary storage
  const primaryStorageDir = path.join(process.cwd(), ".data", "media-storage");
  if (!fs.existsSync(primaryStorageDir)) {
    fs.mkdirSync(primaryStorageDir, { recursive: true });
  }

  let uploadedCount = 0;
  let batchIndex = 0;

  for (let i = 0; i < inventory.length; i += batchSize) {
    batchIndex++;
    const batch = inventory.slice(i, i + batchSize);
    console.log(`Processing Batch ${batchIndex} (${batch.length} files)...`);

    for (const item of batch) {
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const primaryKey = `${spaceId}/${assetId}/${item.fileName}`;
      const destPath = path.join(primaryStorageDir, primaryKey);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      // Write to primary
      fs.writeFileSync(destPath, item.buffer);

      // Verify destination checksum
      const destBuf = fs.readFileSync(destPath);
      const destChecksum = crypto.createHash("sha256").update(destBuf).digest("hex");
      if (destChecksum.toLowerCase() !== item.checksum.toLowerCase()) {
        fs.unlinkSync(destPath);
        throw new Error(`Integrity error during migration for ${item.fileName}! Checksums do not match.`);
      }

      // Record in store
      const assetRecord = {
        id: assetId,
        space_id: spaceId,
        uploader_id: userId,
        original_filename: item.fileName,
        mime_type: item.mimeType,
        size_bytes: item.sizeBytes,
        sha256_checksum: item.checksum,
        primary_provider: "minio_oci",
        primary_key: primaryKey,
        backup_status: "backup_pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.mediaAssets.push(assetRecord);

      // Queue backup job for secondary replica
      store.backupJobs.push({
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        media_asset_id: assetId,
        target_provider: "cloudflare_r2",
        status: "pending",
        attempts: 0,
        created_at: new Date().toISOString(),
      });

      uploadedCount++;
    }

    saveStore(store);
  }

  // Create migration manifest
  if (!fs.existsSync(MIGRATION_MANIFESTS_DIR)) {
    fs.mkdirSync(MIGRATION_MANIFESTS_DIR, { recursive: true });
  }

  const manifestId = `migration_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const manifestPath = path.join(MIGRATION_MANIFESTS_DIR, manifestId);
  const manifestData = {
    manifestId,
    timestamp: new Date().toISOString(),
    sourceDir,
    totalFiles: allFiles.length,
    uploadedCount,
    duplicatesSkipped: duplicates.length,
    totalBytesMigrated: inventory.reduce((sum, item) => sum + item.sizeBytes, 0),
    status: "completed",
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  console.log(`\n✓ Migration completed successfully!`);
  console.log(`✓ Migration manifest saved: ${manifestPath}`);

  return manifestData;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith("migrate-archive.mjs")) {
  const args = process.argv.slice(2);
  let sourceDir = null;
  let dryRun = false;
  let resume = true;
  let batchSize = 20;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--no-resume") {
      resume = false;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!sourceDir) {
    console.error("Usage: node scripts/migrate-archive.mjs --source <dir> [--dry-run] [--batch-size 20]");
    process.exit(1);
  }

  runMigration({ sourceDir, dryRun, resume, batchSize }).catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
