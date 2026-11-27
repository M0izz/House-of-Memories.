import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchLocations,
  createLocationRecord,
} from "@/lib/repositories/location-repository";
import { getAuthContext } from "@/lib/repositories/memory-repository";

const MAX_BODY_BYTES = 100 * 1024; // 100 KB request size limit

const CreateLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required").max(120, "Location name must not exceed 120 characters"),
  latitude: z.number().min(-90.0, "Latitude must be between -90 and 90").max(90.0, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180.0, "Longitude must be between -180 and 180").max(180.0, "Longitude must be between -180 and 180"),
  address: z.string().trim().max(300, "Address must not exceed 300 characters").optional().nullable(),
  city: z.string().trim().max(100, "City must not exceed 100 characters").optional().nullable(),
  region: z.string().trim().max(100, "Region must not exceed 100 characters").optional().nullable(),
  country: z.string().trim().max(100, "Country must not exceed 100 characters").optional().nullable(),
  description: z.string().trim().max(2000, "Description must not exceed 2000 characters").optional().nullable(),
  memoryIds: z.array(z.string().min(1).max(100)).max(50, "Cannot link more than 50 memories at once").optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required to view memory footprints." },
        { status: 401 }
      );
    }

    if (!auth.spaceId && !auth.isDemoMode) {
      return NextResponse.json(
        {
          success: true,
          locations: [],
          totalLocations: 0,
          unassignedSpace: true,
          message: "No memory space assigned to user.",
        },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().slice(0, 100) || undefined;
    const isDemo = searchParams.get("demo") === "true";

    const result = await fetchLocations({ search, isDemo });

    return NextResponse.json({
      success: true,
      locations: result.locations,
      totalLocations: result.locations.length,
      isDemoMode: result.isDemoMode,
    });
  } catch (error: any) {
    const isAuthError = error.message?.includes("Authentication") || error.message?.includes("sign in");
    const isSpaceError = error.message?.includes("memory space") || error.message?.includes("Unauthorized");

    return NextResponse.json(
      { error: error.message || "Failed to fetch locations." },
      { status: isAuthError ? 401 : isSpaceError ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Enforce payload size boundary
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large. Maximum request size is 100 KB." },
        { status: 413 }
      );
    }

    // 2. Strict Authentication & Space Membership
    const auth = await getAuthContext();
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required to create memory locations." },
        { status: 401 }
      );
    }

    if (!auth.spaceId && !auth.isDemoMode) {
      return NextResponse.json(
        { error: "Forbidden: You must belong to an active memory space to pin locations." },
        { status: 403 }
      );
    }

    // 3. Schema & Type Validation
    const body = await request.json();
    const validated = CreateLocationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 4. Atomic Location Creation
    const { location, isDemoMode } = await createLocationRecord({
      name: validated.data.name,
      latitude: validated.data.latitude,
      longitude: validated.data.longitude,
      address: validated.data.address,
      city: validated.data.city,
      region: validated.data.region,
      country: validated.data.country,
      description: validated.data.description,
      memoryIds: validated.data.memoryIds,
    });

    return NextResponse.json(
      {
        success: true,
        location,
        isDemoMode,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const isAtomicRollback = error.message?.includes("Atomic rollback");
    const isAuth = error.message?.includes("Authentication");
    const isForbidden = error.message?.includes("Unauthorized") || error.message?.includes("Forbidden");

    return NextResponse.json(
      {
        error: error.message || "Failed to create location.",
      },
      { status: isAtomicRollback ? 400 : isAuth ? 401 : isForbidden ? 403 : 500 }
    );
  }
}
