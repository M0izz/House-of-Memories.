// ============================================================================
// House of Memories — Archive Restore from Secondary Replica
// Real Providers, Streaming Reconstruction, Supabase Metadata Authority
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  getPrimaryStorageProvider,
  getStorageProvider,
} from "../src/lib/storage/index.ts";

export async function restoreFromReplica(options = {}) {
  const {
    fromProvider = "cloudflare_r2",
    customPrimary = null,
    customSecondary = null,
    customStore = null,
  } = options;

  console.log("============================================================");
  console.log("🔄 House of Memories — Archive Restore from Secondary Replica");
  console.log("============================================================\n");
  console.log(`Source Provider: ${fromProvider}`);

  let replicas = [];
  let assetsMap = new Map();

  if (customStore) {
    replicas = (customStore.mediaReplicas || []).filter(
      (r) => r.provider === fromProvider && r.status === "verified"
    );
    for (const a of customStore.mediaAssets || []) {
      assetsMap.set(a.id, a);
    }
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || url.includes("placeholder")) {
      throw new Error("Missing Supabase credentials for restore operation.");
    }
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: repData, error: repErr } = await supabase
      .from("media_replicas")
      .select("*, media_assets(*)")
      .eq("provider", fromProvider)
      .eq("status", "verified");

    if (repErr) throw new Error(`Failed to query replicas: ${repErr.message}`);
    replicas = repData || [];
    for (const r of replicas) {
      if (r.media_assets) assetsMap.set(r.media_asset_id, r.media_assets);
    }
  }

  console.log(`Found ${replicas.length} verified cloud replicas on ${fromProvider}.`);

  const primary = customPrimary || getPrimaryStorageProvider();
  const secondary = customSecondary || getStorageProvider(fromProvider);

  if (!primary.isConfigured()) {
    throw new Error(`Primary storage (${primary.name}) is not configured.`);
  }
  if (!secondary.isConfigured()) {
    throw new Error(`Secondary replica provider (${secondary.name}) is not configured.`);
  }

  let restoredCount = 0;
  let bytesRestored = 0;

  for (const replica of replicas) {
    const asset = assetsMap.get(replica.media_asset_id);
    if (!asset) {
      console.warn(`[Restore] Missing asset metadata for replica ${replica.id}. Skipping.`);
      continue;
    }

    console.log(`[Stream Restore] Pulling ${replica.remote_key} from ${secondary.name} -> ${primary.name}...`);
    try {
      // Stream directly from secondary replica
      const { stream } = await secondary.downloadStream(replica.remote_key);

      // Stream upload directly into primary store
      const uploadRes = await primary.uploadStream(asset.primary_key, stream, {
        mimeType: asset.mime_type,
        sizeBytes: asset.size_bytes,
        sha256Checksum: asset.sha256_checksum,
      });

      // Verify SHA-256 on restored primary file
      const isVerified = await primary.verifyChecksum(asset.primary_key, asset.sha256_checksum);
      if (!isVerified) {
        throw new Error(`Integrity check failed on restored primary asset ${asset.primary_key}`);
      }

      restoredCount++;
      bytesRestored += asset.size_bytes || 0;
      console.log(`✓ Restored to primary: ${asset.original_filename} (${(asset.size_bytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`❌ Failed restoring ${asset.original_filename}:`, err.message);
    }
  }

  console.log(`\n============================================================`);
  console.log(`Restoration complete. Assets restored: ${restoredCount}, Total bytes: ${(bytesRestored / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`============================================================\n`);

  return { restoredCount, bytesRestored };
}

if (process.argv[1] && process.argv[1].endsWith("restore-archive.mjs")) {
  const args = process.argv.slice(2);
  let fromProvider = "cloudflare_r2";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      fromProvider = args[i + 1];
      i++;
    }
  }
  restoreFromReplica({ fromProvider }).catch((err) => {
    console.error("Archive restore fatal error:", err);
    process.exit(1);
  });
}
