// ============================================================================
// House of Memories — Archive Restore Tool (Disaster Recovery)
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), ".data", "albums-store.json");

export async function restoreFromReplica(options = {}) {
  const {
    fromProvider = "cloudflare_r2",
    targetDir = path.join(process.cwd(), ".data", "media-storage"),
  } = options;

  console.log("============================================================");
  console.log("🔄 House of Memories — Archive Restore from Secondary Replica");
  console.log("============================================================\n");
  console.log(`Source Provider: ${fromProvider}`);
  console.log(`Target Destination: ${targetDir}\n`);

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error("No database store found at " + DATA_FILE);
  }

  const store = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const replicas = (store.mediaReplicas || []).filter((r) => r.provider === fromProvider && r.status === "verified");

  console.log(`Found ${replicas.length} verified replicas to restore.`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let restoredCount = 0;
  let bytesRestored = 0;

  for (const replica of replicas) {
    const asset = (store.mediaAssets || []).find((a) => a.id === replica.media_asset_id);
    if (!asset) continue;

    const replicaPath = path.join(process.cwd(), ".data", "secondary-storage", fromProvider, replica.remote_key);
    if (!fs.existsSync(replicaPath)) {
      console.warn(`Replica file missing on disk: ${replicaPath}`);
      continue;
    }

    const destPath = path.join(targetDir, asset.primary_key);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const replicaBuf = fs.readFileSync(replicaPath);
    const checksum = crypto.createHash("sha256").update(replicaBuf).digest("hex");

    if (replica.sha256_checksum && checksum.toLowerCase() !== replica.sha256_checksum.toLowerCase()) {
      console.error(`Integrity mismatch on replica ${replica.id}! Skipping.`);
      continue;
    }

    fs.writeFileSync(destPath, replicaBuf);
    restoredCount++;
    bytesRestored += replicaBuf.length;
    console.log(`✓ Restored: ${asset.original_filename} (${(replicaBuf.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n============================================================`);
  console.log(`Restoration finished. Files: ${restoredCount}, Total: ${(bytesRestored / (1024 * 1024)).toFixed(2)} MB`);
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
  restoreFromReplica({ fromProvider }).catch(console.error);
}
