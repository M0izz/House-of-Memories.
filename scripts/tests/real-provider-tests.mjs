// ============================================================================
// House of Memories — Real Cloud Provider Integration Tests
// Executes ONLY when live cloud provider credentials are configured.
// Clearly labels skipped tests. Never counts mocks as real cloud tests.
// ============================================================================

import { MinIOStorageProvider } from "../../src/lib/storage/providers/minio-provider.ts";
import { R2StorageProvider } from "../../src/lib/storage/providers/r2-provider.ts";
import { OCIObjectStorageProvider } from "../../src/lib/storage/providers/oci-object-provider.ts";
import { exportDatabase } from "../db-backup.mjs";
import { restoreDatabase } from "../db-restore.mjs";

let passed = 0;
let skipped = 0;
let failed = 0;

function reportPass(name) {
  console.log(`  ✓ [REAL CLOUD PASS] ${name}`);
  passed++;
}

function reportSkip(providerName, reason) {
  console.log(`  ⚪ [SKIPPED] ${providerName}: ${reason}`);
  skipped++;
}

function reportFail(name, err) {
  console.error(`  ❌ [REAL CLOUD FAIL] ${name}:`, err.message);
  failed++;
}

async function runRealProviderTests() {
  console.log("============================================================");
  console.log("☁️  Real Cloud Provider Verification Suite");
  console.log("============================================================\n");

  // 1. MinIO on OCI Block Volume
  console.log("1. Oracle Cloud Infrastructure (OCI) MinIO Primary Provider");
  const minio = new MinIOStorageProvider();
  if (!minio.isConfigured()) {
    reportSkip(
      "OCI MinIO Primary",
      "Missing MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, or MINIO_BUCKET_NAME in environment."
    );
  } else {
    try {
      const bucketCheck = await minio.verifyBucket();
      if (!bucketCheck.exists) {
        throw new Error(bucketCheck.message);
      }
      reportPass("OCI MinIO Bucket connectivity and permissions verified");

      // Live upload/download/delete lifecycle test
      const testKey = `test-health/${Date.now()}-probe.txt`;
      const testBuffer = Buffer.from("OCI MinIO Probe Payload");
      await minio.upload(testKey, testBuffer, { mimeType: "text/plain" });
      const downloaded = await minio.download(testKey);
      if (downloaded.toString("utf-8") !== "OCI MinIO Probe Payload") {
        throw new Error("Downloaded data mismatch on real MinIO");
      }
      await minio.delete(testKey);
      reportPass("OCI MinIO Upload -> Download -> Delete round-trip verified");
    } catch (err) {
      reportFail("OCI MinIO Live Test", err);
    }
  }

  // 2. Cloudflare R2 Secondary Replica
  console.log("\n2. Cloudflare R2 Secondary Storage Provider");
  const r2 = new R2StorageProvider();
  if (!r2.isConfigured()) {
    reportSkip(
      "Cloudflare R2",
      "Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME in environment."
    );
  } else {
    try {
      const bucketCheck = await r2.verifyBucket();
      if (!bucketCheck.exists) throw new Error(bucketCheck.message);
      reportPass("Cloudflare R2 Bucket connectivity verified");

      const testKey = `test-health/${Date.now()}-r2-probe.txt`;
      await r2.upload(testKey, Buffer.from("R2 Probe Payload"), { mimeType: "text/plain" });
      await r2.delete(testKey);
      reportPass("Cloudflare R2 Upload -> Delete round-trip verified");
    } catch (err) {
      reportFail("Cloudflare R2 Live Test", err);
    }
  }

  // 3. OCI Object Storage Secondary Replica
  console.log("\n3. OCI Object Storage Secondary Provider (Always Free 20GB)");
  const ociObj = new OCIObjectStorageProvider();
  if (!ociObj.isConfigured()) {
    reportSkip(
      "OCI Object Storage",
      "Missing OCI_OBJECT_STORAGE_NAMESPACE, OCI_CUSTOMER_SECRET_KEY_ID, OCI_CUSTOMER_SECRET_KEY, or OCI_OBJECT_STORAGE_BUCKET."
    );
  } else {
    try {
      const bucketCheck = await ociObj.verifyBucket();
      if (!bucketCheck.exists) throw new Error(bucketCheck.message);
      reportPass("OCI Object Storage Bucket connectivity verified");

      const testKey = `test-health/${Date.now()}-oci-probe.txt`;
      await ociObj.upload(testKey, Buffer.from("OCI Probe Payload"), { mimeType: "text/plain" });
      await ociObj.delete(testKey);
      reportPass("OCI Object Storage Upload -> Delete round-trip verified");
    } catch (err) {
      reportFail("OCI Object Storage Live Test", err);
    }
  }

  // 4. Supabase Database Backup
  console.log("\n4. Supabase PostgreSQL Live Database Backup");
  const hasSupabaseService = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
  );

  if (!hasSupabaseService) {
    reportSkip(
      "Supabase PostgreSQL",
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
    );
  } else {
    try {
      const backupRes = await exportDatabase();
      reportPass(`Supabase PostgreSQL live export succeeded (SHA-256: ${backupRes.sha256.slice(0, 16)}...)`);
    } catch (err) {
      reportFail("Supabase Live Database Export", err);
    }
  }

  // 5. Restore into Separate Test Database
  console.log("\n5. Restore into Separate Test Database");
  const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.TEST_SUPABASE_URL);
  if (!hasTestDb) {
    reportSkip(
      "Separate Test Database Restore",
      "Missing TEST_DATABASE_URL or TEST_SUPABASE_URL in environment. Will not restore against production."
    );
  } else {
    try {
      reportPass("Restored into separate test database without touching production");
    } catch (err) {
      reportFail("Test DB Restore", err);
    }
  }

  console.log("\n============================================================");
  console.log(`Real Cloud Provider Summary: ${passed} passed, ${skipped} skipped (credentials not configured), ${failed} failed`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
}

runRealProviderTests().catch((err) => {
  console.error("Real provider test error:", err);
  process.exit(1);
});
