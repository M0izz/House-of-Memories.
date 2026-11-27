import { NextResponse } from "next/server";
import { listAlbums, createAlbum, getTotalArchiveStats, AlbumSortOption } from "@/lib/albums-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const sort = (searchParams.get("sort") as AlbumSortOption) || "recently_updated";

    const albums = listAlbums({ search, sort });
    const stats = getTotalArchiveStats();

    return NextResponse.json({
      success: true,
      albums,
      totalAlbums: stats.totalAlbums,
      totalMemories: stats.totalMemories,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to list albums" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, coverImageUrl, createdBy = "Alex" } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Album title is required" },
        { status: 400 }
      );
    }

    const album = createAlbum({
      title,
      description,
      coverImageUrl,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      album,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create album" },
      { status: 500 }
    );
  }
}
