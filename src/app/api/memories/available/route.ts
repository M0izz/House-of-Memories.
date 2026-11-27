import { NextResponse } from "next/server";
import { fetchAvailableMemoriesForAlbum } from "@/lib/repositories/memory-repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("albumId") || "";

    const { items, isDemoMode } = await fetchAvailableMemoriesForAlbum(albumId);

    return NextResponse.json({
      success: true,
      items,
      isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch available memories" },
      { status: 500 }
    );
  }
}
