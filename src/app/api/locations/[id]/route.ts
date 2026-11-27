import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchLocationById,
  updateLocationRecord,
  deleteLocationRecord,
} from "@/lib/repositories/location-repository";
import { getAuthContext } from "@/lib/repositories/memory-repository";

const MAX_BODY_BYTES = 100 * 1024; // 100 KB

const UpdateLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name cannot be empty").max(120).optional(),
  latitude: z.number().min(-90.0).max(90.0).optional(),
  longitude: z.number().min(-180.0).max(180.0).optional(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  region: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  memoryIds: z.array(z.string().min(1).max(100)).max(50).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Invalid location identifier." },
        { status: 400 }
      );
    }

    const location = await fetchLocationById(id);

    if (!location) {
      return NextResponse.json(
        { error: "Location not found in accessible memory space." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      location,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch location." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large. Maximum size is 100 KB." },
        { status: 413 }
      );
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Invalid location identifier." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = UpdateLocationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { location, isDemoMode } = await updateLocationRecord(id, validated.data);

    return NextResponse.json({
      success: true,
      location,
      isDemoMode,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("not found");
    const isAtomicRollback = error.message?.includes("Atomic rollback");
    const isUnauthorized = error.message?.includes("Unauthorized") || error.message?.includes("Access denied");

    return NextResponse.json(
      { error: error?.message || "Failed to update location." },
      { status: isNotFound ? 404 : isAtomicRollback ? 400 : isUnauthorized ? 403 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Invalid location identifier." },
        { status: 400 }
      );
    }

    // Verify existence in space before deleting
    const existing = await fetchLocationById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Location not found in accessible memory space." },
        { status: 404 }
      );
    }

    const result = await deleteLocationRecord(id);

    return NextResponse.json({
      success: true,
      message: "Location pin removed successfully. Associated memories remain safely preserved.",
      isDemoMode: result.isDemoMode,
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes("not found");
    const isForbidden = error.message?.includes("Unauthorized") || error.message?.includes("denied");

    return NextResponse.json(
      { error: error?.message || "Failed to delete location pin." },
      { status: isNotFound ? 404 : isForbidden ? 403 : 500 }
    );
  }
}
