// ============================================================================
// House of Memories — Storage Provider Abstraction & Multi-Cloud Router
// ============================================================================

import type { StorageProvider, StorageProviderType } from "./types.ts";
import { LocalStorageProvider } from "./providers/local-provider.ts";
import { MinIOStorageProvider } from "./providers/minio-provider.ts";
import { R2StorageProvider } from "./providers/r2-provider.ts";
import { OCIObjectStorageProvider } from "./providers/oci-object-provider.ts";
import crypto from "crypto";
import { Readable } from "stream";

export type * from "./types.ts";
export { LocalStorageProvider } from "./providers/local-provider.ts";
export { MinIOStorageProvider, validateStorageKey } from "./providers/minio-provider.ts";
export { R2StorageProvider } from "./providers/r2-provider.ts";
export { OCIObjectStorageProvider } from "./providers/oci-object-provider.ts";

let primaryProviderInstance: StorageProvider | null = null;
let secondaryProvidersInstances: StorageProvider[] | null = null;
let localFallbackInstance: StorageProvider | null = null;

export function getLocalStorageProvider(): StorageProvider {
  if (!localFallbackInstance) {
    localFallbackInstance = new LocalStorageProvider();
  }
  return localFallbackInstance;
}

/**
 * Returns the primary storage provider.
 *
 * FAIL-CLOSED POLICY:
 * In production, MinIO on OCI is required. If MinIO is unconfigured, this function
 * FAILS CLOSED (throws an error) rather than silently writing to local disk.
 *
 * Local storage is strictly permitted only when ALLOW_LOCAL_STORAGE=true or NODE_ENV=test.
 */
export function getPrimaryStorageProvider(): StorageProvider {
  if (primaryProviderInstance) {
    return primaryProviderInstance;
  }

  const minio = new MinIOStorageProvider();
  if (minio.isConfigured()) {
    primaryProviderInstance = minio;
    return primaryProviderInstance;
  }

  // Check if explicitly permitted for offline development or automated tests
  const isTest = process.env.NODE_ENV === "test";
  const explicitDev = process.env.ALLOW_LOCAL_STORAGE === "true";

  if (isTest || explicitDev) {
    console.warn(
      "[Storage Router] NOTICE: Operating with LocalStorageProvider fallback because ALLOW_LOCAL_STORAGE=true or NODE_ENV=test. " +
      "This is strictly restricted to development/test environments."
    );
    primaryProviderInstance = getLocalStorageProvider();
    return primaryProviderInstance;
  }

  // FAIL CLOSED IN PRODUCTION
  throw new Error(
    "CRITICAL STORAGE ERROR: Primary storage (MinIO on OCI) is not configured. " +
    "Missing required environment variables: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET_NAME. " +
    "Uploads fail closed to prevent silent local writes to unmonitored storage."
  );
}

/**
 * Resets cached instances (used during testing to switch configurations).
 */
export function resetStorageProviderInstances(): void {
  primaryProviderInstance = null;
  secondaryProvidersInstances = null;
  localFallbackInstance = null;
}

export function getSecondaryStorageProviders(): StorageProvider[] {
  if (secondaryProvidersInstances) {
    return secondaryProvidersInstances;
  }

  const secondaries: StorageProvider[] = [];

  const r2 = new R2StorageProvider();
  if (r2.isConfigured()) {
    secondaries.push(r2);
  }

  const ociObj = new OCIObjectStorageProvider();
  if (ociObj.isConfigured()) {
    secondaries.push(ociObj);
  }

  secondaryProvidersInstances = secondaries;
  return secondaryProvidersInstances;
}

export function getStorageProvider(typeOrName: StorageProviderType | string): StorageProvider {
  switch (typeOrName) {
    case "minio_oci":
      return new MinIOStorageProvider();
    case "cloudflare_r2":
      return new R2StorageProvider();
    case "oci_object":
      return new OCIObjectStorageProvider();
    case "local_dev":
      return getLocalStorageProvider();
    default:
      if (typeOrName.toLowerCase().includes("minio")) return new MinIOStorageProvider();
      if (typeOrName.toLowerCase().includes("r2")) return new R2StorageProvider();
      if (typeOrName.toLowerCase().includes("oci")) return new OCIObjectStorageProvider();
      return getLocalStorageProvider();
  }
}

/**
 * Downloads a file with streaming failover to secondary replicas if primary fails.
 * Bounded memory: streams the result rather than buffering entire files.
 */
export async function downloadWithFailoverStream(
  primaryKey: string,
  replicas?: Array<{ provider: string; remoteKey: string; sha256Checksum: string }>
): Promise<{ stream: Readable; providerUsed: string; sizeBytes?: number; sha256Checksum?: string }> {
  let primary: StorageProvider | null = null;
  try {
    primary = getPrimaryStorageProvider();
  } catch (err: any) {
    console.warn(`[Failover] Primary provider unavailable: ${err.message}`);
  }

  // Try primary first if available
  if (primary) {
    try {
      const res = await primary.downloadStream(primaryKey);
      return {
        stream: res.stream,
        providerUsed: primary.name,
        sizeBytes: res.contentLength,
        sha256Checksum: res.sha256Checksum,
      };
    } catch (primaryErr: any) {
      console.warn(`[Failover] Primary storage downloadStream failed for key ${primaryKey}: ${primaryErr.message}`);
    }
  }

  if (!replicas || replicas.length === 0) {
    throw new Error(`Primary storage failed and no secondary replicas exist for ${primaryKey}`);
  }

  // Try secondary replicas
  for (const replica of replicas) {
    try {
      console.log(`[Failover] Attempting recovery from secondary provider: ${replica.provider}`);
      const provider = getStorageProvider(replica.provider);
      if (!provider.isConfigured()) {
        console.warn(`[Failover] Replica provider ${replica.provider} is not configured.`);
        continue;
      }

      const res = await provider.downloadStream(replica.remoteKey);
      return {
        stream: res.stream,
        providerUsed: provider.name,
        sizeBytes: res.contentLength,
        sha256Checksum: replica.sha256Checksum,
      };
    } catch (replicaErr: any) {
      console.warn(`[Failover] Replica ${replica.provider} failed:`, replicaErr.message);
    }
  }

  throw new Error(`Disaster Recovery Error: All primary and replica storage sources failed for ${primaryKey}`);
}
