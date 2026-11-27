// ============================================================================
// House of Memories — Storage Capacity Monitor & Health API Route
// Authenticated, Supabase Metadata Authority, Real Measured Metrics
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPrimaryStorageProvider,
  getSecondaryStorageProviders,
  MinIOStorageProvider,
  R2StorageProvider,
  OCIObjectStorageProvider,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Authenticate Member
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isDev = process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_STORAGE === "true";
    if (!user && !isDev) {
      return NextResponse.json({ error: "Unauthorized access to storage metrics." }, { status: 401 });
    }

    // 2. Query Primary Storage Provider
    const minio = new MinIOStorageProvider();
    const isPrimaryConfigured = minio.isConfigured();

    let primaryDetails: any = {
      provider: minio.name,
      type: minio.type,
      configured: isPrimaryConfigured,
      health: { healthy: false, latencyMs: 0, message: "MinIO unconfigured." },
      capacity: null,
      alertLevel: "normal",
      alertMessage: "Primary storage unconfigured.",
    };

    if (isPrimaryConfigured) {
      const health = await minio.healthCheck();
      const capacity = await minio.getCapacity();

      let alertLevel: "normal" | "info" | "warning" | "critical" = "normal";
      let alertMessage = "Storage capacity is healthy.";

      if (capacity.percentUsed >= 90) {
        alertLevel = "critical";
        alertMessage = "CRITICAL: Storage capacity at or above 90%. Large uploads are restricted.";
      } else if (capacity.percentUsed >= 80) {
        alertLevel = "warning";
        alertMessage = "WARNING: Storage capacity is above 80%. Consider secondary archival.";
      } else if (capacity.percentUsed >= 70) {
        alertLevel = "info";
        alertMessage = "NOTICE: Storage capacity has crossed 70%.";
      }

      primaryDetails = {
        provider: minio.name,
        type: minio.type,
        configured: true,
        health,
        capacity,
        alertLevel,
        alertMessage,
      };
    } else if (isDev) {
      // Offline local provider status (explicitly labeled as development only)
      try {
        const localProvider = getPrimaryStorageProvider();
        const localCapacity = await localProvider.getCapacity();
        const localHealth = await localProvider.healthCheck();

        primaryDetails = {
          provider: localProvider.name,
          type: localProvider.type,
          configured: true,
          isDevelopmentFallback: true,
          health: localHealth,
          capacity: localCapacity,
          alertLevel: "normal",
          alertMessage: "Operating under local development fallback (restricted to dev/test environments).",
        };
      } catch (err: any) {
        primaryDetails.alertMessage = err.message;
      }
    }

    // 3. Query Secondary Storage Providers
    const r2 = new R2StorageProvider();
    const ociObj = new OCIObjectStorageProvider();

    const secondaries = [
      {
        provider: r2.name,
        type: r2.type,
        configured: r2.isConfigured(),
        health: r2.isConfigured() ? await r2.healthCheck() : { healthy: false, latencyMs: 0, message: "R2 unconfigured." },
        capacity: r2.isConfigured() ? await r2.getCapacity() : null,
      },
      {
        provider: ociObj.name,
        type: ociObj.type,
        configured: ociObj.isConfigured(),
        health: ociObj.isConfigured() ? await ociObj.healthCheck() : { healthy: false, latencyMs: 0, message: "OCI Object unconfigured." },
        capacity: ociObj.isConfigured() ? await ociObj.getCapacity() : null,
      },
    ];

    // 4. Query Actual Supabase Metadata
    let totalAssets = 0;
    let totalAssetBytes = 0;
    const coverageCounts = {
      primaryOnly: 0,
      backupPending: 0,
      partiallyBackedUp: 0,
      fullyBackedUp: 0,
      integrityError: 0,
    };
    let pendingJobsCount = 0;
    let failedJobsCount = 0;

    const { data: assetsData } = (await (supabase as any)
      .from("media_assets")
      .select("id, size_bytes, backup_status")) as { data: any[] | null };

    if (assetsData) {
      totalAssets = assetsData.length;
      for (const asset of assetsData) {
        totalAssetBytes += asset.size_bytes || 0;
        if (asset.backup_status === "primary_only") coverageCounts.primaryOnly++;
        else if (asset.backup_status === "backup_pending") coverageCounts.backupPending++;
        else if (asset.backup_status === "partially_backed_up") coverageCounts.partiallyBackedUp++;
        else if (asset.backup_status === "fully_backed_up") coverageCounts.fullyBackedUp++;
        else if (asset.backup_status === "integrity_error") coverageCounts.integrityError++;
      }
    }

    const { data: jobsData } = (await (supabase as any)
      .from("backup_jobs")
      .select("id, status")) as { data: any[] | null };

    if (jobsData) {
      pendingJobsCount = jobsData.filter((j) => j.status === "pending" || j.status === "in_progress").length;
      failedJobsCount = jobsData.filter((j) => j.status === "failed").length;
    }

    const drReadinessPercent =
      totalAssets > 0
        ? Math.round(((coverageCounts.partiallyBackedUp + coverageCounts.fullyBackedUp) / totalAssets) * 100)
        : 100;

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      primary: primaryDetails,
      secondaries,
      metadataAuthority: {
        engine: "Supabase PostgreSQL",
        totalAssets,
        totalAssetBytes,
        coverageBreakdown: {
          totalAssets,
          ...coverageCounts,
        },
        drReadinessPercent,
        jobs: {
          pending: pendingJobsCount,
          failed: failedJobsCount,
        },
      },
      infrastructurePolicies: {
        budgetStrategy: "Zero-cost Always Free optimization",
        ociBlockVolumePolicy: "Up to 200 GB Always Free allocation. Note: Subject to OCI compute idle reclamation rules.",
        ociObjectStoragePolicy: "20 GB Always Free tier.",
        cloudflareR2Policy: "10 GB free tier with zero egress costs.",
        guaranteeNotice: "Free tier availability is governed by cloud provider terms and quotas.",
      },
    });
  } catch (err: any) {
    console.error("[Storage API] Capacity calculation error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err.message,
      },
      { status: 500 }
    );
  }
}
