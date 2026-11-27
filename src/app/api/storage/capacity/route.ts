// ============================================================================
// House of Memories — Storage Capacity Monitor & Health API Route
// ============================================================================

import { NextResponse } from "next/server";
import { getPrimaryStorageProvider, getSecondaryStorageProviders } from "@/lib/storage";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const primary = getPrimaryStorageProvider();
    const primaryCapacity = await primary.getCapacity();
    const primaryHealth = await primary.healthCheck();

    const secondaryProviders = getSecondaryStorageProviders();
    const secondariesHealth = await Promise.all(
      secondaryProviders.map(async (sec) => ({
        name: sec.name,
        type: sec.type,
        health: await sec.healthCheck(),
        capacity: await sec.getCapacity(),
      }))
    );

    // Read store stats
    const localStorePath = path.join(process.cwd(), ".data", "albums-store.json");
    let mediaAssets: any[] = [];
    let mediaReplicas: any[] = [];
    let backupJobs: any[] = [];

    if (fs.existsSync(localStorePath)) {
      try {
        const store = JSON.parse(fs.readFileSync(localStorePath, "utf-8"));
        mediaAssets = store.mediaAssets || [];
        mediaReplicas = store.mediaReplicas || [];
        backupJobs = store.backupJobs || [];
      } catch {}
    }

    // Tally backup statuses
    const coverageCounts = {
      totalAssets: mediaAssets.length,
      primaryOnly: mediaAssets.filter((a) => a.backup_status === "primary_only").length,
      backupPending: mediaAssets.filter((a) => a.backup_status === "backup_pending").length,
      partiallyBackedUp: mediaAssets.filter((a) => a.backup_status === "partially_backed_up").length,
      fullyBackedUp: mediaAssets.filter((a) => a.backup_status === "fully_backed_up").length,
      integrityError: mediaAssets.filter((a) => a.backup_status === "integrity_error").length,
    };

    // Calculate alert status
    let alertLevel: "normal" | "info" | "warning" | "critical" = "normal";
    let alertMessage = "Storage capacity is healthy.";

    if (primaryCapacity.percentUsed >= 90) {
      alertLevel = "critical";
      alertMessage = "CRITICAL: Storage capacity has reached or exceeded 90%. Large uploads are restricted.";
    } else if (primaryCapacity.percentUsed >= 80) {
      alertLevel = "warning";
      alertMessage = "WARNING: Storage capacity is above 80%. Prepare to archive cold media or configure secondary replicas.";
    } else if (primaryCapacity.percentUsed >= 70) {
      alertLevel = "info";
      alertMessage = "NOTICE: Storage capacity has crossed 70%. Monitoring active.";
    }

    const drReadinessPercent =
      coverageCounts.totalAssets > 0
        ? Math.round(((coverageCounts.partiallyBackedUp + coverageCounts.fullyBackedUp) / coverageCounts.totalAssets) * 100)
        : 100;

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      primary: {
        provider: primary.name,
        type: primary.type,
        capacity: primaryCapacity,
        health: primaryHealth,
        alertLevel,
        alertMessage,
      },
      secondaries: secondariesHealth,
      disasterRecovery: {
        totalAssets: coverageCounts.totalAssets,
        coverageBreakdown: coverageCounts,
        drReadinessPercent,
        pendingJobsCount: backupJobs.filter((j) => j.status === "pending").length,
      },
      budgetPolicy: {
        monthlyCost: "$0.00/mo (Strict Free Tier Guaranteed)",
        ociAlwaysFreeVolume: "Up to 200 GB total Block Volume",
        ociObjectStorageFreeTier: "20 GB Always Free",
        cloudflareR2FreeTier: "10 GB Free Tier",
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
