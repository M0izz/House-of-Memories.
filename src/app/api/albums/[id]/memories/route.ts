import { NextResponse } from "next/server";
import { linkMemoriesToAlbum } from "@/lib/repositories/memory-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: albumId } = await params;
    const body = await request.json();
    const { memoryIds = [] } = body;

    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      return NextResponse.json(
        { error: "At least one memory must be selected" },
        { status: 400 }
      );
    }

    const result = await linkMemoriesToAlbum(albumId, memoryIds);

    return NextResponse.json({
      success: true,
      addedCount: result.addedCount,
      duplicateCount: result.duplicateCount,
      isDemoMode: result.isDemoMode,
      message: `Added ${result.addedCount} ${result.addedCount === 1 ? "memory" : "memories"} to album.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to add memories to album" },
      { status: 500 }
    );
  }
}
