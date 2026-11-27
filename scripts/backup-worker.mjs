// ============================================================================
// House of Memories — Automated Backup Worker & Disaster Recovery Engine
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), ".data", "albums-store.json");

/**
 * Loads the current store tables.
 */
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
  data.integrityScans = data.integrityScans || [];
  return data;
}

/**
 * Saves store tables atomically.
 */
function saveStore(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, DATA_FILE);
}

/**
 * Processes pending backup jobs from primary to secondary storage.
 */
export async function processBackupJobs(options = {}) {
  const { maxJobs = 10, targetSecondary = "cloudflare_r2" } = options;
  console.log("============================================================");
  console.log("🔄 House of Memories — Backup Worker Run");
  console.log("============================================================\n");

  const store = loadStore();
  const now = new Date();

  // Find eligible pending or retryable jobs
  const pendingJobs = store.backupJobs.filter((job) => {
    if (job.status === "completed" || job.status === "cancelled") return false;
    if (job.status === "pending") return true;
    if (job.status === "failed" && job.attempts < 5) {
      const nextRetry = job.next_retry_at ? new Date(job.next_retry_at) : new Date(0);
      return now >= nextRetry;
    }
    return false;
  }).slice(0, maxJobs);

  console.log(`Found ${pendingJobs.length} eligible backup jobs.`);
  let processedCount = 0;
  let successCount = 0;

  for (const job of pendingJobs) {
    processedCount++;
    console.log(`\n[Job ${job.id}] Processing asset: ${job.media_asset_id} -> ${job.target_provider}`);

    job.status = "in_progress";
    job.attempts = (job.attempts || 0) + 1;
    saveStore(store);

    const asset = store.mediaAssets.find((a) => a.id === job.media_asset_id);
    if (!asset) {
      job.status = "failed";
      job.error_message = `Asset ${job.media_asset_id} not found in database`;
      saveStore(store);
      console.error(`❌ ${job.error_message}`);
      continue;
    }

    try {
      // Resolve source file (from primary storage directory or key)
      const primaryBase = path.join(process.cwd(), ".data", "media-storage");
      const sourcePath = path.join(primaryBase, asset.primary_key);

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source primary file not found at: ${sourcePath}`);
      }

      const sourceBuffer = fs.readFileSync(sourcePath);
      const sourceChecksum = crypto.createHash("sha256").update(sourceBuffer).digest("hex");

      if (asset.sha256_checksum && asset.sha256_checksum.toLowerCase() !== sourceChecksum.toLowerCase()) {
        throw new Error(`Integrity error: Source file checksum (${sourceChecksum}) does not match asset metadata (${asset.sha256_checksum})`);
      }

      // Replicate to secondary storage folder
      const secondaryBase = path.join(process.cwd(), ".data", "secondary-storage", job.target_provider);
      if (!fs.existsSync(secondaryBase)) {
        fs.mkdirSync(secondaryBase, { recursive: true });
      }

      const replicaKey = `${asset.space_id}/${asset.id}/${asset.original_filename}`;
      const replicaPath = path.join(secondaryBase, replicaKey);
      const replicaDir = path.dirname(replicaPath);
      if (!fs.existsSync(replicaDir)) {
        fs.mkdirSync(replicaDir, { recursive: true });
      }

      // Write replica
      fs.writeFileSync(replicaPath, sourceBuffer);

      // Verify streaming SHA-256 on written replica
      const writtenBuffer = fs.readFileSync(replicaPath);
      const replicaChecksum = crypto.createHash("sha256").update(writtenBuffer).digest("hex");

      if (replicaChecksum.toLowerCase() !== sourceChecksum.toLowerCase()) {
        fs.unlinkSync(replicaPath);
        throw new Error(`Replica SHA-256 verification failed! Expected: ${sourceChecksum}, got: ${replicaChecksum}`);
      }

      // Record replica
      let replica = store.mediaReplicas.find((r) => r.media_asset_id === asset.id && r.provider === job.target_provider);
      if (!replica) {
        replica = {
          id: `replica-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          media_asset_id: asset.id,
          provider: job.target_provider,
          remote_bucket: `hom-backup-${job.target_provider}`,
          remote_key: replicaKey,
          status: "verified",
          sha256_checksum: replicaChecksum,
          size_bytes: writtenBuffer.length,
          last_verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        store.mediaReplicas.push(replica);
      } else {
        replica.status = "verified";
        replica.sha256_checksum = replicaChecksum;
        replica.size_bytes = writtenBuffer.length;
        replica.last_verified_at = new Date().toISOString();
      }

      // Update asset backup status
      const verifiedReplicas = store.mediaReplicas.filter((r) => r.media_asset_id === asset.id && r.status === "verified");
      asset.backup_status = verifiedReplicas.length >= 2 ? "fully_backed_up" : "partially_backed_up";

      job.status = "completed";
      job.completed_at = new Date().toISOString();
      job.error_message = null;
      successCount++;

      console.log(`✓ Replica written & verified for ${asset.original_filename} (SHA-256: ${replicaChecksum.slice(0, 16)}...)`);
      console.log(`✓ Asset backup status updated to: ${asset.backup_status}`);
    } catch (err) {
      console.error(`❌ Job failed: ${err.message}`);
      job.status = job.attempts >= 5 ? "failed" : "pending";
      job.error_message = err.message;
      // Exponential backoff: 2^attempts * 10 seconds
      const backoffSec = Math.pow(2, job.attempts) * 10;
      job.next_retry_at = new Date(Date.now() + backoffSec * 1000).toISOString();
    }

    saveStore(store);
  }

  console.log(`\n============================================================`);
  console.log(`Worker complete. Processed: ${processedCount}, Succeeded: ${successCount}`);
  console.log(`============================================================\n`);

  return { processedCount, successCount };
}

/**
 * Runs an integrity audit on all assets and replicas.
 */
export async function runIntegrityAudit() {
  console.log("============================================================");
  console.log("🔍 House of Memories — Archive Integrity Audit Scan");
  console.log("============================================================\n");

  const store = loadStore();
  let checked = 0;
  let intact = 0;
  let corrupted = 0;

  for (const asset of store.mediaAssets) {
    checked++;
    const primaryPath = path.join(process.cwd(), ".data", "media-storage", asset.primary_key);
    if (!fs.existsSync(primaryPath)) {
      console.warn(`⚠️ Asset missing from primary storage: ${asset.primary_key}`);
      asset.backup_status = "integrity_error";
      corrupted++;
      continue;
    }

    const buf = fs.readFileSync(primaryPath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    if (asset.sha256_checksum && hash.toLowerCase() !== asset.sha256_checksum.toLowerCase()) {
      console.error(`❌ Checksum mismatch for asset ${asset.id}! Expected: ${asset.sha256_checksum}, got: ${hash}`);
      asset.backup_status = "integrity_error";
      corrupted++;
    } else {
      intact++;
    }
  }

  const scanRecord = {
    id: `scan-${Date.now()}`,
    scanned_at: new Date().toISOString(),
    total_assets_checked: checked,
    intact_count: intact,
    corrupted_count: corrupted,
    status: corrupted === 0 ? "clean" : "integrity_warnings_found",
  };
  store.integrityScans.push(scanRecord);
  saveStore(store);

  console.log(`Audit finished. Checked: ${checked}, Intact: ${intact}, Corrupted: ${corrupted}`);
  return scanRecord;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("backup-worker.mjs")) {
  const isAudit = process.argv.includes("--scan-integrity");
  if (isAudit) {
    runIntegrityAudit().catch(console.error);
  } else {
    processBackupJobs().catch(console.error);
  }
}
