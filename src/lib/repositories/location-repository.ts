// ============================================================================
// House of Memories — Location Repository Layer
// ============================================================================
// Supports live Supabase PostgreSQL storage with RLS enforcement and
// graceful local persistence (.data/locations-store.json) for dev/offline mode.
// ============================================================================

import fs from "fs";
import path from "path";
import { isSupabaseConfigured, getAuthContext } from "./memory-repository.ts";
import { listAllMemories } from "../albums-store.ts";

export interface MemoryLocationRecord {
  id: string;
  spaceId: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  memoryCount: number;
  coverImageUrl?: string | null;
  memories?: {
    id: string;
    title: string;
    caption: string;
    date: string;
    imageUrl: string;
  }[];
}

export interface LocationLinkRecord {
  id: string;
  locationId: string;
  memoryId: string;
  createdAt: string;
}

export function validateCoordinates(lat: number, lng: number): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ----------------------------------------------------------------------------
// Local Storage Persistence for Dev Mode
// ----------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), ".data");
const LOCATIONS_FILE = path.join(DATA_DIR, "locations-store.json");

interface LocalLocationStore {
  locations: MemoryLocationRecord[];
  links: LocationLinkRecord[];
}

declare global {
  // eslint-disable-next-line no-var
  var __homLocationStore: LocalLocationStore | undefined;
}

function loadLocalStore(): LocalLocationStore {
  if (global.__homLocationStore) {
    return global.__homLocationStore;
  }

  try {
    if (typeof window === "undefined" && fs.existsSync(LOCATIONS_FILE)) {
      const raw = fs.readFileSync(LOCATIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      global.__homLocationStore = parsed;
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load local locations store:", err);
  }

  // Initial production state: empty (no fabricated data)
  const emptyStore: LocalLocationStore = {
    locations: [],
    links: [],
  };
  global.__homLocationStore = emptyStore;
  return emptyStore;
}

function saveLocalStore(store: LocalLocationStore) {
  try {
    if (typeof window === "undefined") {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(store, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to save local locations store:", err);
  }
}

async function getSupabaseServerClient(): Promise<any> {
  const { createClient } = await import("../supabase/server.ts");
  return createClient();
}

// ----------------------------------------------------------------------------
// Public Location Repository Methods
// ----------------------------------------------------------------------------

export async function fetchLocations(options?: {
  search?: string;
  isDemo?: boolean;
}): Promise<{
  locations: MemoryLocationRecord[];
  isDemoMode: boolean;
}> {
  const auth = await getAuthContext();

  // If live Supabase is configured and user is authenticated in a space
  if (!auth.isDemoMode && auth.spaceId) {
    try {
      const supabase: any = await getSupabaseServerClient();
      let query = supabase
        .from("memory_locations")
        .select(`
          id,
          space_id,
          name,
          address,
          city,
          region,
          country,
          latitude,
          longitude,
          description,
          created_by,
          created_at,
          updated_at,
          memory_location_links (
            memory_id,
            memories:memory_id (
              id,
              title,
              caption,
              captured_at,
              created_at,
              memory_media (
                storage_path
              )
            )
          )
        `)
        .eq("space_id", auth.spaceId)
        .order("created_at", { ascending: false });

      if (options?.search) {
        query = query.ilike("name", `%${options.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const locations: MemoryLocationRecord[] = (data || []).map((row: any) => {
        const linkedMemories = (row.memory_location_links || [])
          .filter((link: any) => link.memories)
          .map((link: any) => {
            const m = link.memories;
            return {
              id: m.id,
              title: m.title || "Untitled Memory",
              caption: m.caption || "",
              date: m.captured_at
                ? new Date(m.captured_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : new Date(m.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              imageUrl: m.memory_media?.[0]?.storage_path || "/placeholder.jpg",
            };
          });

        return {
          id: row.id,
          spaceId: row.space_id,
          name: row.name,
          address: row.address,
          city: row.city,
          region: row.region,
          country: row.country,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          description: row.description,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          memoryCount: linkedMemories.length,
          coverImageUrl: linkedMemories[0]?.imageUrl || null,
          memories: linkedMemories,
        };
      });

      return { locations, isDemoMode: false };
    } catch (err) {
      console.error("Supabase fetchLocations error, falling back to local:", err);
    }
  }

  // Dev/local fallback
  const store = loadLocalStore();
  let locs = [...store.locations];

  if (options?.search) {
    const q = options.search.toLowerCase();
    locs = locs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.country && l.country.toLowerCase().includes(q))
    );
  }

  // Populate linked memories from albums-store
  const allMemories = listAllMemories();
  const memoriesMap = new Map(allMemories.map((m) => [m.id, m]));

  const enriched = locs.map((loc) => {
    const links = store.links.filter((l) => l.locationId === loc.id);
    const linkedMemories = links
      .map((l) => memoriesMap.get(l.memoryId))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({
        id: m.id,
        title: m.title,
        caption: m.caption,
        date: m.date,
        imageUrl: m.imageUrl,
      }));

    return {
      ...loc,
      memoryCount: linkedMemories.length,
      coverImageUrl: linkedMemories[0]?.imageUrl || loc.coverImageUrl || null,
      memories: linkedMemories,
    };
  });

  return { locations: enriched, isDemoMode: true };
}

export async function fetchLocationById(id: string): Promise<MemoryLocationRecord | null> {
  const result = await fetchLocations();
  return result.locations.find((l) => l.id === id) || null;
}

export async function createLocationRecord(input: {
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  description?: string | null;
  memoryIds?: string[];
  createdBy?: string;
}): Promise<{
  location: MemoryLocationRecord;
  isDemoMode: boolean;
}> {
  if (!input.name || !input.name.trim()) {
    throw new Error("Location name is required.");
  }

  if (!validateCoordinates(input.latitude, input.longitude)) {
    throw new Error("Invalid geographic coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.");
  }

  const auth = await getAuthContext();

  if (!auth.isDemoMode && auth.spaceId) {
    const supabase: any = await getSupabaseServerClient();

    const insertPayload = {
      space_id: auth.spaceId,
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      country: input.country?.trim() || null,
      description: input.description?.trim() || null,
      created_by: auth.userId || null,
    };

    const { data: newLoc, error: locError } = await supabase
      .from("memory_locations")
      .insert(insertPayload)
      .select()
      .single();

    if (locError) throw locError;

    // Link memories if provided
    if (input.memoryIds && input.memoryIds.length > 0) {
      const linkPayloads = input.memoryIds.map((memId) => ({
        location_id: newLoc.id,
        memory_id: memId,
      }));

      const { error: linkError } = await supabase
        .from("memory_location_links")
        .insert(linkPayloads);

      if (linkError) {
        console.error("Failed to link memories to location:", linkError);
      }
    }

    const created = await fetchLocationById(newLoc.id);
    return {
      location: created || {
        id: newLoc.id,
        spaceId: newLoc.space_id,
        name: newLoc.name,
        latitude: Number(newLoc.latitude),
        longitude: Number(newLoc.longitude),
        address: newLoc.address,
        city: newLoc.city,
        region: newLoc.region,
        country: newLoc.country,
        description: newLoc.description,
        createdBy: newLoc.created_by,
        createdAt: newLoc.created_at,
        updatedAt: newLoc.updated_at,
        memoryCount: input.memoryIds?.length || 0,
      },
      isDemoMode: false,
    };
  }

  // Dev/local fallback
  const store = loadLocalStore();
  const now = new Date().toISOString();
  const newId = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newRecord: MemoryLocationRecord = {
    id: newId,
    spaceId: auth.spaceId || "space-hom-main",
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    country: input.country?.trim() || null,
    description: input.description?.trim() || null,
    createdBy: auth.userId || "local-dev-user",
    createdAt: now,
    updatedAt: now,
    memoryCount: input.memoryIds?.length || 0,
  };

  store.locations.unshift(newRecord);

  if (input.memoryIds && input.memoryIds.length > 0) {
    for (const memId of input.memoryIds) {
      store.links.push({
        id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        locationId: newId,
        memoryId: memId,
        createdAt: now,
      });
    }
  }

  saveLocalStore(store);

  // Return enriched record
  const result = await fetchLocationById(newId);
  return { location: result || newRecord, isDemoMode: true };
}

export async function updateLocationRecord(
  id: string,
  input: {
    name?: string;
    latitude?: number;
    longitude?: number;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    description?: string | null;
    memoryIds?: string[];
  }
): Promise<{
  location: MemoryLocationRecord;
  isDemoMode: boolean;
}> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    if (!validateCoordinates(input.latitude, input.longitude)) {
      throw new Error("Invalid geographic coordinates.");
    }
  }

  const auth = await getAuthContext();

  if (!auth.isDemoMode && auth.spaceId) {
    const supabase: any = await getSupabaseServerClient();

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.latitude !== undefined) updatePayload.latitude = input.latitude;
    if (input.longitude !== undefined) updatePayload.longitude = input.longitude;
    if (input.address !== undefined) updatePayload.address = input.address;
    if (input.city !== undefined) updatePayload.city = input.city;
    if (input.region !== undefined) updatePayload.region = input.region;
    if (input.country !== undefined) updatePayload.country = input.country;
    if (input.description !== undefined) updatePayload.description = input.description;

    const { error: updateError } = await supabase
      .from("memory_locations")
      .update(updatePayload)
      .eq("id", id)
      .eq("space_id", auth.spaceId);

    if (updateError) throw updateError;

    // Synchronize memory links if provided
    if (input.memoryIds !== undefined) {
      await supabase
        .from("memory_location_links")
        .delete()
        .eq("location_id", id);

      if (input.memoryIds.length > 0) {
        const links = input.memoryIds.map((mId) => ({
          location_id: id,
          memory_id: mId,
        }));
        await supabase.from("memory_location_links").insert(links);
      }
    }

    const updated = await fetchLocationById(id);
    if (!updated) throw new Error("Location not found after update.");
    return { location: updated, isDemoMode: false };
  }

  // Dev/local fallback
  const store = loadLocalStore();
  const idx = store.locations.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("Location not found.");

  const existing = store.locations[idx];
  const updated: MemoryLocationRecord = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
    longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
    address: input.address !== undefined ? input.address : existing.address,
    city: input.city !== undefined ? input.city : existing.city,
    region: input.region !== undefined ? input.region : existing.region,
    country: input.country !== undefined ? input.country : existing.country,
    description: input.description !== undefined ? input.description : existing.description,
    updatedAt: new Date().toISOString(),
  };

  store.locations[idx] = updated;

  if (input.memoryIds !== undefined) {
    store.links = store.links.filter((l) => l.locationId !== id);
    const now = new Date().toISOString();
    for (const memId of input.memoryIds) {
      store.links.push({
        id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        locationId: id,
        memoryId: memId,
        createdAt: now,
      });
    }
  }

  saveLocalStore(store);
  const enriched = await fetchLocationById(id);
  return { location: enriched || updated, isDemoMode: true };
}

export async function deleteLocationRecord(id: string): Promise<{
  success: boolean;
  isDemoMode: boolean;
}> {
  const auth = await getAuthContext();

  if (!auth.isDemoMode && auth.spaceId) {
    const supabase: any = await getSupabaseServerClient();
    // Deleting the location record cascade-deletes memory_location_links,
    // leaving all memories completely untouched.
    const { error } = await supabase
      .from("memory_locations")
      .delete()
      .eq("id", id)
      .eq("space_id", auth.spaceId);

    if (error) throw error;
    return { success: true, isDemoMode: false };
  }

  // Dev/local fallback
  const store = loadLocalStore();
  store.locations = store.locations.filter((l) => l.id !== id);
  store.links = store.links.filter((l) => l.locationId !== id);
  saveLocalStore(store);

  return { success: true, isDemoMode: true };
}
