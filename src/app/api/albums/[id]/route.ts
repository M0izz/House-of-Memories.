import { NextResponse } from "next/server";
import {
  fetchAlbumById,
  updateAlbumRecord,
  deleteAlbumRecord,
} from "@/lib/repositories/memory-repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { album, isDemoMode } = await fetchAlbumById(id);

    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      album,
      isDemoMode,
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
    const { title, description, coverImageUrl, isFavorite } = body;

    const { album, isDemoMode } = await updateAlbumRecord(id, {
      title,
      description,
      coverImageUrl,
      isFavorite,
    });

    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      album,
      isDemoMode,
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
    const { success, isDemoMode } = await deleteAlbumRecord(id);

    if (!success) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Album deleted successfully. Associated memories were preserved in the archive.",
      isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete album" },
      { status: 500 }
    );
  }
}
