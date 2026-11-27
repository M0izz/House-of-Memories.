import { NextResponse } from "next/server";
import { fetchAlbums, createAlbumRecord } from "@/lib/repositories/memory-repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const sort = (searchParams.get("sort") as any) || "recently_updated";

    const result = await fetchAlbums({ search, sort });

    return NextResponse.json({
      success: true,
      albums: result.albums,
      totalAlbums: result.totalAlbums,
      totalMemories: result.totalMemories,
      isDemoMode: result.isDemoMode,
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
    const { title, description, coverImageUrl, createdBy } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Album title is required" },
        { status: 400 }
      );
    }

    const { album, isDemoMode } = await createAlbumRecord({
      title,
      description,
      coverImageUrl,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      album,
      isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create album" },
      { status: 500 }
    );
  }
}
