import { NextResponse } from "next/server";
import { listAvailableMemoriesForSelection } from "@/lib/albums-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("albumId") || "";

    const items = listAvailableMemoriesForSelection(albumId);

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch available memories" },
      { status: 500 }
    );
  }
}
