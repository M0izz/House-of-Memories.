// ============================================================================
// House of Memories — MinIO S3 Storage Provider (OCI Always Free Primary)
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import {
  StorageProvider,
  StorageProviderType,
  StorageMetadata,
  CapacityInfo,
  HealthCheckResult,
  UploadOptions,
} from "../types";

export class MinIOStorageProvider implements StorageProvider {
  readonly name = "MinIO (OCI Block Volume)";
  readonly type: StorageProviderType = "minio_oci";

  private client: S3Client | null = null;
  private bucket: string;
  private totalCapacityBytes: number;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET_NAME || "hom-archive-primary";
    // Default OCI Always Free volume allocation: 150 GB (within 200 GB total free allowance)
    this.totalCapacityBytes = Number(process.env.MINIO_TOTAL_CAPACITY_BYTES) || 150 * 1024 * 1024 * 1024;

    if (this.isConfigured()) {
      this.client = new S3Client({
        endpoint: process.env.MINIO_ENDPOINT,
        region: process.env.MINIO_REGION || "us-ashburn-1",
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || "",
          secretAccessKey: process.env.MINIO_SECRET_KEY || "",
        },
        forcePathStyle: true,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      !process.env.MINIO_ENDPOINT.includes("placeholder")
    );
  }

  private getClient(): S3Client {
    if (!this.client) {
      throw new Error("MinIO storage provider is not configured. Please set MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY.");
    }
    return this.client;
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string; sha256Checksum?: string }> {
    const client = this.getClient();
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error(`Integrity error: uploaded checksum mismatch for ${key}`);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.mimeType || "application/octet-stream",
      Metadata: {
        "sha256-checksum": sha256,
        ...(options?.customMetadata || {}),
      },
    });

    const res = await client.send(command);
    return {
      key,
      etag: res.ETag,
      sha256Checksum: sha256,
    };
  }

  async download(key: string): Promise<Buffer> {
    const client = this.getClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const res = await client.send(command);
    if (!res.Body) {
      throw new Error(`Empty body returned for key: ${key}`);
    }

    const stream = res.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const client = this.getClient();
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await client.send(command);
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const client = this.getClient();
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${encodeURIComponent(sourceKey)}`,
      Key: destKey,
    });
    await client.send(command);
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const client = this.getClient();
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const res = await client.send(command);
      return {
        key,
        sizeBytes: res.ContentLength || 0,
        mimeType: res.ContentType || "application/octet-stream",
        sha256Checksum: res.Metadata?.["sha256-checksum"],
        lastModified: res.LastModified || new Date(),
        etag: res.ETag,
        customMetadata: res.Metadata || {},
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async verifyChecksum(key: string, expectedSha256: string): Promise<boolean> {
    const meta = await this.getMetadata(key);
    if (!meta) return false;
    if (meta.sha256Checksum) {
      return meta.sha256Checksum.toLowerCase() === expectedSha256.toLowerCase();
    }
    // Calculate if missing from metadata
    const buffer = await this.download(key);
    const calculated = crypto.createHash("sha256").update(buffer).digest("hex");
    return calculated.toLowerCase() === expectedSha256.toLowerCase();
  }

  async getCapacity(): Promise<CapacityInfo> {
    let usedBytes = 0;
    if (this.isConfigured()) {
      try {
        const client = this.getClient();
        let isTruncated = true;
        let continuationToken: string | undefined = undefined;

        while (isTruncated) {
          const command: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: this.bucket,
            ContinuationToken: continuationToken,
          });
          const res = await client.send(command);
          if (res.Contents) {
            for (const item of res.Contents) {
              usedBytes += item.Size || 0;
            }
          }
          isTruncated = res.IsTruncated || false;
          continuationToken = res.NextContinuationToken;
        }
      } catch (err) {
        console.warn("[MinIO] Failed to calculate exact capacity usage:", err);
      }
    }

    const availableBytes = Math.max(0, this.totalCapacityBytes - usedBytes);
    return {
      totalBytes: this.totalCapacityBytes,
      usedBytes,
      availableBytes,
      percentUsed: Number(((usedBytes / this.totalCapacityBytes) * 100).toFixed(2)),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "MinIO is not configured.",
      };
    }
    const start = Date.now();
    try {
      const client = this.getClient();
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });
      await client.send(command);
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
    const client = this.getClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(key: string, expiresInSeconds = 900, mimeType = "application/octet-stream"): Promise<string> {
    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }
}
