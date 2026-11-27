// ============================================================================
// House of Memories — OCI Object Storage Secondary Storage Provider
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { Readable } from "stream";
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
import {
  validateStorageKey,
  DEFAULT_PART_SIZE_BYTES,
  MAX_IN_MEMORY_DOWNLOAD_BYTES,
} from "./minio-provider.ts";

export class OCIObjectStorageProvider implements StorageProvider {
  readonly name = "OCI Object Storage (Secondary Replica)";
  readonly type: StorageProviderType = "oci_object";

  private client: S3Client | null = null;
  private bucket: string;
  private totalCapacityBytes: number;

  constructor() {
    this.bucket = process.env.OCI_OBJECT_STORAGE_BUCKET || "hom-archive-secondary";
    // 20 GB Always Free tier
    this.totalCapacityBytes = 20 * 1024 * 1024 * 1024;

    if (this.isConfigured()) {
      const namespace = process.env.OCI_OBJECT_STORAGE_NAMESPACE!;
      const region = process.env.OCI_OBJECT_STORAGE_REGION || "us-ashburn-1";

      this.client = new S3Client({
        region,
        endpoint: `https://${namespace}.compat.objectstorage.${region}.oraclecloud.com`,
        credentials: {
          accessKeyId: process.env.OCI_CUSTOMER_SECRET_KEY_ID!,
          secretAccessKey: process.env.OCI_CUSTOMER_SECRET_KEY!,
        },
        forcePathStyle: true,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.OCI_OBJECT_STORAGE_NAMESPACE &&
      process.env.OCI_CUSTOMER_SECRET_KEY_ID &&
      process.env.OCI_CUSTOMER_SECRET_KEY &&
      process.env.OCI_OBJECT_STORAGE_BUCKET &&
      !process.env.OCI_OBJECT_STORAGE_NAMESPACE.includes("placeholder")
    );
  }

  private getClient(): S3Client {
    if (!this.client) {
      throw new Error(
        "OCI Object Storage provider is not configured. Missing OCI_OBJECT_STORAGE_NAMESPACE, " +
        "OCI_CUSTOMER_SECRET_KEY_ID, OCI_CUSTOMER_SECRET_KEY, or OCI_OBJECT_STORAGE_BUCKET."
      );
    }
    return this.client;
  }

  async verifyBucket(): Promise<{ exists: boolean; bucket: string; message?: string }> {
    const client = this.getClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { exists: true, bucket: this.bucket };
    } catch (err: any) {
      return { exists: false, bucket: this.bucket, message: err.message };
    }
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
      throw new Error(`Integrity error: uploaded checksum mismatch for ${sanitizedKey}`);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: sanitizedKey,
      Body: buffer,
      ContentType: options?.mimeType || "application/octet-stream",
      Metadata: {
        "sha256-checksum": sha256,
        ...(options?.customMetadata || {}),
      },
    });

    const res = await client.send(command);
    return {
      key: sanitizedKey,
      etag: res.ETag,
      sha256Checksum: sha256,
      sizeBytes: buffer.length,
    };
  }

  async uploadStream(
    key: string,
    stream: Readable,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    const partSize = Math.max(DEFAULT_PART_SIZE_BYTES, options?.partSizeBytes || DEFAULT_PART_SIZE_BYTES);

    const overallHash = crypto.createHash("sha256");
    let totalBytes = 0;
    let uploadId: string | null = null;
    const completedParts: { PartNumber: number; ETag: string }[] = [];
    let partNumber = 1;

    let currentChunkBuffer: Buffer[] = [];
    let currentChunkBytes = 0;

    const flushPart = async (isFinal = false): Promise<void> => {
      if (currentChunkBytes === 0) return;
      const partBuffer = Buffer.concat(currentChunkBuffer, currentChunkBytes);
      currentChunkBuffer = [];
      currentChunkBytes = 0;

      if (!uploadId && isFinal) {
        const sha256 = overallHash.digest("hex");
        if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== sha256.toLowerCase()) {
          throw new Error(`Integrity error: checksum mismatch for ${sanitizedKey}`);
        }

        const putRes = await client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: sanitizedKey,
            Body: partBuffer,
            ContentType: options?.mimeType || "application/octet-stream",
            Metadata: {
              "sha256-checksum": sha256,
              ...(options?.customMetadata || {}),
            },
          })
        );
        return;
      }

      if (!uploadId) {
        const initRes = await client.send(
          new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: sanitizedKey,
            ContentType: options?.mimeType || "application/octet-stream",
            Metadata: options?.customMetadata || {},
          })
        );
        uploadId = initRes.UploadId!;
      }

      const partRes = await client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: sanitizedKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: partBuffer,
        })
      );

      completedParts.push({ PartNumber: partNumber, ETag: partRes.ETag! });
      partNumber++;
    };

    try {
      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        overallHash.update(buf);
        totalBytes += buf.length;
        currentChunkBuffer.push(buf);
        currentChunkBytes += buf.length;
        if (currentChunkBytes >= partSize) {
          await flushPart(false);
        }
      }
      await flushPart(true);

      const calculatedSha256 = overallHash.digest("hex");
      if (options?.sha256Checksum && options.sha256Checksum.toLowerCase() !== calculatedSha256.toLowerCase()) {
        throw new Error(`Integrity error: stream checksum mismatch for ${sanitizedKey}`);
      }

      if (uploadId) {
        const completeRes = await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: this.bucket,
            Key: sanitizedKey,
            UploadId: uploadId,
            MultipartUpload: { Parts: completedParts },
          })
        );
        return {
          key: sanitizedKey,
          etag: completeRes.ETag,
          sha256Checksum: calculatedSha256,
          sizeBytes: totalBytes,
        };
      }

      return {
        key: sanitizedKey,
        sha256Checksum: calculatedSha256,
        sizeBytes: totalBytes,
      };
    } catch (err) {
      if (uploadId) {
        try {
          await client.send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucket,
              Key: sanitizedKey,
              UploadId: uploadId,
            })
          );
        } catch {}
      }
      throw err;
    }
  }

  async downloadStream(key: string): Promise<DownloadStreamResult> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
      })
    );

    if (!res.Body) throw new Error(`Empty body for key: ${sanitizedKey}`);
    return {
      stream: res.Body as Readable,
      contentLength: res.ContentLength,
      contentType: res.ContentType,
      sha256Checksum: res.Metadata?.["sha256-checksum"],
      etag: res.ETag,
    };
  }

  async download(key: string): Promise<Buffer> {
    const sanitizedKey = validateStorageKey(key);
    const meta = await this.getMetadata(sanitizedKey);
    if (!meta) throw new Error(`File not found: ${sanitizedKey}`);
    if (meta.sizeBytes > MAX_IN_MEMORY_DOWNLOAD_BYTES) {
      throw new Error(`File exceeds max in-memory limit. Use downloadStream().`);
    }

    const { stream } = await this.downloadStream(sanitizedKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: sanitizedKey }));
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const src = validateStorageKey(sourceKey);
    const dest = validateStorageKey(destKey);
    const client = this.getClient();
    await client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(src)}`,
        Key: dest,
      })
    );
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    try {
      const res = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: sanitizedKey,
        })
      );
      return {
        key: sanitizedKey,
        sizeBytes: res.ContentLength || 0,
        mimeType: res.ContentType || "application/octet-stream",
        sha256Checksum: res.Metadata?.["sha256-checksum"],
        lastModified: res.LastModified || new Date(),
        etag: res.ETag,
        customMetadata: res.Metadata || {},
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async verifyChecksum(key: string, expectedSha256: string): Promise<boolean> {
    const meta = await this.getMetadata(key);
    if (!meta) return false;
    if (meta.sha256Checksum) {
      return meta.sha256Checksum.toLowerCase() === expectedSha256.toLowerCase();
    }
    const { stream } = await this.downloadStream(key);
    const hash = crypto.createHash("sha256");
    for await (const chunk of stream) hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return hash.digest("hex").toLowerCase() === expectedSha256.toLowerCase();
  }

  async getCapacity(): Promise<CapacityInfo> {
    let usedBytes = 0;
    if (this.isConfigured()) {
      try {
        const client = this.getClient();
        let isTruncated = true;
        let continuationToken: string | undefined = undefined;

        while (isTruncated) {
          const res: any = await client.send(
            new ListObjectsV2Command({
              Bucket: this.bucket,
              ContinuationToken: continuationToken,
            })
          );
          if (res.Contents) {
            for (const item of res.Contents) {
              usedBytes += item.Size || 0;
            }
          }
          isTruncated = res.IsTruncated || false;
          continuationToken = res.NextContinuationToken;
        }
      } catch (err) {
        console.warn("[OCI Object] Error checking capacity:", err);
      }
    }

    const availableBytes = Math.max(0, this.totalCapacityBytes - usedBytes);
    return {
      totalBytes: this.totalCapacityBytes,
      usedBytes,
      availableBytes,
      percentUsed: Number(((usedBytes / this.totalCapacityBytes) * 100).toFixed(2)),
      isEstimated: false,
      measuredAt: new Date(),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "OCI Object Storage is not configured.",
        bucketExists: false,
      };
    }
    const start = Date.now();
    try {
      const bucketCheck = await this.verifyBucket();
      return {
        healthy: bucketCheck.exists,
        latencyMs: Date.now() - start,
        message: bucketCheck.message,
        bucketExists: bucketCheck.exists,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err.message,
        bucketExists: false,
      };
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: sanitizedKey,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(key: string, expiresInSeconds = 900, mimeType = "application/octet-stream"): Promise<string> {
    const sanitizedKey = validateStorageKey(key);
    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: sanitizedKey,
      ContentType: mimeType,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }
}
