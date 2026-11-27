// ============================================================================
// House of Memories — Supabase-Backed Repository Layer
// ============================================================================

import {
  listAlbums as listLocalAlbums,
  getAlbumById as getLocalAlbumById,
  createAlbum as createLocalAlbum,
  updateAlbum as updateLocalAlbum,
  deleteAlbum as deleteLocalAlbum,
  addMemoriesToAlbum as addLocalMemoriesToAlbum,
  removeMemoryFromAlbum as removeLocalMemoryFromAlbum,
  listAllMemories as listLocalMemories,
  createMemory as createLocalMemory,
  getTotalArchiveStats as getLocalArchiveStats,
  listAvailableMemoriesForSelection,
  AlbumRecord,
} from "@/lib/albums-store";
import { Memory } from "@/lib/sample-data";

async function getSupabaseServerClient(): Promise<any> {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

/**
 * Checks whether live Supabase credentials are configured in the environment.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    anonKey &&
    !url.includes("placeholder.supabase.co") &&
    !anonKey.includes("placeholder-anon-key")
  );
}

/**
 * Retrieves the authenticated user and their active memory space ID.
 * When running with live Supabase, enforces session validation.
 * In local dev mode without Supabase, returns mock session for seamless offline development.
 */
export async function getAuthContext() {
  if (!isSupabaseConfigured()) {
    return {
      isAuthenticated: true,
      userId: "local-dev-user",
      spaceId: "space-hom-main",
      isDemoMode: true,
    };
  }

  const supabase: any = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAuthenticated: false,
      userId: null,
      spaceId: null,
      isDemoMode: false,
    };
  }

  // Find user's space from space_members
  const { data: memberRow, error: memberError } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .single();

  if (memberError || !memberRow) {
    return {
      isAuthenticated: true,
      userId: user.id,
      spaceId: null, // User is authenticated but hasn't joined a memory space
      isDemoMode: false,
    };
  }

  return {
    isAuthenticated: true,
    userId: user.id,
    spaceId: memberRow.space_id,
    isDemoMode: false,
  };
}

// ----------------------------------------------------------------------------
// ALBUMS REPOSITORY
// ----------------------------------------------------------------------------

export async function fetchAlbums(options?: {
  search?: string;
  sort?: "newest" | "oldest" | "alphabetical" | "recently_updated";
}) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const albums = listLocalAlbums(options);
    const stats = getLocalArchiveStats(auth.spaceId || "space-hom-main");
    return {
      albums,
      totalAlbums: stats.totalAlbums,
      totalMemories: stats.totalMemories,
      isDemoMode: true,
    };
  }

  const supabase: any = await getSupabaseServerClient();
  let query = supabase
    .from("albums")
    .select(`
      id,
      space_id,
      title,
      description,
      cover_image_url,
      cover_memory_id,
      is_favorite,
      created_by,
      created_at,
      updated_at,
      album_memories (
        memory_id
      )
    `)
    .eq("space_id", auth.spaceId);

  if (options?.search) {
    query = query.ilike("title", `%${options.search}%`);
  }

  if (options?.sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (options?.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (options?.sort === "alphabetical") {
    query = query.order("title", { ascending: true });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  const albums: AlbumRecord[] = (data || []).map((row: any) => ({
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description,
    coverMemoryId: row.cover_memory_id,
    coverImageUrl: row.cover_image_url || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    createdBy: row.created_by,
    isFavorite: row.is_favorite ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memoryCount: row.album_memories?.length || 0,
    previewImages: [],
  }));

  // Total memories across the space
  const { count: memoryCount } = await supabase
    .from("memories")
    .select("*", { count: "exact", head: true })
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  return {
    albums,
    totalAlbums: albums.length,
    totalMemories: memoryCount || 0,
    isDemoMode: false,
  };
}

export async function fetchAlbumById(albumId: string) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const album = getLocalAlbumById(albumId);
    return { album, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const { data: albumRow, error: albumError } = await supabase
    .from("albums")
    .select(`
      id,
      space_id,
      title,
      description,
      cover_image_url,
      cover_memory_id,
      is_favorite,
      created_by,
      created_at,
      updated_at
    `)
    .eq("id", albumId)
    .eq("space_id", auth.spaceId)
    .single();

  if (albumError || !albumRow) return { album: null, isDemoMode: false };

  // Fetch memories associated with this album via junction table
  const { data: junctionRows } = await supabase
    .from("album_memories")
    .select(`
      memory_id,
      memories:memory_id (
        id,
        title,
        caption,
        captured_at,
        created_at,
        is_favorite,
        created_by,
        memory_media (
          storage_path,
          media_type
        )
      )
    `)
    .eq("album_id", albumId);

  const memories: Memory[] = (junctionRows || [])
    .filter((j: any) => j.memories)
    .map((j: any) => {
      const m = j.memories;
      const media = m.memory_media?.[0];
      return {
        id: m.id,
        title: m.title || "Untitled",
        caption: m.caption || "",
        story: "",
        date: m.captured_at ? new Date(m.captured_at).toISOString().split("T")[0] : "",
        capturedAt: m.captured_at || m.created_at,
        location: "Our Sanctuary",
        imageUrl: media?.storage_path || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        mediaType: media?.media_type || "image",
        tag: "Album",
        isFavorite: m.is_favorite,
        author: m.created_by,
      };
    });

  const albumRecord: AlbumRecord & { memories: Memory[] } = {
    id: albumRow.id,
    spaceId: albumRow.space_id,
    title: albumRow.title,
    description: albumRow.description,
    coverMemoryId: albumRow.cover_memory_id,
    coverImageUrl: albumRow.cover_image_url || (memories[0]?.imageUrl ?? "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80"),
    createdBy: albumRow.created_by,
    isFavorite: albumRow.is_favorite,
    createdAt: albumRow.created_at,
    updatedAt: albumRow.updated_at,
    memoryCount: memories.length,
    previewImages: memories.slice(0, 3).map((m) => m.imageUrl),
    contributors: ["Alex", "Maya"],
    memories,
  };

  return { album: albumRecord, isDemoMode: false };
}

export async function createAlbumRecord(data: {
  title: string;
  description?: string;
  coverImageUrl?: string;
  createdBy?: string;
}) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const album = createLocalAlbum(data);
    return { album, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("albums")
    .insert({
      space_id: auth.spaceId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      cover_image_url: data.coverImageUrl || null,
      created_by: auth.userId!,
    })
    .select()
    .single();

  if (error) throw error;
  return { album: inserted, isDemoMode: false };
}

export async function updateAlbumRecord(
  albumId: string,
  data: {
    title?: string;
    description?: string | null;
    coverImageUrl?: string;
    isFavorite?: boolean;
  }
) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const album = updateLocalAlbum(albumId, data);
    return { album, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.coverImageUrl !== undefined) updatePayload.cover_image_url = data.coverImageUrl;
  if (data.isFavorite !== undefined) updatePayload.is_favorite = data.isFavorite;

  const { data: updated, error } = await supabase
    .from("albums")
    .update(updatePayload)
    .eq("id", albumId)
    .eq("space_id", auth.spaceId)
    .select()
    .single();

  if (error) throw error;
  return { album: updated, isDemoMode: false };
}

export async function deleteAlbumRecord(albumId: string) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const ok = deleteLocalAlbum(albumId);
    return { success: ok, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  // Deleting album cascades to album_memories junction table; original memories remain safely preserved.
  const { error } = await supabase
    .from("albums")
    .delete()
    .eq("id", albumId)
    .eq("space_id", auth.spaceId);

  if (error) throw error;
  return { success: true, isDemoMode: false };
}

export async function linkMemoriesToAlbum(albumId: string, memoryIds: string[]) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const result = addLocalMemoriesToAlbum(albumId, memoryIds);
    return { ...result, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();

  // Cross-space relationship verification:
  // Ensure all memoryIds belong strictly to the user's space before adding to the album!
  const { data: validMemories, error: verifyError } = await supabase
    .from("memories")
    .select("id")
    .eq("space_id", auth.spaceId)
    .in("id", memoryIds);

  if (verifyError) throw verifyError;
  const verifiedIds = (validMemories || []).map((m: any) => m.id);

  if (verifiedIds.length === 0) {
    return { addedCount: 0, duplicateCount: 0, isDemoMode: false };
  }

  const recordsToInsert = verifiedIds.map((memId: string) => ({
    album_id: albumId,
    memory_id: memId,
    added_by: auth.userId!,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("album_memories")
    .upsert(recordsToInsert, { onConflict: "album_id,memory_id", ignoreDuplicates: true })
    .select();

  if (insertError) throw insertError;

  return {
    addedCount: inserted?.length || 0,
    duplicateCount: verifiedIds.length - (inserted?.length || 0),
    isDemoMode: false,
  };
}

export async function unlinkMemoryFromAlbum(albumId: string, memoryId: string) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const ok = removeLocalMemoryFromAlbum(albumId, memoryId);
    return { success: ok, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const { error } = await supabase
    .from("album_memories")
    .delete()
    .eq("album_id", albumId)
    .eq("memory_id", memoryId);

  if (error) throw error;
  return { success: true, isDemoMode: false };
}

// ----------------------------------------------------------------------------
// MEMORIES REPOSITORY
// ----------------------------------------------------------------------------

export async function fetchAllMemories() {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const memories = listLocalMemories();
    return { memories, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("memories")
    .select(`
      id,
      title,
      caption,
      captured_at,
      created_at,
      is_favorite,
      created_by,
      memory_media (
        storage_path,
        media_type
      )
    `)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const memories: Memory[] = (data || []).map((m: any) => {
    const media = m.memory_media?.[0];
    return {
      id: m.id,
      title: m.title || "Untitled",
      caption: m.caption || "",
      story: "",
      date: m.captured_at ? new Date(m.captured_at).toISOString().split("T")[0] : "",
      capturedAt: m.captured_at || m.created_at,
      location: "Our Sanctuary",
      imageUrl: media?.storage_path || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      mediaType: media?.media_type || "image",
      tag: "Memory",
      isFavorite: m.is_favorite,
      author: m.created_by,
    };
  });

  return { memories, isDemoMode: false };
}

export async function insertMemoryRecord(data: Partial<Memory>) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const memory = createLocalMemory(data);
    return { memory, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("memories")
    .insert({
      space_id: auth.spaceId,
      title: data.title || null,
      caption: data.caption || null,
      captured_at: data.capturedAt || new Date().toISOString(),
      created_by: auth.userId!,
      is_favorite: data.isFavorite || false,
    })
    .select()
    .single();

  if (error) throw error;

  // If media URL is provided, record it in memory_media
  if (data.imageUrl) {
    await supabase.from("memory_media").insert({
      memory_id: inserted.id,
      storage_path: data.imageUrl,
      media_type: data.mediaType || "image",
      mime_type: data.mediaType === "video" ? "video/mp4" : "image/jpeg",
      file_size_bytes: 0,
      bucket: "memories",
    });
  }

  return { memory: inserted, isDemoMode: false };
}

export async function fetchAvailableMemoriesForAlbum(albumId: string) {
  const auth = await getAuthContext();

  if (auth.isDemoMode || !auth.spaceId) {
    const items = listAvailableMemoriesForSelection(albumId);
    return { items, isDemoMode: true };
  }

  const supabase: any = await getSupabaseServerClient();

  // 1. Fetch all memories in the user's space
  const { data: allMemories, error: memError } = await supabase
    .from("memories")
    .select(`
      id,
      title,
      caption,
      captured_at,
      created_at,
      is_favorite,
      created_by,
      memory_media (
        storage_path,
        media_type
      )
    `)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (memError) throw memError;

  // 2. Fetch existing relations for this album
  const { data: existingLinks } = await supabase
    .from("album_memories")
    .select("memory_id")
    .eq("album_id", albumId);

  const linkedSet = new Set((existingLinks || []).map((l: any) => l.memory_id));

  const items = (allMemories || []).map((m: any) => {
    const media = m.memory_media?.[0];
    const memoryObj: Memory = {
      id: m.id,
      title: m.title || "Untitled",
      caption: m.caption || "",
      story: "",
      date: m.captured_at ? new Date(m.captured_at).toISOString().split("T")[0] : "",
      capturedAt: m.captured_at || m.created_at,
      location: "Our Sanctuary",
      imageUrl: media?.storage_path || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      mediaType: media?.media_type || "image",
      tag: "Memory",
      isFavorite: m.is_favorite,
      author: m.created_by,
    };
    return {
      memory: memoryObj,
      isAlreadyInAlbum: linkedSet.has(m.id),
    };
  });

  return { items, isDemoMode: false };
}
