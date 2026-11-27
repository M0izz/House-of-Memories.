// ============================================================================
// House of Memories — Albums & Shared Collections Service
// ============================================================================

import { SAMPLE_MEMORIES } from "./sample-data";
import type { Memory } from "./sample-data";

export interface AlbumRecord {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  coverMemoryId: string | null;
  coverImageUrl: string;
  createdBy: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  memoryCount?: number;
  previewImages?: string[];
  contributors?: string[];
}

export interface AlbumMemoryRecord {
  id: string;
  albumId: string;
  memoryId: string;
  addedBy: string;
  createdAt: string;
}

// In-memory persistent state (persists across hot-reloads and API calls in local Node environment)
interface AlbumsDataStore {
  albums: AlbumRecord[];
  albumMemories: AlbumMemoryRecord[];
  memories: Memory[];
}

declare global {
  // eslint-disable-next-line no-var
  var __homAlbumsDataStore: AlbumsDataStore | undefined;
}

function initializeStore(): AlbumsDataStore {
  if (global.__homAlbumsDataStore) {
    return global.__homAlbumsDataStore;
  }

  const initialMemories: Memory[] = [...SAMPLE_MEMORIES];

  const initialAlbums: AlbumRecord[] = [
    {
      id: "alb-1",
      spaceId: "space-hom-main",
      title: "Road Trips & Detours",
      description: "Every scenic overlook, gas station snack break, and unscripted side road.",
      coverMemoryId: "mem-1",
      coverImageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
      createdBy: "Alex",
      isFavorite: true,
      createdAt: "2024-04-15T10:00:00Z",
      updatedAt: "2024-10-20T14:30:00Z",
    },
    {
      id: "alb-2",
      spaceId: "space-hom-main",
      title: "Coffee Shops & Rainy Days",
      description: "Quiet afternoons hiding from rainstorms with books, sketchpads, and warm mugs.",
      coverMemoryId: "mem-2",
      coverImageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80",
      createdBy: "Maya",
      isFavorite: false,
      createdAt: "2024-05-02T11:20:00Z",
      updatedAt: "2024-11-24T16:00:00Z",
    },
    {
      id: "alb-3",
      spaceId: "space-hom-main",
      title: "Silly Moments & Inside Jokes",
      description: "Late night laughter, terrible baking attempts, and candid snapshots.",
      coverMemoryId: "mem-3",
      coverImageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
      createdBy: "Alex",
      isFavorite: true,
      createdAt: "2024-06-10T09:15:00Z",
      updatedAt: "2024-08-04T02:30:00Z",
    },
  ];

  // Pre-seed many-to-many relationships
  const initialAlbumMemories: AlbumMemoryRecord[] = [
    // Album 1 (Road Trips)
    { id: "am-1", albumId: "alb-1", memoryId: "mem-1", addedBy: "Alex", createdAt: "2024-10-18T18:00:00Z" },
    { id: "am-2", albumId: "alb-1", memoryId: "mem-4", addedBy: "Maya", createdAt: "2024-07-19T10:00:00Z" },

    // Album 2 (Coffee Shops)
    { id: "am-3", albumId: "alb-2", memoryId: "mem-2", addedBy: "Maya", createdAt: "2024-11-24T15:00:00Z" },
    { id: "am-4", albumId: "alb-2", memoryId: "mem-5", addedBy: "Alex", createdAt: "2024-05-14T15:30:00Z" },

    // Album 3 (Inside Jokes & Silly Moments)
    { id: "am-5", albumId: "alb-3", memoryId: "mem-3", addedBy: "Alex", createdAt: "2024-08-03T03:00:00Z" },
    { id: "am-6", albumId: "alb-3", memoryId: "mem-2", addedBy: "Maya", createdAt: "2024-11-24T15:10:00Z" }, // mem-2 belongs to both Album 2 AND Album 3!
  ];

  const store: AlbumsDataStore = {
    albums: initialAlbums,
    albumMemories: initialAlbumMemories,
    memories: initialMemories,
  };

  global.__homAlbumsDataStore = store;
  return store;
}

const store = initializeStore();

export type AlbumSortOption = "newest" | "oldest" | "recently_updated" | "alphabetical";

export function listAlbums(options?: {
  search?: string;
  sort?: AlbumSortOption;
  spaceId?: string;
}): AlbumRecord[] {
  const currentStore = initializeStore();
  const spaceId = options?.spaceId || "space-hom-main";

  let list = currentStore.albums.filter((a) => a.spaceId === spaceId);

  // Search filter
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
    );
  }

  // Populate dynamic counts, preview images, and contributors
  const enriched = list.map((album) => {
    const relations = currentStore.albumMemories.filter((am) => am.albumId === album.id);
    const relatedMemories = relations
      .map((am) => currentStore.memories.find((m) => m.id === am.memoryId))
      .filter((m): m is Memory => !!m);

    const contributors = Array.from(new Set([album.createdBy, ...relations.map((r) => r.addedBy)]));

    const previewImages = relatedMemories.slice(0, 3).map((m) => m.imageUrl);
    const coverImageUrl =
      album.coverImageUrl ||
      relatedMemories[0]?.imageUrl ||
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80";

    return {
      ...album,
      coverImageUrl,
      memoryCount: relatedMemories.length,
      previewImages,
      contributors,
    };
  });

  // Sorting
  const sort = options?.sort || "recently_updated";
  enriched.sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "alphabetical":
        return a.title.localeCompare(b.title);
      case "recently_updated":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  return enriched;
}

export function getAlbumById(id: string, spaceId: string = "space-hom-main"): (AlbumRecord & { memories: Memory[] }) | null {
  const currentStore = initializeStore();
  const album = currentStore.albums.find((a) => a.id === id && a.spaceId === spaceId);
  if (!album) return null;

  const relations = currentStore.albumMemories.filter((am) => am.albumId === album.id);
  const relatedMemories = relations
    .map((am) => currentStore.memories.find((m) => m.id === am.memoryId))
    .filter((m): m is Memory => !!m);

  const contributors = Array.from(new Set([album.createdBy, ...relations.map((r) => r.addedBy)]));
  const coverImageUrl =
    album.coverImageUrl ||
    relatedMemories[0]?.imageUrl ||
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80";

  return {
    ...album,
    coverImageUrl,
    memoryCount: relatedMemories.length,
    previewImages: relatedMemories.slice(0, 3).map((m) => m.imageUrl),
    contributors,
    memories: relatedMemories,
  };
}

export function createAlbum(data: {
  title: string;
  description?: string;
  coverImageUrl?: string;
  coverMemoryId?: string;
  createdBy?: string;
  spaceId?: string;
}): AlbumRecord {
  const currentStore = initializeStore();
  const id = `alb-${Date.now()}`;
  const now = new Date().toISOString();

  const newAlbum: AlbumRecord = {
    id,
    spaceId: data.spaceId || "space-hom-main",
    title: data.title.trim(),
    description: data.description?.trim() || null,
    coverMemoryId: data.coverMemoryId || null,
    coverImageUrl:
      data.coverImageUrl ||
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    createdBy: data.createdBy || "Alex",
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    memoryCount: 0,
    previewImages: [],
    contributors: [data.createdBy || "Alex"],
  };

  currentStore.albums.unshift(newAlbum);
  return newAlbum;
}

export function updateAlbum(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    coverImageUrl?: string;
    coverMemoryId?: string;
    isFavorite?: boolean;
  },
  spaceId: string = "space-hom-main"
): AlbumRecord | null {
  const currentStore = initializeStore();
  const idx = currentStore.albums.findIndex((a) => a.id === id && a.spaceId === spaceId);
  if (idx === -1) return null;

  const existing = currentStore.albums[idx];
  const updated: AlbumRecord = {
    ...existing,
    title: data.title !== undefined ? data.title.trim() : existing.title,
    description: data.description !== undefined ? data.description : existing.description,
    coverImageUrl: data.coverImageUrl !== undefined ? data.coverImageUrl : existing.coverImageUrl,
    coverMemoryId: data.coverMemoryId !== undefined ? data.coverMemoryId : existing.coverMemoryId,
    isFavorite: data.isFavorite !== undefined ? data.isFavorite : existing.isFavorite,
    updatedAt: new Date().toISOString(),
  };

  currentStore.albums[idx] = updated;
  return updated;
}

export function deleteAlbum(id: string, spaceId: string = "space-hom-main"): boolean {
  const currentStore = initializeStore();
  const idx = currentStore.albums.findIndex((a) => a.id === id && a.spaceId === spaceId);
  if (idx === -1) return false;

  // 1. Remove album from store
  currentStore.albums.splice(idx, 1);

  // 2. Cascade delete junction records from albumMemories
  currentStore.albumMemories = currentStore.albumMemories.filter((am) => am.albumId !== id);

  // NOTE: Original memories in currentStore.memories are intentionally preserved untouched!
  return true;
}

export function addMemoriesToAlbum(
  albumId: string,
  memoryIds: string[],
  addedBy: string = "Alex",
  spaceId: string = "space-hom-main"
): { addedCount: number; duplicateCount: number; album: AlbumRecord | null } {
  const currentStore = initializeStore();
  const album = currentStore.albums.find((a) => a.id === albumId && a.spaceId === spaceId);
  if (!album) return { addedCount: 0, duplicateCount: 0, album: null };

  let addedCount = 0;
  let duplicateCount = 0;
  const now = new Date().toISOString();

  for (const memoryId of memoryIds) {
    // Check if memory exists in space
    const memExists = currentStore.memories.some((m) => m.id === memoryId);
    if (!memExists) continue;

    // Check if relation already exists (Unique constraint prevention)
    const exists = currentStore.albumMemories.some(
      (am) => am.albumId === albumId && am.memoryId === memoryId
    );

    if (exists) {
      duplicateCount++;
    } else {
      currentStore.albumMemories.push({
        id: `am-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        albumId,
        memoryId,
        addedBy,
        createdAt: now,
      });
      addedCount++;
    }
  }

  album.updatedAt = now;
  return { addedCount, duplicateCount, album };
}

export function removeMemoryFromAlbum(
  albumId: string,
  memoryId: string,
  spaceId: string = "space-hom-main"
): boolean {
  const currentStore = initializeStore();
  const album = currentStore.albums.find((a) => a.id === albumId && a.spaceId === spaceId);
  if (!album) return false;

  const initialLen = currentStore.albumMemories.length;
  currentStore.albumMemories = currentStore.albumMemories.filter(
    (am) => !(am.albumId === albumId && am.memoryId === memoryId)
  );

  const removed = currentStore.albumMemories.length < initialLen;
  if (removed) {
    album.updatedAt = new Date().toISOString();
  }
  return removed;
}

export function listAvailableMemoriesForSelection(
  albumId: string,
  spaceId: string = "space-hom-main"
): { memory: Memory; isAlreadyInAlbum: boolean }[] {
  const currentStore = initializeStore();
  const inAlbumIds = new Set(
    currentStore.albumMemories.filter((am) => am.albumId === albumId).map((am) => am.memoryId)
  );

  return currentStore.memories.map((m) => ({
    memory: m,
    isAlreadyInAlbum: inAlbumIds.has(m.id),
  }));
}

export function getTotalArchiveStats(spaceId: string = "space-hom-main") {
  const currentStore = initializeStore();
  const totalAlbums = currentStore.albums.filter((a) => a.spaceId === spaceId).length;
  const totalMemories = currentStore.memories.length;
  return { totalAlbums, totalMemories };
}

export function listAllMemories(): Memory[] {
  const currentStore = initializeStore();
  return currentStore.memories;
}

export function createMemory(data: Partial<Memory>): Memory {
  const currentStore = initializeStore();
  const id = data.id || `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const newMemory: Memory = {
    id,
    title: data.title?.trim() || "Untitled Moment",
    caption: data.caption?.trim() || "A moment captured together.",
    story: data.story?.trim() || "Saved directly to House of Memories.",
    date: data.date || formattedDate,
    capturedAt: data.capturedAt || now.toISOString(),
    location: data.location?.trim() || "Our Sanctuary",
    imageUrl:
      data.imageUrl ||
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    mediaType: data.mediaType || "image",
    tag: data.tag || "Adventures",
    isFavorite: data.isFavorite || false,
    author: data.author || "Alex",
    rotation: data.rotation || "rotate-1",
  };

  currentStore.memories.unshift(newMemory);
  return newMemory;
}
