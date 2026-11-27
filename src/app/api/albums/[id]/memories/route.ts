import { NextResponse } from "next/server";
import { addMemoriesToAlbum } from "@/lib/albums-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: albumId } = await params;
    const body = await request.json();
    const { memoryIds = [], addedBy = "Alex" } = body;

    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      return NextResponse.json(
        { error: "At least one memory must be selected" },
        { status: 400 }
      );
    }

    const result = addMemoriesToAlbum(albumId, memoryIds, addedBy);

    if (!result.album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      addedCount: result.addedCount,
      duplicateCount: result.duplicateCount,
      message: `Added ${result.addedCount} ${result.addedCount === 1 ? "memory" : "memories"} to album.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to add memories to album" },
      { status: 500 }
    );
  }
}
