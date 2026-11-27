import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/repositories/memory-repository";
import { createUploadAuthorization } from "@/lib/storage/r2";

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileSizeBytes, mimeType } = body;

    if (!fileName || !fileSizeBytes || !mimeType) {
      return NextResponse.json(
        { error: "fileName, fileSizeBytes, and mimeType are required" },
        { status: 400 }
      );
    }

    const spaceId = auth.spaceId || "space-hom-main";
    const authorization = await createUploadAuthorization({
      spaceId,
      userId: auth.userId || "anonymous",
      fileName,
      fileSizeBytes: Number(fileSizeBytes),
      mimeType,
    });

    return NextResponse.json({
      success: true,
      ...authorization,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to authorize upload" },
      { status: 400 }
    );
  }
}
