// ============================================================================
// House of Memories — Storage Provider Abstraction & Multi-Cloud Router
// ============================================================================

import { StorageProvider, StorageProviderType } from "./types";
import { LocalStorageProvider } from "./providers/local-provider";
import { MinIOStorageProvider } from "./providers/minio-provider";
import { R2StorageProvider } from "./providers/r2-provider";
import { OCIObjectStorageProvider } from "./providers/oci-object-provider";
import crypto from "crypto";

export * from "./types";
export { LocalStorageProvider } from "./providers/local-provider";
export { MinIOStorageProvider } from "./providers/minio-provider";
export { R2StorageProvider } from "./providers/r2-provider";
export { OCIObjectStorageProvider } from "./providers/oci-object-provider";

let primaryProviderInstance: StorageProvider | null = null;
let secondaryProvidersInstances: StorageProvider[] | null = null;
let localFallbackInstance: StorageProvider | null = null;

export function getLocalStorageProvider(): StorageProvider {
  if (!localFallbackInstance) {
    localFallbackInstance = new LocalStorageProvider();
  }
  return localFallbackInstance;
}

export function getPrimaryStorageProvider(): StorageProvider {
  if (primaryProviderInstance) {
    return primaryProviderInstance;
  }

  const minio = new MinIOStorageProvider();
  if (minio.isConfigured()) {
    primaryProviderInstance = minio;
    return primaryProviderInstance;
  }

  // Graceful local fallback for development / offline environments
  primaryProviderInstance = getLocalStorageProvider();
  return primaryProviderInstance;
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
 * Downloads a file with automatic failover to secondary replicas if primary fails.
 */
export async function downloadWithFailover(
  primaryKey: string,
  replicas?: Array<{ provider: string; remoteKey: string; sha256Checksum: string }>
): Promise<{ buffer: Buffer; providerUsed: string; verified: boolean }> {
  const primary = getPrimaryStorageProvider();

  // Try primary first
  try {
    const buffer = await primary.download(primaryKey);
    return {
      buffer,
      providerUsed: primary.name,
      verified: true,
    };
  } catch (primaryErr: any) {
    console.warn(`[Failover] Primary storage (${primary.name}) failed for key ${primaryKey}:`, primaryErr.message);

    if (!replicas || replicas.length === 0) {
      throw new Error(`Primary storage failed and no secondary replicas exist for ${primaryKey}: ${primaryErr.message}`);
    }

    // Try secondary replicas
    for (const replica of replicas) {
      try {
        console.log(`[Failover] Attempting recovery from secondary provider: ${replica.provider}`);
        const provider = getStorageProvider(replica.provider);
        const buffer = await provider.download(replica.remoteKey);

        // Verify replica checksum
        if (replica.sha256Checksum) {
          const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
          if (checksum.toLowerCase() !== replica.sha256Checksum.toLowerCase()) {
            console.error(`[Failover] Checksum mismatch from replica ${replica.provider} for key ${replica.remoteKey}`);
            continue;
          }
        }

        return {
          buffer,
          providerUsed: provider.name,
          verified: true,
        };
      } catch (replicaErr: any) {
        console.warn(`[Failover] Replica ${replica.provider} failed:`, replicaErr.message);
      }
    }

    throw new Error(`Disaster Recovery Error: All primary and replica storage sources failed for ${primaryKey}`);
  }
}
