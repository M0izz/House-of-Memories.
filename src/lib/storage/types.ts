// ============================================================================
// House of Memories — Storage Provider Abstraction Types
// ============================================================================

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
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface UploadOptions {
  mimeType?: string;
  sha256Checksum?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;

  isConfigured(): boolean;

  upload(
    key: string,
    data: Buffer | Uint8Array,
    options?: UploadOptions
  ): Promise<{ key: string; etag?: string; sha256Checksum?: string }>;

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
