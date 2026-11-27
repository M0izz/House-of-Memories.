import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/repositories/memory-repository";
import { getAuthorizedDownloadUrl } from "@/lib/storage/r2";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get("storagePath");

    if (!storagePath) {
      return NextResponse.json(
        { error: "storagePath parameter is required" },
        { status: 400 }
      );
    }

    // Verify cross-space boundary:
    // If path starts with spaces/<spaceId>/..., check that user belongs to this space!
    if (auth.spaceId && storagePath.startsWith("spaces/")) {
      const pathSpaceId = storagePath.split("/")[1];
      if (pathSpaceId && pathSpaceId !== auth.spaceId) {
        return NextResponse.json(
          { error: "Access denied to cross-space media asset." },
          { status: 403 }
        );
      }
    }

    const downloadUrl = await getAuthorizedDownloadUrl(storagePath);

    return NextResponse.json({
      success: true,
      downloadUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
