// ============================================================================
// House of Memories — Automated Disaster Recovery & Backup Test Suite
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { runMigration } from "./migrate-archive.mjs";
import { processBackupJobs, runIntegrityAudit } from "./backup-worker.mjs";
import { restoreFromReplica } from "./restore-archive.mjs";
import { exportDatabaseMetadata } from "./db-backup.mjs";
import { restoreDatabaseMetadata } from "./db-restore.mjs";

async function downloadWithFailover(primaryKey, replicas = []) {
  const primaryPath = path.join(process.cwd(), ".data", "media-storage", primaryKey);
  try {
    if (fs.existsSync(primaryPath)) {
      const buffer = fs.readFileSync(primaryPath);
      return { buffer, providerUsed: "primary_storage", verified: true };
    }
    throw new Error("Primary file not found: " + primaryKey);
  } catch (err) {
    console.warn(`[Failover] Primary storage failed (${err.message}), falling back to replicas...`);
    for (const replica of replicas) {
      const replicaPath = path.join(process.cwd(), ".data", "secondary-storage", replica.provider, replica.remote_key);
      if (fs.existsSync(replicaPath)) {
        const buffer = fs.readFileSync(replicaPath);
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");
        if (replica.sha256_checksum && hash.toLowerCase() !== replica.sha256_checksum.toLowerCase()) {
          continue;
        }
        return { buffer, providerUsed: replica.provider, verified: true };
      }
    }
    throw new Error("Failover exhausted all secondary replicas for " + primaryKey);
  }
}

async function runTestSuite() {
  console.log("============================================================");
  console.log("🧪 Test Suite: Disaster Recovery & End-to-End Backup Workflow");
  console.log("============================================================\n");

  const testTempDir = path.join(process.cwd(), ".data", "test-dr-temp");
  if (fs.existsSync(testTempDir)) fs.rmSync(testTempDir, { recursive: true, force: true });
  fs.mkdirSync(testTempDir, { recursive: true });

  const mockSourceDir = path.join(testTempDir, "source-media");
  fs.mkdirSync(mockSourceDir, { recursive: true });

  // Generate 3 sample test media files
  const file1 = path.join(mockSourceDir, "anniversary-paris.jpg");
  const file2 = path.join(mockSourceDir, "birthday-cake-video.mp4");
  const file3 = path.join(mockSourceDir, "audio-voicemail.mp3");

  fs.writeFileSync(file1, "Paris Trip Photo Binary Data 2024");
  fs.writeFileSync(file2, "Birthday Celebration High Quality MP4 Data");
  fs.writeFileSync(file3, "Sweet Voicemail Recording Audio Bytes");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ ${testName}`);
      failed++;
    }
  }

  try {
    // Stage 1: Migration Dry-Run
    console.log("Stage 1: Migration Dry-Run verification");
    const dryRunResult = await runMigration({
      sourceDir: mockSourceDir,
      dryRun: true,
    });
    assert(dryRunResult.dryRun === true, "Dry run flagged as true");
    assert(dryRunResult.newFiles === 3, "Dry run correctly discovered 3 files");

    // Stage 2: Ingestion & Checksum Verification
    console.log("\nStage 2: Batched Migration Ingestion");
    const migrateResult = await runMigration({
      sourceDir: mockSourceDir,
      dryRun: false,
    });
    assert(migrateResult.uploadedCount === 3, "Successfully uploaded 3 assets");

    // Verify deduplication on re-run
    console.log("\nStage 2b: Duplicate Detection & Resume");
    const duplicateRun = await runMigration({
      sourceDir: mockSourceDir,
      dryRun: true,
    });
    assert(duplicateRun.duplicates === 3, "Correctly identified existing files as duplicates without re-upload");

    // Stage 3: Asynchronous Replication to Secondary Storage
    console.log("\nStage 3: Secondary Backup Replication Worker");
    const backupResult = await processBackupJobs({ maxJobs: 10 });
    assert(backupResult.successCount >= 3, "Worker successfully replicated pending assets to secondary storage");

    // Stage 4: Failover Download (Primary Outage Simulation)
    console.log("\nStage 4: Disaster Recovery Failover Download");
    const storeFile = path.join(process.cwd(), ".data", "albums-store.json");
    const store = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
    const testAsset = store.mediaAssets.find((a) => a.original_filename === "anniversary-paris.jpg");
    assert(testAsset !== undefined, "Found test asset in database");

    // Deliberately delete primary storage file to simulate primary disk failure
    const primaryPath = path.join(process.cwd(), ".data", "media-storage", testAsset.primary_key);
    fs.unlinkSync(primaryPath);

    const replicas = store.mediaReplicas.filter((r) => r.media_asset_id === testAsset.id);
    const failoverResult = await downloadWithFailover(testAsset.primary_key, replicas);
    assert(failoverResult.verified === true, "Failover download successfully retrieved and verified asset from secondary replica");
    assert(failoverResult.buffer.toString("utf-8") === "Paris Trip Photo Binary Data 2024", "Failover buffer content matches original exactly");

    // Stage 5: Integrity Audit
    console.log("\nStage 5: Cryptographic Integrity Audit Scan");
    // Write corrupted content to file2
    const file2Asset = store.mediaAssets.find((a) => a.original_filename === "birthday-cake-video.mp4");
    const file2Primary = path.join(process.cwd(), ".data", "media-storage", file2Asset.primary_key);
    fs.writeFileSync(file2Primary, "CORRUPTED DATA INJECTED");

    const auditReport = await runIntegrityAudit();
    assert(auditReport.corrupted_count > 0, "Integrity scan detected corrupted or missing primary file");

    // Stage 6: Full Archive Restoration from Secondary Replica
    console.log("\nStage 6: Archive Restoration from Secondary Replica");
    const restoreResult = await restoreFromReplica({ fromProvider: "cloudflare_r2" });
    assert(restoreResult.restoredCount >= 1, "Restored missing primary file from secondary replica");

    // Verify restored file
    assert(fs.existsSync(primaryPath), "Primary file restored on disk");
    const restoredBuf = fs.readFileSync(primaryPath);
    assert(restoredBuf.toString("utf-8") === "Paris Trip Photo Binary Data 2024", "Restored file content matches original");

    // Stage 7: Database Backup & Restore with Checksum Manifest
    console.log("\nStage 7: Database Metadata Backup & Restore Verification");
    const backupDir = path.join(testTempDir, "db-backups");
    const backupMeta = await exportDatabaseMetadata(backupDir);
    assert(fs.existsSync(backupMeta.exportPath), "Database backup file created");
    assert(fs.existsSync(backupMeta.manifestPath), "Cryptographic manifest file created");

    const restoreDb = await restoreDatabaseMetadata({
      backupPath: backupMeta.exportPath,
      verifyOnly: true,
    });
    assert(restoreDb.verified === true, "Database backup integrity verified via SHA-256 manifest");

    console.log("\n============================================================");
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("============================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
