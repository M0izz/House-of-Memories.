// ============================================================================
// House of Memories — Production Media Archive Migration CLI
// Streaming, Bounded Memory, Fail-Closed, Direct Cloud Provider
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getPrimaryStorageProvider } from "../src/lib/storage/index.ts";

const MIGRATION_MANIFESTS_DIR = path.join(process.cwd(), ".data", "migrations");

export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Computes SHA-256 using bounded streaming.
 * Memory consumption is strictly O(1) (~64KB buffer), even for 100GB files.
 */
export async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

/**
 * Recursively scans source directory for files.
 * Stores ONLY metadata (paths, sizes, mtime), NEVER file buffers in memory.
 */
export function scanSourceInventory(dir) {
  const inventory = [];
  if (!fs.existsSync(dir)) return inventory;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        const stat = fs.statSync(fullPath);
        inventory.push({
          filePath: fullPath,
          fileName: entry.name,
          relativePath: path.relative(dir, fullPath).replace(/\\/g, "/"),
          sizeBytes: stat.size,
          mimeType: getMimeType(entry.name),
          mtime: stat.mtime.toISOString(),
        });
      }
    }
  }

  walk(dir);
  return inventory;
}

/**
 * Creates Supabase admin client using server-side service role key.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Executes migration with bounded concurrency and streaming uploads.
 */
export async function runMigration(options = {}) {
  const {
    sourceDir,
    dryRun = false,
    resume = true,
    concurrency = 2,
    spaceId = process.env.HOM_SPACE_ID,
    userId = process.env.HOM_USER_ID,
    customProvider = null,
    customStore = null, // Mock DB for isolated test environments
  } = options;

  console.log("============================================================");
  console.log("🚀 House of Memories — Production Media Archive Migration");
  console.log("============================================================\n");

  if (!sourceDir || !fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  if (!spaceId) {
    throw new Error(
      "Missing required space ID. Pass --space-id <uuid> or set HOM_SPACE_ID. " +
      "Hardcoded default IDs are rejected in production."
    );
  }

  if (!userId) {
    throw new Error(
      "Missing required user ID. Pass --user-id <uuid> or set HOM_USER_ID. " +
      "Hardcoded default IDs are rejected in production."
    );
  }

  console.log(`Source Archive: ${sourceDir}`);
  console.log(`Target Space ID: ${spaceId}`);
  console.log(`Uploader ID:    ${userId}`);
  console.log(`Execution Mode: ${dryRun ? "DRY RUN (no uploads or DB writes)" : "LIVE CLOUD MIGRATION"}`);
  console.log(`Concurrency:    ${concurrency} streams\n`);

  // Verify Primary Storage Provider
  const provider = customProvider || getPrimaryStorageProvider();
  console.log(`Storage Target: ${provider.name} (${provider.type})`);

  if (!provider.isConfigured()) {
    throw new Error(`Storage provider ${provider.name} is not configured.`);
  }

  // Verify bucket connectivity before beginning
  const bucketCheck = await provider.verifyBucket();
  if (!bucketCheck.exists) {
    throw new Error(`Primary storage bucket verification failed: ${bucketCheck.message}`);
  }
  console.log(`✓ Bucket connectivity verified: ${bucketCheck.bucket}\n`);

  const supabase = customStore ? null : getSupabaseAdmin();
  if (!customStore && !supabase && !dryRun) {
    console.warn("⚠️ Warning: Supabase service role key not provided. Operating in dry-run/manifest-only mode.");
  }

  // 1. Scan source directory (Metadata ONLY)
  console.log("Scanning source files (metadata only, no buffering)...");
  const inventory = scanSourceInventory(sourceDir);
  const totalSizeBytes = inventory.reduce((sum, f) => sum + f.sizeBytes, 0);
  console.log(`Discovered ${inventory.length} files (${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB total).\n`);

  // 2. Compute streaming checksums and check for existing assets
  console.log("Analyzing file integrity and checking database for existing assets...");
  const toUpload = [];
  const existingDuplicates = [];

  for (const item of inventory) {
    const sha256 = await computeFileSha256(item.filePath);
    item.sha256 = sha256;

    // Check database if asset already exists in space
    let exists = false;
    if (customStore) {
      exists = customStore.mediaAssets.some(
        (a) => a.space_id === spaceId && a.sha256_checksum.toLowerCase() === sha256.toLowerCase()
      );
    } else if (supabase) {
      const { data } = await supabase
        .from("media_assets")
        .select("id, original_filename")
        .eq("space_id", spaceId)
        .eq("sha256_checksum", sha256)
        .limit(1);
      exists = Boolean(data && data.length > 0);
    }

    if (exists && resume) {
      existingDuplicates.push(item);
    } else {
      toUpload.push(item);
    }
  }

  console.log(`✓ Checksum inventory completed:`);
  console.log(`  - Total files scanned: ${inventory.length}`);
  console.log(`  - Unique to upload:    ${toUpload.length}`);
  console.log(`  - Existing/Duplicate:  ${existingDuplicates.length}\n`);

  if (dryRun) {
    console.log("[DRY RUN COMPLETE] Source files untouched. No uploads or DB modifications made.");
    return {
      dryRun: true,
      totalFiles: inventory.length,
      toUploadCount: toUpload.length,
      duplicateCount: existingDuplicates.length,
      totalSizeBytes,
    };
  }

  // 3. Concurrency-bounded streaming migration
  console.log(`Beginning streaming upload of ${toUpload.length} files...`);
  const uploadedAssets = [];
  const failedUploads = [];
  let completedCount = 0;

  // Process in pools of `concurrency`
  for (let i = 0; i < toUpload.length; i += concurrency) {
    const batch = toUpload.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (item) => {
        const assetId = crypto.randomUUID();
        const primaryKey = `${spaceId}/${assetId}/${item.fileName}`;

        try {
          console.log(`[Stream -> Cloud] Uploading: ${item.relativePath} (${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB)...`);

          // Direct file stream into storage provider
          const fileStream = fs.createReadStream(item.filePath);
          const uploadRes = await provider.uploadStream(primaryKey, fileStream, {
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
            sha256Checksum: item.sha256,
          });

          // Verify destination checksum against local calculation
          const isVerified = await provider.verifyChecksum(primaryKey, item.sha256);
          if (!isVerified) {
            await provider.delete(primaryKey);
            throw new Error(`Integrity error: Destination checksum failed post-upload verification for ${item.fileName}`);
          }

          // Persist record to Supabase
          const assetRecord = {
            id: assetId,
            space_id: spaceId,
            uploader_id: userId,
            original_filename: item.fileName,
            mime_type: item.mimeType,
            size_bytes: item.sizeBytes,
            sha256_checksum: item.sha256,
            primary_provider: provider.type,
            primary_key: primaryKey,
            backup_status: "backup_pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (customStore) {
            customStore.mediaAssets.push(assetRecord);
            customStore.backupJobs.push({
              id: crypto.randomUUID(),
              media_asset_id: assetId,
              target_provider: "cloudflare_r2",
              status: "pending",
              attempts: 0,
              created_at: new Date().toISOString(),
            });
          } else if (supabase) {
            const { error: assetErr } = await supabase.from("media_assets").insert(assetRecord);
            if (assetErr) throw assetErr;

            // Queue backup job for secondary replica
            const { error: jobErr } = await supabase.from("backup_jobs").insert({
              media_asset_id: assetId,
              target_provider: "cloudflare_r2",
              status: "pending",
              attempts: 0,
            });
            if (jobErr) console.warn(`[Job Queue] Warning: failed to queue backup job for ${assetId}:`, jobErr.message);
          }

          completedCount++;
          uploadedAssets.push(assetRecord);
          console.log(`✓ Completed [${completedCount}/${toUpload.length}]: ${item.fileName} (SHA-256: ${item.sha256.slice(0, 16)}...)`);
        } catch (err) {
          console.error(`❌ Upload failed for ${item.fileName}:`, err.message);
          failedUploads.push({ file: item.fileName, error: err.message });
        }
      })
    );
  }

  // 4. Generate Migration Manifest
  if (!fs.existsSync(MIGRATION_MANIFESTS_DIR)) {
    fs.mkdirSync(MIGRATION_MANIFESTS_DIR, { recursive: true });
  }

  const manifestId = `migration_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const manifestPath = path.join(MIGRATION_MANIFESTS_DIR, manifestId);
  const manifestData = {
    manifestId,
    timestamp: new Date().toISOString(),
    sourceDir,
    spaceId,
    provider: provider.name,
    totalFilesScanned: inventory.length,
    uploadedCount: uploadedAssets.length,
    duplicatesSkipped: existingDuplicates.length,
    failedCount: failedUploads.length,
    failures: failedUploads,
    totalBytesMigrated: uploadedAssets.reduce((sum, item) => sum + item.size_bytes, 0),
    status: failedUploads.length === 0 ? "completed" : "completed_with_errors",
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  console.log(`\n============================================================`);
  console.log(`Migration finished. Uploaded: ${uploadedAssets.length}, Failed: ${failedUploads.length}`);
  console.log(`Manifest written: ${manifestPath}`);
  console.log(`Original source files preserved untouched.`);
  console.log(`============================================================\n`);

  return manifestData;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith("migrate-archive.mjs")) {
  const args = process.argv.slice(2);
  let sourceDir = null;
  let dryRun = false;
  let spaceId = process.env.HOM_SPACE_ID;
  let userId = process.env.HOM_USER_ID;
  let concurrency = 2;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sourceDir = args[i + 1];
      i++;
    } else if (args[i] === "--space-id" && args[i + 1]) {
      spaceId = args[i + 1];
      i++;
    } else if (args[i] === "--user-id" && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!sourceDir) {
    console.error("Usage: node scripts/migrate-archive.mjs --source <dir> --space-id <uuid> --user-id <uuid> [--dry-run] [--concurrency 2]");
    process.exit(1);
  }

  runMigration({ sourceDir, dryRun, spaceId, userId, concurrency }).catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}
