import { NextResponse } from "next/server";
import { getAlbumById, updateAlbum, deleteAlbum } from "@/lib/albums-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const album = getAlbumById(id);

    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      album,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch album" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, coverImageUrl, coverMemoryId, isFavorite } = body;

    const updated = updateAlbum(id, {
      title,
      description,
      coverImageUrl,
      coverMemoryId,
      isFavorite,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      album: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update album" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteAlbum(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Album deleted successfully. Associated memories were preserved in the archive.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete album" },
      { status: 500 }
    );
  }
}
