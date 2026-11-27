import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/repositories/memory-repository";
import { deleteR2Object } from "@/lib/storage/r2";

export async function DELETE(request: Request) {
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

    // Space ownership validation
    if (auth.spaceId && storagePath.startsWith("spaces/")) {
      const pathSpaceId = storagePath.split("/")[1];
      if (pathSpaceId && pathSpaceId !== auth.spaceId) {
        return NextResponse.json(
          { error: "Forbidden: Cannot delete media from another space." },
          { status: 403 }
        );
      }
    }

    const deleted = await deleteR2Object(storagePath);

    return NextResponse.json({
      success: deleted,
      message: "Media object deleted from private storage.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete media object" },
      { status: 500 }
    );
  }
}
