// ============================================================================
// House of Memories — Local Development Storage Provider
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable, pipeline } from "stream";
import { promisify } from "util";
import type {
  StorageProvider,
  StorageProviderType,
  StorageMetadata,
  CapacityInfo,
  HealthCheckResult,
  UploadOptions,
  UploadResult,
  DownloadStreamResult,
} from "../types.ts";
import { validateStorageKey, MAX_IN_MEMORY_DOWNLOAD_BYTES } from "./minio-provider.ts";

const streamPipeline = promisify(pipeline);

export class LocalStorageProvider implements StorageProvider {
  readonly name = "Local Development Storage (Restricted)";
  readonly type: StorageProviderType = "local_dev";
  private baseDir: string;
  private maxCapacityBytes: number;

  constructor(customDir?: string, maxCapacityBytes = 50 * 1024 * 1024 * 1024) {
    this.baseDir = customDir || path.join(process.cwd(), ".data", "media-storage");
    this.maxCapacityBytes = maxCapacityBytes;

    if (this.isConfigured() && !fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Local storage is STRICTLY PERMITTED ONLY in explicit test/dev mode.
   * In production, this returns false to prevent accidental local writes.
   */
  isConfigured(): boolean {
    const isTest = process.env.NODE_ENV === "test";
    const explicitDev = process.env.ALLOW_LOCAL_STORAGE === "true";
    return isTest || explicitDev;
  }

  private assertPermitted(): void {
    if (!this.isConfigured()) {
      throw new Error(
        "CRITICAL ERROR: Local storage is not permitted in this environment. " +
        "Production storage must use OCI MinIO. Set ALLOW_LOCAL_STORAGE=true only for offline development."
      );
    }
  }

  private resolveKeyPath(key: string): string {
    this.assertPermitted();
    const sanitized = validateStorageKey(key);
    return path.join(this.baseDir, sanitized);
  }

  async verifyBucket(): Promise<{ exists: boolean; bucket: string; message?: string }> {
    if (!this.isConfigured()) {
      return { exists: false, bucket: this.baseDir, message: "Local storage not permitted." };
    }
    return { exists: fs.existsSync(this.baseDir), bucket: this.baseDir };
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const filePath = this.resolveKeyPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error(`Integrity error: uploaded checksum mismatch for ${key}. Expected ${options.sha256Checksum}, got ${sha256}`);
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
      sizeBytes: buffer.length,
    };
  }

  /**
   * Streams data directly to disk without buffering whole file in RAM.
   */
  async uploadStream(
    key: string,
    stream: Readable,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const filePath = this.resolveKeyPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const hash = crypto.createHash("sha256");
    let sizeBytes = 0;

    const outStream = fs.createWriteStream(filePath);

    // Track hash and byte count on stream pass-through
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      sizeBytes += buf.length;
      if (!outStream.write(buf)) {
        await new Promise((resolve) => outStream.once("drain", () => resolve(null)));
      }
    }

    await new Promise((resolve, reject) => {
      outStream.end((err?: Error | null) => (err ? reject(err) : resolve(null)));
    });

    const sha256 = hash.digest("hex");
    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new Error(`Integrity error: stream checksum mismatch for ${key}. Expected ${options.sha256Checksum}, got ${sha256}`);
    }

    const metaPath = `${filePath}.meta.json`;
    const meta = {
      key,
      sizeBytes,
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
      sizeBytes,
    };
  }

  async downloadStream(key: string): Promise<DownloadStreamResult> {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    const stat = fs.statSync(filePath);
    const meta = await this.getMetadata(key);

    return {
      stream: fs.createReadStream(filePath),
      contentLength: stat.size,
      contentType: meta?.mimeType || "application/octet-stream",
      sha256Checksum: meta?.sha256Checksum,
    };
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_IN_MEMORY_DOWNLOAD_BYTES) {
      throw new Error(
        `File ${key} is ${(stat.size / (1024 * 1024)).toFixed(1)} MB, exceeding max in-memory limit. Use downloadStream() instead.`
      );
    }

    return fs.readFileSync(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const src = this.resolveKeyPath(sourceKey);
    const dest = this.resolveKeyPath(destKey);
    if (!fs.existsSync(src)) throw new Error(`Source file not found: ${sourceKey}`);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    const srcMeta = `${src}.meta.json`;
    if (fs.existsSync(srcMeta)) fs.copyFileSync(srcMeta, `${dest}.meta.json`);
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    if (!this.isConfigured()) return null;
    const sanitizedKey = validateStorageKey(key);
    const filePath = path.join(this.baseDir, sanitizedKey);
    if (!fs.existsSync(filePath)) return null;

    const stat = fs.statSync(filePath);
    const metaPath = `${filePath}.meta.json`;
    let metaRecord: any = {};
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
      key: sanitizedKey,
      sizeBytes: stat.size,
      mimeType: metaRecord.mimeType || "application/octet-stream",
      sha256Checksum: sha256,
      lastModified: stat.mtime,
      etag: `"${sha256.slice(0, 32)}"`,
      customMetadata: metaRecord.customMetadata || {},
    };
  }

  async verifyChecksum(key: string, expectedSha256: string): Promise<boolean> {
    const meta = await this.getMetadata(key);
    if (!meta) return false;
    return meta.sha256Checksum?.toLowerCase() === expectedSha256.toLowerCase();
  }

  async getCapacity(): Promise<CapacityInfo> {
    let usedBytes = 0;
    if (this.isConfigured() && fs.existsSync(this.baseDir)) {
      const scanDir = (dir: string) => {
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
    }

    const availableBytes = Math.max(0, this.maxCapacityBytes - usedBytes);
    return {
      totalBytes: this.maxCapacityBytes,
      usedBytes,
      availableBytes,
      percentUsed: Number(((usedBytes / this.maxCapacityBytes) * 100).toFixed(2)),
      isEstimated: false,
      measuredAt: new Date(),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "Local storage is disabled in production.",
        bucketExists: false,
      };
    }
    const start = Date.now();
    try {
      const testKey = `.health-check-${Date.now()}`;
      const filePath = this.resolveKeyPath(testKey);
      fs.writeFileSync(filePath, "ok");
      fs.unlinkSync(filePath);
      return { healthy: true, latencyMs: Date.now() - start, bucketExists: true };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, message: err.message, bucketExists: false };
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `/api/media/download?key=${encodeURIComponent(key)}&exp=${expiresInSeconds}`;
  }

  async getSignedUploadUrl(key: string, expiresInSeconds = 900, mimeType = "application/octet-stream"): Promise<string> {
    return `/api/media/upload?key=${encodeURIComponent(key)}&exp=${expiresInSeconds}&mime=${encodeURIComponent(mimeType)}`;
  }
}
