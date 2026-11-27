"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookImage,
  Plus,
  Search,
  Filter,
  Heart,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
  Upload,
  Check,
  X,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { AlbumRecord, AlbumSortOption } from "@/lib/albums-store";
import { Memory } from "@/lib/sample-data";

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<AlbumSortOption>("recently_updated");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedCoverUrl, setSelectedCoverUrl] = useState("");
  const [availableMemories, setAvailableMemories] = useState<Memory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch albums
  const fetchAlbums = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("sort", sortOption);

      const res = await fetch(`/api/albums?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load albums");
      const data = await res.json();
      setAlbums(data.albums || []);
      setTotalMemories(data.totalMemories || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load albums");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, [searchQuery, sortOption]);

  // Load available memories for cover selection when modal opens
  useEffect(() => {
    if (showCreateModal) {
      fetch("/api/memories/available")
        .then((r) => r.json())
        .then((data) => {
          if (data.items) {
            setAvailableMemories(data.items.map((i: any) => i.memory));
            if (!selectedCoverUrl && data.items.length > 0) {
              setSelectedCoverUrl(data.items[0].memory.imageUrl);
            }
          }
        })
        .catch(console.error);
    }
  }, [showCreateModal]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError("Album title is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setCreateError(null);
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          coverImageUrl: selectedCoverUrl,
          createdBy: "Alex",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create album");

      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setSelectedCoverUrl("");
      fetchAlbums();
    } catch (err: any) {
      setCreateError(err?.message || "Error creating album");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFavorite = async (albumId: string, currentFav: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic UI update
    setAlbums((prev) =>
      prev.map((a) => (a.id === albumId ? { ...a, isFavorite: !currentFav } : a))
    );

    try {
      await fetch(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !currentFav }),
      });
    } catch (err) {
      console.error("Failed to update album favorite:", err);
      fetchAlbums();
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-16 max-w-6xl mx-auto">
      {/* 1. Header Bar with Stats & Create Button */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-plum/10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blush/70 text-plum text-xs font-medium">
            <BookImage className="w-3.5 h-3.5 text-plum/70" />
            <span>Shared Collections</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-plum tracking-tight">
            Our Albums
          </h1>

          <p className="text-xs sm:text-sm text-plum/70 font-sans max-w-xl">
            Curated chapters of our shared story. Memories can belong to multiple albums across our space.
          </p>

          <div className="flex items-center gap-4 text-xs text-plum/60 pt-1 font-medium">
            <span>
              <strong className="text-plum font-serif text-sm">{albums.length}</strong> {albums.length === 1 ? "Album" : "Albums"}
            </span>
            <span>·</span>
            <span>
              <strong className="text-plum font-serif text-sm">{totalMemories}</strong> Moments Preserved
            </span>
          </div>
        </div>

        {/* Create Album Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-paper hover:shadow-float active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Album</span>
          </button>
        </div>
      </section>

      {/* 2. Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-plum/40 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search albums..."
            className="w-full px-3.5 py-1.5 pl-9 rounded-full bg-white border border-plum/15 text-xs text-plum placeholder:text-plum/40 focus:outline-none focus:ring-2 focus:ring-plum/20 transition-all shadow-paper"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-plum/70">
          <span className="font-medium text-[11px] uppercase tracking-wider text-plum/50">Sort by:</span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as AlbumSortOption)}
            className="px-3.5 py-1.5 rounded-full bg-white border border-plum/15 text-xs text-plum font-medium shadow-paper focus:outline-none focus:ring-2 focus:ring-plum/20 cursor-pointer"
          >
            <option value="recently_updated">Recently Updated</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* 3. Albums Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-plum/50 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-medium">Gathering our albums...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-red-50 border border-red-200 text-center text-red-700 text-sm space-y-2">
          <p className="font-semibold">Unable to load albums</p>
          <p className="text-xs">{error}</p>
          <button
            onClick={fetchAlbums}
            className="mt-2 px-4 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium"
          >
            Try Again
          </button>
        </div>
      ) : albums.length === 0 ? (
        /* Empty State */
        <div className="py-20 bg-white rounded-3xl border border-plum/10 p-8 text-center space-y-4 shadow-paper max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-blush mx-auto flex items-center justify-center text-plum shadow-sm">
            <BookImage className="w-7 h-7 text-plum/70" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-xl font-bold text-plum">No Albums Found</h3>
            <p className="text-xs text-plum/60 font-sans">
              {searchQuery ? "No albums match your search query." : "Our shared collections are waiting to be started."}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light text-xs font-semibold shadow-paper"
          >
            Create Your First Album
          </button>
        </div>
      ) : (
        /* Album Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {albums.map((album) => {
            return (
              <Link
                key={album.id}
                href={`/albums/${album.id}`}
                className="group block"
              >
                {/* Physical Scrapbook Photo Stack Container */}
                <div className="photo-stack mb-4 aspect-[4/3] rounded-2xl overflow-hidden relative border border-plum/10 shadow-paper group-hover:shadow-float transition-all bg-cream-300">
                  <Image
                    src={album.coverImageUrl}
                    alt={album.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 360px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-plum/70 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                  {/* Top Bar Badges: Favorite & Contributor Badge */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-white/90 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      by {album.contributors?.join(" & ") || album.createdBy}
                    </span>

                    <button
                      onClick={(e) => toggleFavorite(album.id, album.isFavorite, e)}
                      className="p-1.5 rounded-full bg-white/80 hover:bg-white text-plum shadow-sm transition-all"
                      title={album.isFavorite ? "Remove favorite" : "Mark as favorite"}
                    >
                      <Heart
                        className={cn(
                          "w-3.5 h-3.5 transition-colors",
                          album.isFavorite ? "fill-plum text-plum" : "text-plum/50"
                        )}
                      />
                    </button>
                  </div>

                  {/* Bottom Info: Memory Count */}
                  <div className="absolute bottom-3 left-3 text-white flex items-center gap-2">
                    <span className="text-xs font-semibold bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{album.memoryCount || 0} {album.memoryCount === 1 ? "moment" : "moments"}</span>
                    </span>
                  </div>
                </div>

                {/* Album Details */}
                <div className="space-y-1 px-1">
                  <div className="flex items-center justify-between text-[11px] text-plum/50 font-sans">
                    <span>Updated {formatRelativeTime(album.updatedAt)}</span>
                    <span className="font-handwriting text-xs text-plum/70">Shared</span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-plum group-hover:text-plum-light transition-colors">
                    {album.title}
                  </h3>

                  {album.description && (
                    <p className="text-xs text-plum/70 font-sans line-clamp-2 leading-relaxed">
                      {album.description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 4. Create Album Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float space-y-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center text-plum shadow-sm">
                  <FolderPlus className="w-4 h-4 text-plum" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-plum">Create New Album</h3>
                  <p className="text-xs text-plum/60 font-sans">
                    Start a shared photo collection for the two of you.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-plum/50 hover:text-plum text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Creation Form */}
            <form onSubmit={handleCreateAlbum} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-1.5">
                  Album Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Summer by the Lake, Silly Moments"
                  className="w-full px-4 py-2.5 rounded-xl bg-cream/50 border border-plum/15 text-sm text-plum focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A short note about what this collection holds..."
                  className="w-full px-4 py-2 rounded-xl bg-cream/50 border border-plum/15 text-xs text-plum focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              {/* Cover Photo Selection from Existing Memories */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-2">
                  Choose Cover Photograph
                </label>

                {availableMemories.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2.5 max-h-40 overflow-y-auto p-1 bg-cream/30 rounded-2xl border border-plum/10">
                    {availableMemories.map((mem) => {
                      const isSelected = selectedCoverUrl === mem.imageUrl;
                      return (
                        <div
                          key={mem.id}
                          onClick={() => setSelectedCoverUrl(mem.imageUrl)}
                          className={cn(
                            "aspect-square rounded-xl overflow-hidden relative cursor-pointer border-2 transition-all",
                            isSelected
                              ? "border-plum ring-2 ring-blush scale-95"
                              : "border-transparent opacity-70 hover:opacity-100"
                          )}
                        >
                          <Image
                            src={mem.imageUrl}
                            alt={mem.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-plum/30 flex items-center justify-center text-white">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-plum/50 italic">No memories found to select.</p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-plum/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70 hover:text-plum hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-medium shadow-paper flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Collection</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
