import { NextResponse } from "next/server";
import {
  fetchAllMemories,
  insertMemoryRecord,
} from "@/lib/repositories/memory-repository";

export async function GET() {
  try {
    const { memories, isDemoMode } = await fetchAllMemories();
    return NextResponse.json({
      success: true,
      memories,
      isDemoMode,
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
      const createdPromises = items.map((item: any) => insertMemoryRecord(item));
      const createdResults = await Promise.all(createdPromises);
      return NextResponse.json({
        success: true,
        count: createdResults.length,
        memories: createdResults.map((r) => r.memory),
        isDemoMode: createdResults[0]?.isDemoMode ?? false,
      });
    }

    const { memory, isDemoMode } = await insertMemoryRecord(singleItem);
    return NextResponse.json({
      success: true,
      memory,
      isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create memory" },
      { status: 500 }
    );
  }
}
