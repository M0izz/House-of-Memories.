import { NextResponse } from "next/server";
import { unlinkMemoryFromAlbum } from "@/lib/repositories/memory-repository";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const { id: albumId, memoryId } = await params;
    const { success, isDemoMode } = await unlinkMemoryFromAlbum(albumId, memoryId);

    if (!success) {
      return NextResponse.json(
        { error: "Memory was not found in this album" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Memory removed from album. Original memory remains preserved in archive.",
      isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove memory from album" },
      { status: 500 }
    );
  }
}
