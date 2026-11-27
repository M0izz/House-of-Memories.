import { NextResponse } from "next/server";
import { removeMemoryFromAlbum } from "@/lib/albums-store";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const { id: albumId, memoryId } = await params;
    const removed = removeMemoryFromAlbum(albumId, memoryId);

    if (!removed) {
      return NextResponse.json(
        { error: "Memory was not found in this album" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Memory removed from album. Original memory remains preserved in archive.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove memory from album" },
      { status: 500 }
    );
  }
}
