// ============================================================================
// House of Memories — Storage Provider Abstraction Types
// ============================================================================

import type { Readable } from "stream";

export type StorageProviderType =
  | "minio_oci"
  | "cloudflare_r2"
  | "oci_object"
  | "google_drive"
  | "local_dev";

export type BackupStatus =
  | "primary_only"
  | "backup_pending"
  | "partially_backed_up"
  | "fully_backed_up"
  | "backup_failed"
  | "integrity_error";

export interface StorageMetadata {
  key: string;
  sizeBytes: number;
  mimeType: string;
  sha256Checksum?: string;
  lastModified: Date;
  etag?: string;
  customMetadata?: Record<string, string>;
}

export interface CapacityInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
  isEstimated?: boolean;
  measuredAt: Date;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  bucketExists?: boolean;
}

export interface UploadOptions {
  mimeType?: string;
  sizeBytes?: number;
  sha256Checksum?: string;
  customMetadata?: Record<string, string>;
  partSizeBytes?: number;
}

export interface UploadResult {
  key: string;
  etag?: string;
  sha256Checksum: string;
  sizeBytes: number;
}

export interface DownloadStreamResult {
  stream: Readable;
  contentLength?: number;
  contentType?: string;
  sha256Checksum?: string;
  etag?: string;
}

export interface StorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;

  isConfigured(): boolean;

  verifyBucket(): Promise<{ exists: boolean; bucket: string; message?: string }>;

  /**
   * Uploads buffered data (for small files/metadata). Validates checksum.
   */
  upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Streams data directly to storage using bounded memory and multipart upload.
   * Never buffers entire large files into memory.
   */
  uploadStream(
    key: string,
    stream: Readable,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Streams data directly from storage without loading into a single memory buffer.
   */
  downloadStream(key: string): Promise<DownloadStreamResult>;

  /**
   * Downloads small object into memory (enforces max limit e.g. 100MB).
   */
  download(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;

  copy(sourceKey: string, destKey: string): Promise<void>;

  getMetadata(key: string): Promise<StorageMetadata | null>;

  verifyChecksum(key: string, expectedSha256: string): Promise<boolean>;

  getCapacity(): Promise<CapacityInfo>;

  healthCheck(): Promise<HealthCheckResult>;

  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  getSignedUploadUrl(key: string, expiresInSeconds?: number, mimeType?: string): Promise<string>;
}
