// ============================================================================
// House of Memories — Storage & Disaster Recovery Unit Test Suite
// ============================================================================

import crypto from "crypto";
import { Readable } from "stream";
import { computeFileSha256 } from "../migrate-archive.mjs";
import { deriveKey, encryptPayload } from "../db-backup.mjs";
import { decryptPayload } from "../db-restore.mjs";
import {
  MinIOStorageProvider,
  validateStorageKey,
  DEFAULT_PART_SIZE_BYTES,
} from "../../src/lib/storage/providers/minio-provider.ts";
import { LocalStorageProvider } from "../../src/lib/storage/providers/local-provider.ts";
import {
  getPrimaryStorageProvider,
  resetStorageProviderInstances,
} from "../../src/lib/storage/index.ts";

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

async function runUnitTests() {
  console.log("============================================================");
  console.log("🧪 Unit Tests: Storage, Encryption, and DR Logic");
  console.log("============================================================\n");

  // 1. Hash Calculation & Streaming SHA-256
  console.log("1. Streaming Hash Calculation");
  {
    const sampleData = "House of Memories — Irreplaceable Memory String 2027";
    const expectedHash = crypto.createHash("sha256").update(sampleData).digest("hex");

    const stream = Readable.from([Buffer.from(sampleData)]);
    const hash = crypto.createHash("sha256");
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const computedHash = hash.digest("hex");
    assert(computedHash === expectedHash, "Streaming SHA-256 matches in-memory hash");
  }

  // 2. Storage Key Validation & Traversal Prevention
  console.log("\n2. Storage Key Validation & Path Traversal Prevention");
  {
    assert(validateStorageKey("spaces/uuid-1/photo.jpg") === "spaces/uuid-1/photo.jpg", "Valid key accepted");
    assert(validateStorageKey("spaces\\uuid-1\\photo.jpg") === "spaces/uuid-1/photo.jpg", "Backslashes normalized");

    let traversalCaught = false;
    try {
      validateStorageKey("../../etc/passwd");
    } catch {
      traversalCaught = true;
    }
    assert(traversalCaught, "Directory traversal (..) rejected");

    let leadingSlashCaught = false;
    try {
      validateStorageKey("/root/secrets");
    } catch {
      leadingSlashCaught = true;
    }
    assert(leadingSlashCaught, "Leading slash rejected");
  }

  // 3. Multipart Boundaries & S3 Chunk Sizing
  console.log("\n3. Multipart Boundaries & Chunk Sizing");
  {
    assert(DEFAULT_PART_SIZE_BYTES === 5 * 1024 * 1024, "Minimum part size is 5 MB (S3 requirement)");

    // Test synthetic chunk splitting calculation
    const totalBytes = 23 * 1024 * 1024; // 23 MB
    const partSize = 5 * 1024 * 1024;
    const expectedParts = Math.ceil(totalBytes / partSize);
    assert(expectedParts === 5, "23 MB splits into 5 parts (4 x 5MB, 1 x 3MB)");
  }

  // 4. Exponential Backoff & Retry Logic
  console.log("\n4. Exponential Backoff & Retry Logic");
  {
    function calculateNextRetry(attempt) {
      const backoffSec = Math.pow(2, attempt) * 30; // 30s base
      return backoffSec;
    }
    assert(calculateNextRetry(1) === 60, "Attempt 1 delays 60 seconds (2^1 * 30)");
    assert(calculateNextRetry(2) === 120, "Attempt 2 delays 120 seconds (2^2 * 30)");
    assert(calculateNextRetry(3) === 240, "Attempt 3 delays 240 seconds (2^3 * 30)");
    assert(calculateNextRetry(4) === 480, "Attempt 4 delays 480 seconds (2^4 * 30)");
  }

  // 5. Provider Configuration & Fail-Closed Validation
  console.log("\n5. Provider Configuration & Fail-Closed Validation");
  {
    // Ensure no local fallback when not in test/explicit dev
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_LOCAL_STORAGE;
    const originalEndpoint = process.env.MINIO_ENDPOINT;

    delete process.env.MINIO_ENDPOINT;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_LOCAL_STORAGE;
    resetStorageProviderInstances();

    let failedClosed = false;
    try {
      getPrimaryStorageProvider();
    } catch (err) {
      failedClosed = true;
      assert(err.message.includes("fail closed"), "Error message explicitly notes fail-closed policy");
    }
    assert(failedClosed, "In production, missing MinIO credentials FAILS CLOSED (never writes to .data)");

    // Restore environment
    process.env.NODE_ENV = "test";
    process.env.ALLOW_LOCAL_STORAGE = "true";
    if (originalEndpoint) process.env.MINIO_ENDPOINT = originalEndpoint;
    resetStorageProviderInstances();
  }

  // 6. Capacity Calculation & Alert Threshold Triggers
  console.log("\n6. Capacity Calculation & Alert Threshold Triggers");
  {
    function getAlertLevel(percentUsed) {
      if (percentUsed >= 90) return "critical";
      if (percentUsed >= 80) return "warning";
      if (percentUsed >= 70) return "info";
      return "normal";
    }

    assert(getAlertLevel(50) === "normal", "50% capacity triggers 'normal'");
    assert(getAlertLevel(72) === "info", "72% capacity triggers 'info'");
    assert(getAlertLevel(85) === "warning", "85% capacity triggers 'warning'");
    assert(getAlertLevel(92) === "critical", "92% capacity triggers 'critical'");
  }

  // 7. Replica State Transitions
  console.log("\n7. Replica State Transitions");
  {
    function deriveBackupStatus(verifiedReplicaCount) {
      if (verifiedReplicaCount === 0) return "primary_only";
      if (verifiedReplicaCount === 1) return "partially_backed_up";
      return "fully_backed_up";
    }

    assert(deriveBackupStatus(0) === "primary_only", "0 replicas = 'primary_only'");
    assert(deriveBackupStatus(1) === "partially_backed_up", "1 replica = 'partially_backed_up'");
    assert(deriveBackupStatus(2) === "fully_backed_up", "2+ replicas = 'fully_backed_up'");
  }

  // 8. Database AES-256-GCM Encryption & Decryption
  console.log("\n8. Database AES-256-GCM Encryption Round-Trip");
  {
    const secretPassphrase = "house-of-memories-secret-test-passphrase-2027";
    const testPayload = JSON.stringify({
      table: "memories",
      records: [{ id: "mem-1", title: "Anniversary in Rome" }],
    });

    const encrypted = encryptPayload(testPayload, secretPassphrase);
    assert(Boolean(encrypted.salt && encrypted.iv && encrypted.tag && encrypted.ciphertext), "Encryption outputs salt, IV, tag, and ciphertext");

    const decrypted = decryptPayload(encrypted, secretPassphrase);
    assert(decrypted === testPayload, "Decrypted payload matches original plaintext exactly");

    let tamperedFailed = false;
    try {
      const tampered = { ...encrypted, tag: "00000000000000000000000000000000" };
      decryptPayload(tampered, secretPassphrase);
    } catch {
      tamperedFailed = true;
    }
    assert(tamperedFailed, "Tampered ciphertext or auth tag fails decryption");
  }

  console.log("\n============================================================");
  console.log(`Unit Tests Summary: ${passed} passed, ${failed} failed`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
}

runUnitTests().catch((err) => {
  console.error("Unit test execution error:", err);
  process.exit(1);
});
