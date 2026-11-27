// ============================================================================
// House of Memories — Storage Abstraction Test Suite
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";

class LocalStorageProvider {
  constructor(customDir, maxCapacityBytes = 50 * 1024 * 1024 * 1024) {
    this.name = "Local Development Storage";
    this.type = "local_dev";
    this.baseDir = customDir || path.join(process.cwd(), ".data", "media-storage");
    this.maxCapacityBytes = maxCapacityBytes;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  isConfigured() {
    return true;
  }

  resolveKeyPath(key) {
    const sanitized = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.baseDir, sanitized);
  }

  async upload(key, data, options) {
    const filePath = this.resolveKeyPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error(`Integrity error: uploaded checksum mismatch for ${key}`);
    }

    fs.writeFileSync(filePath, buffer);

    const metaPath = `${filePath}.meta.json`;
    const meta = {
      key,
      sizeBytes: buffer.length,
      mimeType: options?.mimeType || "application/octet-stream",
      sha256Checksum: sha256,
      lastModified: new Date().toISOString(),
      customMetadata: options?.customMetadata || {},
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    return {
      key,
      etag: `"${sha256.slice(0, 32)}"`,
      sha256Checksum: sha256,
    };
  }

  async download(key) {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${key}`);
    return fs.readFileSync(filePath);
  }

  async delete(key) {
    const filePath = this.resolveKeyPath(key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  }

  async copy(sourceKey, destKey) {
    const src = this.resolveKeyPath(sourceKey);
    const dest = this.resolveKeyPath(destKey);
    if (!fs.existsSync(src)) throw new Error(`Source file not found: ${sourceKey}`);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    const srcMeta = `${src}.meta.json`;
    if (fs.existsSync(srcMeta)) fs.copyFileSync(srcMeta, `${dest}.meta.json`);
  }

  async getMetadata(key) {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const metaPath = `${filePath}.meta.json`;
    let metaRecord = {};
    if (fs.existsSync(metaPath)) {
      try {
        metaRecord = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch {}
    }
    let sha256 = metaRecord.sha256Checksum;
    if (!sha256) {
      const buffer = fs.readFileSync(filePath);
      sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    }
    return {
      key,
      sizeBytes: stat.size,
      mimeType: metaRecord.mimeType || "application/octet-stream",
      sha256Checksum: sha256,
      lastModified: stat.mtime,
      etag: `"${sha256.slice(0, 32)}"`,
      customMetadata: metaRecord.customMetadata || {},
    };
  }

  async verifyChecksum(key, expectedSha256) {
    const meta = await this.getMetadata(key);
    if (!meta) return false;
    return meta.sha256Checksum?.toLowerCase() === expectedSha256.toLowerCase();
  }

  async getCapacity() {
    let usedBytes = 0;
    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && !entry.name.endsWith(".meta.json")) {
          try {
            usedBytes += fs.statSync(fullPath).size;
          } catch {}
        }
      }
    };
    scanDir(this.baseDir);
    const availableBytes = Math.max(0, this.maxCapacityBytes - usedBytes);
    return {
      totalBytes: this.maxCapacityBytes,
      usedBytes,
      availableBytes,
      percentUsed: Number(((usedBytes / this.maxCapacityBytes) * 100).toFixed(2)),
    };
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const testKey = `.health-check-${Date.now()}`;
      const filePath = this.resolveKeyPath(testKey);
      fs.writeFileSync(filePath, "ok");
      fs.unlinkSync(filePath);
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, message: err.message };
    }
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("🧪 Test Suite: Storage Provider Abstraction");
  console.log("============================================================\n");

  const testDir = path.join(process.cwd(), ".data", "test-storage-tmp");
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const provider = new LocalStorageProvider(testDir, 1024 * 1024 * 100);
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
    // Test 1: Upload and SHA-256 calculation
    console.log("Test 1: Upload and SHA-256 calculation");
    const testBuffer = Buffer.from("Memory Archive Binary Content for Test");
    const expectedSha256 = crypto.createHash("sha256").update(testBuffer).digest("hex");
    const uploadRes = await provider.upload("photos/memory-1.jpg", testBuffer, {
      mimeType: "image/jpeg",
      sha256Checksum: expectedSha256,
    });
    assert(uploadRes.key === "photos/memory-1.jpg", "Upload returned correct key");
    assert(uploadRes.sha256Checksum === expectedSha256, "Upload returned correct SHA-256");

    // Test 2: Metadata retrieval
    console.log("\nTest 2: Metadata retrieval");
    const meta = await provider.getMetadata("photos/memory-1.jpg");
    assert(meta !== null, "Metadata exists");
    assert(meta.sizeBytes === testBuffer.length, "Metadata size matches buffer length");
    assert(meta.mimeType === "image/jpeg", "MIME type matches");
    assert(meta.sha256Checksum === expectedSha256, "SHA-256 matches in metadata");

    // Test 3: Download content verification
    console.log("\nTest 3: Download content verification");
    const downloaded = await provider.download("photos/memory-1.jpg");
    assert(downloaded.toString("utf-8") === testBuffer.toString("utf-8"), "Downloaded buffer matches original");

    // Test 4: Checksum verification
    console.log("\nTest 4: Checksum verification");
    const isValid = await provider.verifyChecksum("photos/memory-1.jpg", expectedSha256);
    assert(isValid === true, "Valid checksum returns true");
    const isInvalid = await provider.verifyChecksum("photos/memory-1.jpg", "invalidchecksum1234567890abcdef");
    assert(isInvalid === false, "Invalid checksum returns false");

    // Test 5: Checksum mismatch on upload must reject
    console.log("\nTest 5: Checksum mismatch rejection on upload");
    let threwOnMismatch = false;
    try {
      await provider.upload("photos/tampered.jpg", testBuffer, {
        sha256Checksum: "0000000000000000000000000000000000000000000000000000000000000000",
      });
    } catch {
      threwOnMismatch = true;
    }
    assert(threwOnMismatch === true, "Upload with mismatched checksum throws error");

    // Test 6: Copy operation
    console.log("\nTest 6: Copy operation");
    await provider.copy("photos/memory-1.jpg", "photos/memory-1-copy.jpg");
    const copyMeta = await provider.getMetadata("photos/memory-1-copy.jpg");
    assert(copyMeta !== null && copyMeta.sizeBytes === testBuffer.length, "Copied file exists with identical size");

    // Test 7: Delete operation
    console.log("\nTest 7: Delete operation");
    await provider.delete("photos/memory-1-copy.jpg");
    const deletedMeta = await provider.getMetadata("photos/memory-1-copy.jpg");
    assert(deletedMeta === null, "Deleted file metadata is null");

    // Test 8: Capacity and health check
    console.log("\nTest 8: Capacity and health check");
    const capacity = await provider.getCapacity();
    assert(capacity.usedBytes > 0, "Capacity accurately records used bytes");
    assert(capacity.totalBytes === 1024 * 1024 * 100, "Capacity accurately records total capacity");
    const health = await provider.healthCheck();
    assert(health.healthy === true, "Health check passes");

    console.log("\n============================================================");
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("============================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
