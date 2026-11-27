import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchLocationById,
  updateLocationRecord,
  deleteLocationRecord,
} from "@/lib/repositories/location-repository";

const UpdateLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name cannot be empty").optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  memoryIds: z.array(z.string()).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const location = await fetchLocationById(id);

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      location,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch location" },
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
    return NextResponse.json(
      { error: error?.message || "Failed to update location" },
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
    // Deleting the location removes geographic pins and links;
    // memories are preserved intact.
    const result = await deleteLocationRecord(id);

    return NextResponse.json({
      success: true,
      message: "Location deleted successfully. Associated memories were preserved.",
      isDemoMode: result.isDemoMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete location" },
      { status: 500 }
    );
  }
}
