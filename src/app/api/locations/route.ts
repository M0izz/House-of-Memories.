import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchLocations,
  createLocationRecord,
} from "@/lib/repositories/location-repository";

const CreateLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required"),
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  memoryIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const isDemo = searchParams.get("demo") === "true";

    const result = await fetchLocations({ search, isDemo });

    return NextResponse.json({
      success: true,
      locations: result.locations,
      totalLocations: result.locations.length,
      isDemoMode: result.isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json(
      { error: error?.message || "Failed to create location" },
      { status: 500 }
    );
  }
}
