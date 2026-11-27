// ============================================================================
// House of Memories — Local Integration Test Suite
// Streaming, Memory Bounds, Checksum Validation, Migration, DR Workflows
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { LocalStorageProvider } from "../../src/lib/storage/providers/local-provider.ts";
import { runMigration } from "../migrate-archive.mjs";
import { processBackupJobs } from "../backup-worker.mjs";
import { exportDatabase } from "../db-backup.mjs";
import { restoreDatabase } from "../db-restore.mjs";

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

async function runIntegrationTests() {
  console.log("============================================================");
  console.log("🧪 Integration Tests: Streaming, Idempotency, DR Engine");
  console.log("============================================================\n");

  const testDir = path.join(process.cwd(), ".data", "test-integration-tmp");
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const primaryDir = path.join(testDir, "primary");
  const secondaryDir = path.join(testDir, "secondary");
  const sourceMediaDir = path.join(testDir, "source-media");
  fs.mkdirSync(primaryDir, { recursive: true });
  fs.mkdirSync(secondaryDir, { recursive: true });
  fs.mkdirSync(sourceMediaDir, { recursive: true });

  // Enable test mode for local providers
  process.env.NODE_ENV = "test";
  process.env.ALLOW_LOCAL_STORAGE = "true";

  const primaryProvider = new LocalStorageProvider(primaryDir);
  const secondaryProvider = new LocalStorageProvider(secondaryDir);

  const mockDb = {
    memory_spaces: [{ id: "space-dr-1", name: "Our Memories" }],
    space_members: [{ space_id: "space-dr-1", user_id: "user-dr-1" }],
    profiles: [{ id: "user-dr-1", full_name: "Alex" }],
    memories: [],
    albums: [],
    album_memories: [],
    mediaAssets: [],
    mediaReplicas: [],
    backupJobs: [],
    integrity_scans: [],
    storage_audit_logs: [],
  };

  try {
    // 1. Streaming Upload and Checksum Verification
    console.log("1. Streaming Upload with Stream Pipeline");
    {
      const testBuffer = Buffer.from("Streaming Video Sample Chunk Data 1234567890");
      const expectedSha = crypto.createHash("sha256").update(testBuffer).digest("hex");

      const stream = Readable.from([testBuffer]);
      const res = await primaryProvider.uploadStream("videos/clip-1.mp4", stream, {
        mimeType: "video/mp4",
        sha256Checksum: expectedSha,
      });

      assert(res.key === "videos/clip-1.mp4", "UploadStream returned expected key");
      assert(res.sha256Checksum === expectedSha, "UploadStream calculated matching SHA-256");

      const isValid = await primaryProvider.verifyChecksum("videos/clip-1.mp4", expectedSha);
      assert(isValid, "Destination checksum verified on disk");
    }

    // 2. Large File Streaming with Bounded Memory Usage
    console.log("\n2. Large File Streaming with Constant Memory (Bounded Memory)");
    {
      // Stream 20 MB of synthetic data in 1MB chunks without allocating 20MB buffer in memory
      const totalChunks = 20;
      const chunkSize = 1024 * 1024; // 1 MB
      const chunkPattern = Buffer.alloc(chunkSize, "A");

      const hash = crypto.createHash("sha256");
      let chunksEmitted = 0;

      const largeStream = new Readable({
        read() {
          if (chunksEmitted >= totalChunks) {
            this.push(null);
          } else {
            hash.update(chunkPattern);
            this.push(chunkPattern);
            chunksEmitted++;
          }
        },
      });

      const initialHeap = process.memoryUsage().heapUsed;
      const uploadRes = await primaryProvider.uploadStream("videos/large-clip.mp4", largeStream, {
        mimeType: "video/mp4",
      });

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      assert(uploadRes.sizeBytes === 20 * 1024 * 1024, "Full 20 MB streamed through");
      assert(uploadRes.sha256Checksum === hash.digest("hex"), "Streaming checksum matches byte-for-byte");
      // Memory delta should remain small because chunks were streamed directly, not buffered together
      console.log(`  - Heap Delta during 20MB stream: ${heapDeltaMb.toFixed(2)} MB`);
      assert(heapDeltaMb < 15, "Heap memory stayed bounded under 15 MB during 20 MB streaming");
    }

    // 3. Checksum Mismatch Rejection
    console.log("\n3. Checksum Mismatch Rejection on Stream");
    {
      const stream = Readable.from([Buffer.from("Valid Data")]);
      let threw = false;
      try {
        await primaryProvider.uploadStream("tampered.jpg", stream, {
          sha256Checksum: "0000000000000000000000000000000000000000000000000000000000000000",
        });
      } catch (err) {
        threw = true;
        assert(err.message.includes("checksum mismatch"), "Error message explains checksum mismatch");
      }
      assert(threw, "Stream rejected when checksum does not match expected");
    }

    // 4. Archive Migration CLI with Idempotency & Duplicate Detection
    console.log("\n4. Archive Migration CLI with Idempotency");
    {
      // Create 3 sample source files
      fs.writeFileSync(path.join(sourceMediaDir, "photo1.jpg"), "Photo One Content");
      fs.writeFileSync(path.join(sourceMediaDir, "photo2.png"), "Photo Two Content");
      fs.writeFileSync(path.join(sourceMediaDir, "voice.mp3"), "Voice Message Content");

      // First run: migration upload
      const migrate1 = await runMigration({
        sourceDir: sourceMediaDir,
        spaceId: "space-dr-1",
        userId: "user-dr-1",
        customProvider: primaryProvider,
        customStore: mockDb,
        dryRun: false,
      });

      assert(migrate1.uploadedCount === 3, "Migrated 3 new assets");
      assert(migrate1.duplicatesSkipped === 0, "No duplicates on initial run");
      assert(mockDb.mediaAssets.length === 3, "Assets recorded in database");
      assert(mockDb.backupJobs.length === 3, "Backup jobs queued in database");

      // Second run: duplicate detection resume
      const migrate2 = await runMigration({
        sourceDir: sourceMediaDir,
        spaceId: "space-dr-1",
        userId: "user-dr-1",
        customProvider: primaryProvider,
        customStore: mockDb,
        resume: true,
      });

      assert(migrate2.uploadedCount === 0, "0 files re-uploaded on duplicate run");
      assert(migrate2.duplicatesSkipped === 3, "All 3 existing files detected as duplicates and skipped");
    }

    // 5. Cloud Backup Worker with Streaming Replication & Atomic State Update
    console.log("\n5. Cloud Backup Worker with Streaming Replication");
    {
      const workerRes = await processBackupJobs({
        maxJobs: 5,
        customPrimary: primaryProvider,
        customSecondary: secondaryProvider,
        customStore: mockDb,
      });

      assert(workerRes.successCount === 3, "Replicated 3 pending jobs to secondary storage");
      assert(mockDb.mediaReplicas.length === 3, "Replicas recorded in database");
      assert(mockDb.mediaReplicas.every((r) => r.status === "verified"), "All replicas verified");
      assert(mockDb.mediaAssets.every((a) => a.backup_status === "partially_backed_up"), "Asset status updated to partially_backed_up");
    }

    // 6. Database Encrypted Backup and Integrity Manifest
    console.log("\n6. Database Encrypted Backup & Manifest Verification");
    {
      const backupDir = path.join(testDir, "db-backups");
      const backupRes = await exportDatabase({
        customDir: backupDir,
        passphrase: "secure-test-passphrase-2027",
        customStore: mockDb,
      });

      assert(fs.existsSync(backupRes.exportPath), "Encrypted backup file created on disk");
      assert(fs.existsSync(backupRes.manifestPath), "Cryptographic manifest file created");
      assert(backupRes.manifest.algorithm === "aes-256-gcm", "Manifest notes AES-256-GCM encryption");

      // Verify backup without restoring
      const verifyRes = await restoreDatabase({
        backupPath: backupRes.exportPath,
        passphrase: "secure-test-passphrase-2027",
        verifyOnly: true,
      });
      assert(verifyRes.verified === true, "Backup SHA-256 and decryption verified");

      // Restore into a separate test store
      const separateTestStore = {};
      const restoreRes = await restoreDatabase({
        backupPath: backupRes.exportPath,
        passphrase: "secure-test-passphrase-2027",
        customStore: separateTestStore,
      });
      assert(restoreRes.restored === true, "Restore into separate test store succeeded");
      assert(separateTestStore.media_assets.length === 3, "Restored media assets match original count");
    }

    console.log("\n============================================================");
    console.log(`Integration Tests Summary: ${passed} passed, ${failed} failed`);
    console.log("============================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

runIntegrationTests().catch((err) => {
  console.error("Integration test fatal error:", err);
  process.exit(1);
});
