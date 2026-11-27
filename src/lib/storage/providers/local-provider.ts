// ============================================================================
// House of Memories — Local Development Storage Provider
// ============================================================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  StorageProvider,
  StorageProviderType,
  StorageMetadata,
  CapacityInfo,
  HealthCheckResult,
  UploadOptions,
} from "../types";

export class LocalStorageProvider implements StorageProvider {
  readonly name = "Local Development Storage";
  readonly type: StorageProviderType = "local_dev";
  private baseDir: string;
  private maxCapacityBytes: number;

  constructor(customDir?: string, maxCapacityBytes = 50 * 1024 * 1024 * 1024) {
    this.baseDir = customDir || path.join(process.cwd(), ".data", "media-storage");
    this.maxCapacityBytes = maxCapacityBytes;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  isConfigured(): boolean {
    return true;
  }

  private resolveKeyPath(key: string): string {
    const sanitized = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.baseDir, sanitized);
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string; sha256Checksum?: string }> {
    const filePath = this.resolveKeyPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error(`Integrity error: uploaded checksum mismatch for ${key}`);
    }

    fs.writeFileSync(filePath, buffer);

    // Save sidecar metadata
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

  async download(key: string): Promise<Buffer> {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const src = this.resolveKeyPath(sourceKey);
    const dest = this.resolveKeyPath(destKey);
    if (!fs.existsSync(src)) {
      throw new Error(`Source file not found: ${sourceKey}`);
    }
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    const srcMeta = `${src}.meta.json`;
    if (fs.existsSync(srcMeta)) {
      fs.copyFileSync(srcMeta, `${dest}.meta.json`);
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const filePath = this.resolveKeyPath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
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
      key,
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
    const scanDir = (dir: string) => {
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

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const testKey = `.health-check-${Date.now()}`;
      const filePath = this.resolveKeyPath(testKey);
      fs.writeFileSync(filePath, "ok");
      fs.unlinkSync(filePath);
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err.message,
      };
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `/api/media/download?key=${encodeURIComponent(key)}&exp=${expiresInSeconds}`;
  }

  async getSignedUploadUrl(key: string, expiresInSeconds = 900, mimeType = "application/octet-stream"): Promise<string> {
    return `/api/media/upload?key=${encodeURIComponent(key)}&exp=${expiresInSeconds}&mime=${encodeURIComponent(mimeType)}`;
  }
}
