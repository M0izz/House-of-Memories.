// ============================================================================
// House of Memories — Automated Cloud Backup Worker & Replica Engine
// Real Cloud Providers, Streaming Replication, Bounded Memory, Atomic Locking
// ============================================================================

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  getPrimaryStorageProvider,
  getStorageProvider,
} from "../src/lib/storage/index.ts";

const MAX_JOB_ATTEMPTS = 5;

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
 * Processes backup jobs using streaming replication directly between cloud providers.
 * Memory is bounded: original file is streamed directly from primary to secondary.
 */
export async function processBackupJobs(options = {}) {
  const {
    maxJobs = 10,
    customPrimary = null,
    customSecondary = null,
    customStore = null, // Mock DB for isolated test environments
  } = options;

  console.log("============================================================");
  console.log("🔄 House of Memories — Cloud Backup Replication Worker");
  console.log("============================================================\n");

  const supabase = customStore ? null : getSupabaseAdmin();
  if (!customStore && !supabase) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
      "Backup worker requires database authority to acquire and update jobs."
    );
  }

  const primary = customPrimary || getPrimaryStorageProvider();
  if (!primary.isConfigured()) {
    throw new Error(`Primary storage provider (${primary.name}) is not configured.`);
  }

  // 1. Fetch eligible jobs
  let pendingJobs = [];
  const now = new Date();

  if (customStore) {
    pendingJobs = customStore.backupJobs
      .filter((j) => {
        if (j.status === "completed" || j.status === "cancelled") return false;
        if (j.status === "pending") return true;
        if (j.status === "failed" && j.attempts < MAX_JOB_ATTEMPTS) {
          const nextRetry = j.next_retry_at ? new Date(j.next_retry_at) : new Date(0);
          return now >= nextRetry;
        }
        return false;
      })
      .slice(0, maxJobs);
  } else if (supabase) {
    const { data, error } = await supabase
      .from("backup_jobs")
      .select("*, media_assets(*)")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_JOB_ATTEMPTS)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
      .limit(maxJobs);

    if (error) throw new Error(`Failed to query backup jobs: ${error.message}`);
    pendingJobs = data || [];
  }

  console.log(`Discovered ${pendingJobs.length} eligible replication jobs.`);
  let processedCount = 0;
  let successCount = 0;

  for (const job of pendingJobs) {
    processedCount++;
    const targetProviderType = job.target_provider;
    console.log(`\n[Job ${job.id}] Replicating asset ${job.media_asset_id} to ${targetProviderType}...`);

    // 2. Safe atomic acquisition
    if (customStore) {
      job.status = "in_progress";
      job.attempts = (job.attempts || 0) + 1;
    } else if (supabase) {
      const { data: acquired, error: acqErr } = await supabase
        .from("backup_jobs")
        .update({ status: "in_progress", attempts: job.attempts + 1, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", job.status)
        .select();

      if (acqErr || !acquired || acquired.length === 0) {
        console.warn(`[Job ${job.id}] Already acquired by another worker. Skipping.`);
        continue;
      }
    }

    // Resolve Asset
    let asset = null;
    if (customStore) {
      asset = customStore.mediaAssets.find((a) => a.id === job.media_asset_id);
    } else {
      asset = job.media_assets;
    }

    if (!asset) {
      const errMsg = `Asset ${job.media_asset_id} not found in database.`;
      console.error(`❌ ${errMsg}`);
      if (customStore) {
        job.status = "failed";
        job.error_message = errMsg;
      } else if (supabase) {
        await supabase
          .from("backup_jobs")
          .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
          .eq("id", job.id);
      }
      continue;
    }

    // Resolve Secondary Provider
    const secondary = customSecondary || getStorageProvider(targetProviderType);
    if (!secondary.isConfigured()) {
      const errMsg = `Secondary provider ${targetProviderType} is not configured in this environment.`;
      console.warn(`⚠️ ${errMsg}`);
      const nextRetrySec = Math.pow(2, (job.attempts || 1)) * 30;
      const nextRetryAt = new Date(Date.now() + nextRetrySec * 1000).toISOString();

      if (customStore) {
        job.status = "failed";
        job.error_message = errMsg;
        job.next_retry_at = nextRetryAt;
      } else if (supabase) {
        await supabase
          .from("backup_jobs")
          .update({
            status: "failed",
            error_message: errMsg,
            next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
      continue;
    }

    try {
      // 3. Quota check before upload
      const capacity = await secondary.getCapacity();
      if (capacity.availableBytes < asset.size_bytes) {
        throw new Error(
          `Secondary quota exceeded for ${secondary.name}: available ${capacity.availableBytes} bytes, needed ${asset.size_bytes} bytes.`
        );
      }

      // 4. Stream original directly from Primary
      console.log(`[Stream Transfer] Streaming ${asset.primary_key} from ${primary.name}...`);
      const { stream: primaryStream } = await primary.downloadStream(asset.primary_key);

      // 5. Upload stream directly to Secondary Replica
      const replicaKey = `replicas/${asset.space_id}/${asset.id}/${asset.original_filename}`;
      console.log(`[Stream Transfer] Writing to ${secondary.name} at ${replicaKey}...`);

      const uploadResult = await secondary.uploadStream(replicaKey, primaryStream, {
        mimeType: asset.mime_type,
        sizeBytes: asset.size_bytes,
        sha256Checksum: asset.sha256_checksum,
      });

      // 6. Verify destination replica checksum independently
      const isReplicaValid = await secondary.verifyChecksum(replicaKey, asset.sha256_checksum);
      if (!isReplicaValid) {
        await secondary.delete(replicaKey);
        throw new Error(`Integrity error: Replica SHA-256 check failed on ${secondary.name}`);
      }

      // 7. Persist replica record in Supabase
      const replicaRecord = {
        id: crypto.randomUUID(),
        media_asset_id: asset.id,
        provider: secondary.type,
        remote_bucket: secondary.bucket || "secondary-bucket",
        remote_key: replicaKey,
        status: "verified",
        sha256_checksum: asset.sha256_checksum,
        size_bytes: asset.size_bytes,
        last_verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (customStore) {
        customStore.mediaReplicas.push(replicaRecord);
        const verifiedCount = customStore.mediaReplicas.filter(
          (r) => r.media_asset_id === asset.id && r.status === "verified"
        ).length;
        asset.backup_status = verifiedCount >= 2 ? "fully_backed_up" : "partially_backed_up";

        job.status = "completed";
        job.completed_at = new Date().toISOString();
        job.error_message = null;
      } else if (supabase) {
        await supabase.from("media_replicas").insert(replicaRecord);

        // Update asset backup status
        const { data: allReplicas } = await supabase
          .from("media_replicas")
          .select("id, status")
          .eq("media_asset_id", asset.id)
          .eq("status", "verified");

        const verifiedCount = (allReplicas || []).length;
        const newStatus = verifiedCount >= 2 ? "fully_backed_up" : "partially_backed_up";

        await supabase.from("media_assets").update({ backup_status: newStatus }).eq("id", asset.id);

        await supabase
          .from("backup_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }

      successCount++;
      console.log(`✓ Job completed: Replicated ${asset.original_filename} to ${secondary.name}`);
    } catch (err) {
      console.error(`❌ Replication failed for ${asset.original_filename}:`, err.message);
      const isPermanentFailure = (job.attempts || 1) >= MAX_JOB_ATTEMPTS;
      const nextRetrySec = Math.pow(2, (job.attempts || 1)) * 30;
      const nextRetryAt = new Date(Date.now() + nextRetrySec * 1000).toISOString();

      if (customStore) {
        job.status = isPermanentFailure ? "failed" : "pending";
        job.error_message = err.message;
        job.next_retry_at = nextRetryAt;
      } else if (supabase) {
        await supabase
          .from("backup_jobs")
          .update({
            status: isPermanentFailure ? "failed" : "pending",
            error_message: err.message,
            next_retry_at: isPermanentFailure ? null : nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }
  }

  console.log(`\n============================================================`);
  console.log(`Backup worker run complete. Processed: ${processedCount}, Succeeded: ${successCount}`);
  console.log(`============================================================\n`);

  return { processedCount, successCount };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith("backup-worker.mjs")) {
  processBackupJobs().catch((err) => {
    console.error("Backup worker fatal error:", err);
    process.exit(1);
  });
}
