import { NextResponse } from "next/server";
import { listAllMemories, createMemory } from "@/lib/albums-store";

export async function GET() {
  try {
    const memories = listAllMemories();
    return NextResponse.json({
      success: true,
      memories,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to list memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, ...singleItem } = body;

    // Support both single memory and bulk memories (e.g. from folder upload)
    if (Array.isArray(items) && items.length > 0) {
      const created = items.map((item: any) => createMemory(item));
      return NextResponse.json({
        success: true,
        count: created.length,
        memories: created,
      });
    }

    const memory = createMemory(singleItem);
    return NextResponse.json({
      success: true,
      memory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create memory" },
      { status: 500 }
    );
  }
}
