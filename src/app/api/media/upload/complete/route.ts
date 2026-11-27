import { NextResponse } from "next/server";
import { getAuthContext, insertMemoryRecord, linkMemoriesToAlbum } from "@/lib/repositories/memory-repository";
import { verifyAndCompleteUpload } from "@/lib/storage/r2";

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reservationId, storagePath, title, caption, story, albumId, tag, mediaType } = body;

    if (!reservationId || !storagePath) {
      return NextResponse.json(
        { error: "reservationId and storagePath are required" },
        { status: 400 }
      );
    }

    // 1. Verify object exists in storage and reservation is valid
    const { verified, reservation } = await verifyAndCompleteUpload({
      reservationId,
      storagePath,
    });

    if (!verified) {
      return NextResponse.json(
        { error: "Upload verification failed" },
        { status: 400 }
      );
    }

    // 2. Register real memory record in database
    const titleFromName =
      title?.trim() ||
      reservation.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    const { memory } = await insertMemoryRecord({
      title: titleFromName,
      caption: caption?.trim() || "",
      story: story?.trim() || "",
      imageUrl: storagePath,
      mediaType: mediaType || (reservation.mimeType.startsWith("video/") ? "video" : "image"),
      tag: tag || "Memories",
      location: "Our Sanctuary",
      isFavorite: false,
      author: "Both of Us",
    });

    // 3. Associate with album if requested
    if (albumId && memory?.id) {
      await linkMemoriesToAlbum(albumId, [memory.id]);
    }

    return NextResponse.json({
      success: true,
      memory,
      message: "Media verified and registered in private memory archive.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to complete upload" },
      { status: 400 }
    );
  }
}
