// ============================================================================
// House of Memories — Hardened Location Repository Layer
// ============================================================================
// Strict Production Persistence Rules:
// 1. In production, Supabase is the sole authoritative persistence layer.
// 2. Query/Connection failures throw explicit errors — NEVER silently falling back to .data.
// 3. Local persistence is strictly isolated to development/test when Supabase is unconfigured.
// 4. Memory linking operations are atomic — rolling back if any memory is invalid or cross-space.
// ============================================================================

import fs from "fs";
import path from "path";
import {
  isSupabaseConfigured,
  isProductionEnvironment,
  isLocalDevPersistenceAllowed,
  getAuthContext,
} from "./memory-repository.ts";
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
  return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0;
}

// ----------------------------------------------------------------------------
// Local Storage Persistence (Configurable & Test-Safe)
// ----------------------------------------------------------------------------
let customStoreDirectory: string | null = null;

export function setLocationStoreDirectory(dir: string | null) {
  customStoreDirectory = dir;
  global.__homLocationStore = undefined;
}

function getStoreFilePath(): string {
  const dir = customStoreDirectory || path.join(process.cwd(), ".data");
  return path.join(dir, "locations-store.json");
}

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

  const filePath = getStoreFilePath();
  try {
    if (typeof window === "undefined" && fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      global.__homLocationStore = parsed;
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load local locations store from disk:", err);
  }

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
      const filePath = getStoreFilePath();
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to save local locations store to disk:", err);
  }
}

async function getSupabaseServerClient(): Promise<any> {
  const { createClient } = await import("../supabase/server.ts");
  return createClient();
}

// ----------------------------------------------------------------------------
// Public Hardened Repository Methods
// ----------------------------------------------------------------------------

export async function fetchLocations(options?: {
  search?: string;
  isDemo?: boolean;
}): Promise<{
  locations: MemoryLocationRecord[];
  isDemoMode: boolean;
  unassignedSpace?: boolean;
}> {
  const auth = await getAuthContext();

  // If in production or live Supabase is configured
  if (!auth.isDemoMode) {
    if (!auth.isAuthenticated) {
      throw new Error("Authentication required: Please sign in to view memory locations.");
    }

    if (!auth.spaceId) {
      // User is authenticated but not yet a member of any memory space
      return { locations: [], isDemoMode: false, unassignedSpace: true };
    }

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
    if (error) {
      // NON-NEGOTIABLE: In production, fail closed! Never fall back to .data
      throw new Error(`Database query failed while fetching locations: ${error.message}`);
    }

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
  }

  // Explicit Local Dev Mode Only
  if (!isLocalDevPersistenceAllowed()) {
    throw new Error("Local persistence is strictly prohibited in production.");
  }

  const store = loadLocalStore();
  const currentSpaceId = auth.spaceId || "space-hom-main";
  let locs = store.locations.filter((l) => !l.spaceId || l.spaceId === currentSpaceId);

  if (options?.search) {
    const q = options.search.toLowerCase();
    locs = locs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.country && l.country.toLowerCase().includes(q))
    );
  }

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
  const auth = await getAuthContext();

  if (!auth.isDemoMode) {
    if (!auth.isAuthenticated || !auth.spaceId) {
      return null;
    }

    const supabase: any = await getSupabaseServerClient();
    const { data: row, error } = await supabase
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
      .eq("id", id)
      .eq("space_id", auth.spaceId)
      .single();

    if (error || !row) return null;

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
  }

  // Dev fallback
  const res = await fetchLocations();
  return res.locations.find((l) => l.id === id) || null;
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
    throw new Error(
      "Invalid geographic coordinates. Latitude must be between -90 and 90, longitude between -180 and 180."
    );
  }

  const auth = await getAuthContext();

  if (!auth.isDemoMode) {
    if (!auth.isAuthenticated) {
      throw new Error("Authentication required: Please sign in to create locations.");
    }
    if (!auth.spaceId) {
      throw new Error("Unauthorized: User does not belong to an active memory space.");
    }

    const supabase: any = await getSupabaseServerClient();

    // Use Atomic PostgreSQL Stored Procedure if available
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "create_location_atomic",
        {
          p_space_id: auth.spaceId,
          p_name: input.name.trim(),
          p_latitude: input.latitude,
          p_longitude: input.longitude,
          p_address: input.address?.trim() || null,
          p_city: input.city?.trim() || null,
          p_region: input.region?.trim() || null,
          p_country: input.country?.trim() || null,
          p_description: input.description?.trim() || null,
          p_memory_ids: input.memoryIds || null,
        }
      );

      if (!rpcError && rpcResult) {
        return {
          location: {
            id: rpcResult.id,
            spaceId: rpcResult.spaceId,
            name: rpcResult.name,
            latitude: Number(rpcResult.latitude),
            longitude: Number(rpcResult.longitude),
            address: rpcResult.address,
            city: rpcResult.city,
            region: rpcResult.region,
            country: rpcResult.country,
            description: rpcResult.description,
            createdBy: rpcResult.createdBy,
            createdAt: rpcResult.createdAt,
            updatedAt: rpcResult.updatedAt,
            memoryCount: rpcResult.memoryCount || 0,
          },
          isDemoMode: false,
        };
      }

      if (rpcError && !rpcError.message?.includes("function create_location_atomic") && !rpcError.message?.includes("does not exist")) {
        // Real validation or integrity error from the database trigger/function: throw immediately
        throw new Error(rpcError.message);
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes("does not exist")) {
        throw rpcErr;
      }
    }

    // Atomic application-level fallback for environments without RPC migration applied
    // 1. Verify that all requested memories exist and belong to auth.spaceId
    if (input.memoryIds && input.memoryIds.length > 0) {
      const { data: validMemories, error: memError } = await supabase
        .from("memories")
        .select("id")
        .in("id", input.memoryIds)
        .eq("space_id", auth.spaceId)
        .is("deleted_at", null);

      if (memError) {
        throw new Error(`Failed to validate memory links: ${memError.message}`);
      }

      if ((validMemories || []).length !== input.memoryIds.length) {
        throw new Error("Atomic rollback: One or more requested memories do not exist or belong to a different memory space.");
      }
    }

    // 2. Insert location record
    const { data: newLoc, error: locError } = await supabase
      .from("memory_locations")
      .insert({
        space_id: auth.spaceId,
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        country: input.country?.trim() || null,
        description: input.description?.trim() || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (locError) {
      throw new Error(`Database error creating location: ${locError.message}`);
    }

    // 3. Insert memory links
    if (input.memoryIds && input.memoryIds.length > 0) {
      const linkPayloads = input.memoryIds.map((memId) => ({
        location_id: newLoc.id,
        memory_id: memId,
      }));

      const { error: linkError } = await supabase
        .from("memory_location_links")
        .insert(linkPayloads);

      if (linkError) {
        // Clean up orphaned location to preserve atomicity
        await supabase.from("memory_locations").delete().eq("id", newLoc.id);
        throw new Error(`Atomic rollback: Failed to link memories to location: ${linkError.message}`);
      }
    }

    const created = await fetchLocationById(newLoc.id);
    if (!created) {
      throw new Error("Failed to retrieve created location record from database.");
    }
    return { location: created, isDemoMode: false };
  }

  // Local Dev Storage (Enforcing Atomic Link Validation)
  if (!isLocalDevPersistenceAllowed()) {
    throw new Error("Local persistence is strictly prohibited in production.");
  }

  const allMemories = listAllMemories();
  const validMemoryIds = new Set(allMemories.map((m) => m.id));

  // Atomic link validation: every memory must exist
  if (input.memoryIds && input.memoryIds.length > 0) {
    for (const memId of input.memoryIds) {
      if (!validMemoryIds.has(memId)) {
        throw new Error(`Atomic rollback: Memory ID ${memId} not found in current memory space.`);
      }
    }
  }

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

  if (!auth.isDemoMode) {
    if (!auth.isAuthenticated || !auth.spaceId) {
      throw new Error("Unauthorized: Caller is not a member of this memory space.");
    }

    const supabase: any = await getSupabaseServerClient();

    // Verify existing location belongs to caller's space
    const { data: existing, error: existError } = await supabase
      .from("memory_locations")
      .select("id, space_id")
      .eq("id", id)
      .eq("space_id", auth.spaceId)
      .single();

    if (existError || !existing) {
      throw new Error("Location not found or access denied.");
    }

    // Try Atomic RPC
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "update_location_atomic",
        {
          p_location_id: id,
          p_name: input.name?.trim() || null,
          p_latitude: input.latitude ?? null,
          p_longitude: input.longitude ?? null,
          p_address: input.address !== undefined ? input.address : null,
          p_city: input.city !== undefined ? input.city : null,
          p_region: input.region !== undefined ? input.region : null,
          p_country: input.country !== undefined ? input.country : null,
          p_description: input.description !== undefined ? input.description : null,
          p_memory_ids: input.memoryIds || null,
          p_sync_memories: input.memoryIds !== undefined,
        }
      );

      if (!rpcError && rpcResult) {
        return {
          location: {
            id: rpcResult.id,
            spaceId: rpcResult.spaceId,
            name: rpcResult.name,
            latitude: Number(rpcResult.latitude),
            longitude: Number(rpcResult.longitude),
            address: rpcResult.address,
            city: rpcResult.city,
            region: rpcResult.region,
            country: rpcResult.country,
            description: rpcResult.description,
            createdBy: rpcResult.createdBy,
            createdAt: rpcResult.createdAt,
            updatedAt: rpcResult.updatedAt,
            memoryCount: rpcResult.memoryCount || 0,
          },
          isDemoMode: false,
        };
      }

      if (rpcError && !rpcError.message?.includes("does not exist")) {
        throw new Error(rpcError.message);
      }
    } catch (rpcErr: any) {
      if (rpcErr.message && !rpcErr.message.includes("does not exist")) {
        throw rpcErr;
      }
    }

    // Fallback atomic updates
    if (input.memoryIds !== undefined && input.memoryIds.length > 0) {
      const { data: validMemories, error: memError } = await supabase
        .from("memories")
        .select("id")
        .in("id", input.memoryIds)
        .eq("space_id", auth.spaceId)
        .is("deleted_at", null);

      if (memError || (validMemories || []).length !== input.memoryIds.length) {
        throw new Error("Atomic rollback: One or more requested memories do not belong to your memory space.");
      }
    }

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

    if (input.memoryIds !== undefined) {
      await supabase.from("memory_location_links").delete().eq("location_id", id);
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

  // Local Dev Storage
  const store = loadLocalStore();
  const idx = store.locations.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("Location not found.");

  if (input.memoryIds !== undefined && input.memoryIds.length > 0) {
    const allMemories = listAllMemories();
    const validMemoryIds = new Set(allMemories.map((m) => m.id));
    for (const memId of input.memoryIds) {
      if (!validMemoryIds.has(memId)) {
        throw new Error(`Atomic rollback: Memory ${memId} not found.`);
      }
    }
  }

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

  if (!auth.isDemoMode) {
    if (!auth.isAuthenticated || !auth.spaceId) {
      throw new Error("Unauthorized: Access denied.");
    }

    const supabase: any = await getSupabaseServerClient();
    // Verify location exists in caller's space
    const { data: existing, error: existError } = await supabase
      .from("memory_locations")
      .select("id")
      .eq("id", id)
      .eq("space_id", auth.spaceId)
      .single();

    if (existError || !existing) {
      throw new Error("Location not found or access denied.");
    }

    // Cascade delete: removes location and memory_location_links;
    // memories themselves are never touched!
    const { error: delError } = await supabase
      .from("memory_locations")
      .delete()
      .eq("id", id)
      .eq("space_id", auth.spaceId);

    if (delError) {
      throw new Error(`Failed to delete location: ${delError.message}`);
    }

    return { success: true, isDemoMode: false };
  }

  // Local Dev Storage
  const store = loadLocalStore();
  const locIndex = store.locations.findIndex((l) => l.id === id);
  if (locIndex === -1) {
    throw new Error("Location not found.");
  }

  store.locations.splice(locIndex, 1);
  store.links = store.links.filter((l) => l.locationId !== id);
  saveLocalStore(store);

  return { success: true, isDemoMode: true };
}
