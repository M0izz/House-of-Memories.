"use client";

import { useState, useEffect, useRef, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Heart,
  Calendar,
  Layers,
  MapPin,
  Upload,
  Check,
  X,
  Camera,
  Play,
  Volume2,
  Loader2,
  FolderPlus,
  Share2,
  Files,
  FolderUp,
} from "lucide-react";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { AlbumRecord } from "@/lib/albums-store";
import { Memory } from "@/lib/sample-data";

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [album, setAlbum] = useState<(AlbumRecord & { memories: Memory[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewerMemory, setViewerMemory] = useState<Memory | null>(null);

  // Edit album state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Add existing memories state
  const [activeTab, setActiveTab] = useState<"existing" | "upload">("existing");
  const [availableItems, setAvailableItems] = useState<{ memory: Memory; isAlreadyInAlbum: boolean }[]>([]);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [isAddingMemories, setIsAddingMemories] = useState(false);

  // Direct File and Folder Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [queuedFiles, setQueuedFiles] = useState<{
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    folderPath?: string;
    mediaType: "image" | "video" | "audio";
  }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const getMediaType = (file: File): "image" | "video" | "audio" => {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "image";
  };

  const processFiles = (files: File[], folderPrefix?: string) => {
    const newItems = files.map((file) => {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";
      return {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        previewUrl,
        name: file.name,
        folderPath: (file as any).webkitRelativePath || folderPrefix || undefined,
        mediaType: getMediaType(file),
      };
    });

    setQueuedFiles((prev) => [...prev, ...newItems]);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const traverseFileTree = async (item: any, path = ""): Promise<File[]> => {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file: File) => {
          (file as any).relativePath = path + file.name;
          resolve([file]);
        });
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        const allEntries: any[] = [];
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length === 0) {
              const filePromises = allEntries.map((e) =>
                traverseFileTree(e, `${path}${item.name}/`)
              );
              const nestedFiles = await Promise.all(filePromises);
              resolve(nestedFiles.flat());
            } else {
              allEntries.push(...entries);
              readEntries();
            }
          });
        };
        readEntries();
      } else {
        resolve([]);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entryPromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            entryPromises.push(traverseFileTree(entry));
          } else {
            const file = item.getAsFile();
            if (file) entryPromises.push(Promise.resolve([file]));
          }
        }
      }

      const fileArrays = await Promise.all(entryPromises);
      const allFiles = fileArrays.flat();
      if (allFiles.length > 0) {
        processFiles(allFiles);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeQueuedFile = (fileId: string) => {
    setQueuedFiles((prev) => {
      const item = prev.find((i) => i.id === fileId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== fileId);
    });
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUploadDirectToAlbum = async () => {
    if (queuedFiles.length === 0) return;

    try {
      setIsUploading(true);
      const itemsToUpload: Partial<Memory>[] = [];

      for (const qf of queuedFiles) {
        let imageUrl = qf.previewUrl;
        if (qf.mediaType === "image") {
          imageUrl = await fileToDataUrl(qf.file);
        } else {
          imageUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80";
        }

        const titleFromName = qf.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        itemsToUpload.push({
          title: titleFromName,
          caption: qf.folderPath ? `From folder: ${qf.folderPath}` : `Uploaded directly to ${album?.title || "Album"}`,
          story: qf.folderPath ? `Organized from directory: ${qf.folderPath}` : "Cherished moment captured together.",
          location: "Shared Memories",
          imageUrl,
          tag: "Album Upload",
          mediaType: qf.mediaType,
          isFavorite: false,
          author: "Both of Us",
        });
      }

      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToUpload }),
      });

      if (!res.ok) throw new Error("Failed to upload files");
      const data = await res.json();
      const createdIds = data.memories ? data.memories.map((m: any) => m.id) : [];

      if (createdIds.length > 0) {
        await fetch(`/api/albums/${id}/memories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memoryIds: createdIds }),
        });
      }

      setQueuedFiles([]);
      setShowAddModal(false);
      fetchAlbum();
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchAlbum = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/albums/${id}`);
      if (!res.ok) throw new Error("Album not found");
      const data = await res.json();
      setAlbum(data.album);
      setEditTitle(data.album.title);
      setEditDescription(data.album.description || "");
      setEditCoverUrl(data.album.coverImageUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to load album");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbum();
  }, [id]);

  // Load available memories when add modal opens
  useEffect(() => {
    if (showAddModal) {
      fetch(`/api/memories/available?albumId=${id}`)
        .then((r) => r.json())
        .then((data) => {
          setAvailableItems(data.items || []);
          setSelectedMemoryIds([]);
        })
        .catch(console.error);
    }
  }, [showAddModal, id]);

  const handleEditAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsEditing(true);
      const res = await fetch(`/api/albums/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          coverImageUrl: editCoverUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to update album");
      setShowEditModal(false);
      fetchAlbum();
    } catch (err: any) {
      alert(err?.message || "Error updating album");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteAlbum = async () => {
    try {
      const res = await fetch(`/api/albums/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete album");
      router.push("/albums");
    } catch (err: any) {
      alert(err?.message || "Error deleting album");
    }
  };

  const handleAddSelectedMemories = async () => {
    if (selectedMemoryIds.length === 0) return;

    try {
      setIsAddingMemories(true);
      const res = await fetch(`/api/albums/${id}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryIds: selectedMemoryIds,
          addedBy: "Alex",
        }),
      });

      if (!res.ok) throw new Error("Failed to add memories");
      setShowAddModal(false);
      fetchAlbum();
    } catch (err: any) {
      alert(err?.message || "Error adding memories");
    } finally {
      setIsAddingMemories(false);
    }
  };

  const handleRemoveMemory = async (memoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this memory from the album? (The original memory will remain preserved in your archive).")) {
      return;
    }

    try {
      const res = await fetch(`/api/albums/${id}/memories/${memoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove memory");
      fetchAlbum();
    } catch (err: any) {
      alert(err?.message || "Error removing memory");
    }
  };

  const toggleSelectMemory = (memId: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(memId) ? prev.filter((i) => i !== memId) : [...prev, memId]
    );
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-plum/50 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs font-medium">Opening album memories...</p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          ✕
        </div>
        <h2 className="font-serif text-2xl font-bold text-plum">Album Not Found</h2>
        <p className="text-xs text-plum/60">This album may have been removed or does not exist.</p>
        <Link
          href="/albums"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-plum text-cream text-xs font-semibold shadow-paper"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Albums</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in pb-16 max-w-6xl mx-auto">
      {/* 1. Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/albums"
          className="inline-flex items-center gap-2 text-xs font-semibold text-plum/70 hover:text-plum group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Albums</span>
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs font-semibold shadow-paper"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Memories</span>
          </button>

          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-full bg-white hover:bg-cream border border-plum/15 text-plum/70 hover:text-plum shadow-sm transition-all"
            title="Edit Album Details"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-full bg-white hover:bg-red-50 border border-plum/15 text-red-600 hover:text-red-700 shadow-sm transition-all"
            title="Delete Album"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Album Hero Header Banner */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-paper relative overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="washi-tape washi-tape-blush" />

        {/* Cover Photo */}
        <div className="md:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden relative shadow-inner border border-plum/10 bg-cream-300">
          <Image
            src={album.coverImageUrl}
            alt={album.title}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
          />
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[11px] font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{album.memories?.length || 0} moments</span>
          </div>
        </div>

        {/* Album Meta */}
        <div className="md:col-span-7 space-y-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
              Shared Album
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
              {album.title}
            </h1>
          </div>

          {album.description && (
            <p className="font-handwriting text-xl text-plum/85 leading-relaxed">
              &ldquo;{album.description}&rdquo;
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-plum/60 border-t border-plum/10 font-sans">
            <div>
              <span className="text-plum/40 uppercase tracking-wider text-[10px] block">Created</span>
              <span className="font-medium text-plum/80">{formatDate(album.createdAt)}</span>
            </div>
            <div>
              <span className="text-plum/40 uppercase tracking-wider text-[10px] block">Contributors</span>
              <span className="font-medium text-plum/80">{album.contributors?.join(" & ") || album.createdBy}</span>
            </div>
            <div>
              <span className="text-plum/40 uppercase tracking-wider text-[10px] block">Last Activity</span>
              <span className="font-medium text-plum/80">{formatRelativeTime(album.updatedAt)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Memories Gallery Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-plum/10 pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-plum">Collection Gallery</h2>
            <p className="text-xs text-plum/60">
              Photographs, clips, and notes contained in this album.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-semibold text-plum hover:text-plum-light flex items-center gap-1 group"
          >
            <span>Add to album</span>
            <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {album.memories.length === 0 ? (
          /* Empty Album State */
          <div className="py-16 bg-white rounded-3xl border border-plum/10 p-8 text-center space-y-4 shadow-paper max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-cream-300 mx-auto flex items-center justify-center text-plum/40">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-plum">This Album is Empty</h3>
              <p className="text-xs text-plum/60">
                Add existing memories from your archive or upload new photographs directly into this collection.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light text-xs font-semibold shadow-paper"
            >
              Add Memories Now
            </button>
          </div>
        ) : (
          /* Memories Polaroid Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {album.memories.map((mem, idx) => {
              const rotations = ["-rotate-1", "rotate-1", "-rotate-0.5", "rotate-1.5", "-rotate-1.5"];
              const rot = mem.rotation || rotations[idx % rotations.length];

              return (
                <div
                  key={mem.id}
                  onClick={() => setViewerMemory(mem)}
                  className={cn(
                    "polaroid-card group cursor-pointer border border-plum/10 relative transition-all bg-white",
                    rot
                  )}
                >
                  {/* Photo area */}
                  <div className="aspect-[4/3] rounded-lg overflow-hidden relative mb-3 bg-cream-300 shadow-inner">
                    <Image
                      src={mem.imageUrl}
                      alt={mem.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 360px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Media Type Icon */}
                    {mem.mediaType === "video" && (
                      <div className="absolute bottom-2.5 left-2.5 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                        <Play className="w-3.5 h-3.5 fill-white" />
                      </div>
                    )}
                    {mem.mediaType === "audio" && (
                      <div className="absolute bottom-2.5 left-2.5 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                        <Volume2 className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* Remove from Album Button */}
                    <button
                      onClick={(e) => handleRemoveMemory(mem.id, e)}
                      title="Remove from this album (preserves original in archive)"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/85 hover:bg-red-50 text-plum/60 hover:text-red-600 shadow-sm transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Caption Details */}
                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between text-[11px] text-plum/50 font-sans">
                      <span>{mem.date}</span>
                      <span className="font-handwriting text-xs text-plum/70">{mem.location}</span>
                    </div>

                    <h3 className="font-serif text-base font-bold text-plum group-hover:text-plum-light transition-colors">
                      {mem.title}
                    </h3>

                    <p className="font-handwriting text-base text-plum/80 leading-snug line-clamp-2">
                      &ldquo;{mem.caption}&rdquo;
                    </p>

                    <div className="pt-2 flex items-center justify-between border-t border-plum/5 text-[10px] text-plum/40 uppercase tracking-wider font-semibold">
                      <span>{mem.tag}</span>
                      <span className="normal-case font-handwriting text-xs text-plum/60">by {mem.author}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Full-screen Memory Viewer Modal */}
      {viewerMemory && (
        <div
          className="fixed inset-0 bg-plum/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setViewerMemory(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float relative max-h-[92vh] overflow-y-auto space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-plum">
                  {viewerMemory.title}
                </h3>
                <span className="text-xs text-plum/60">
                  {viewerMemory.location} · {viewerMemory.date} · Saved by {viewerMemory.author}
                </span>
              </div>
              <button
                onClick={() => setViewerMemory(null)}
                className="p-1.5 rounded-full hover:bg-cream text-plum/60 hover:text-plum text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden relative shadow-inner bg-cream-300">
              <Image
                src={viewerMemory.imageUrl}
                alt={viewerMemory.title}
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-contain bg-black/5"
              />
            </div>

            <div className="space-y-2 px-1">
              <p className="font-handwriting text-2xl text-plum/90 leading-relaxed">
                &ldquo;{viewerMemory.caption}&rdquo;
              </p>
              {viewerMemory.story && (
                <p className="text-xs sm:text-sm text-plum/70 font-sans leading-relaxed pt-1">
                  {viewerMemory.story}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Memories Modal (Existing memories OR Upload direct) */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-plum">Add to Album</h3>
                <p className="text-xs text-plum/60">
                  Select existing moments from the archive or upload directly into &quot;{album.title}&quot;.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-plum/50 hover:text-plum text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex rounded-xl bg-cream/70 p-1 border border-plum/10">
              <button
                type="button"
                onClick={() => setActiveTab("existing")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "existing"
                    ? "bg-white text-plum shadow-sm"
                    : "text-plum/60 hover:text-plum"
                )}
              >
                Choose Existing Memories
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "upload"
                    ? "bg-white text-plum shadow-sm"
                    : "text-plum/60 hover:text-plum"
                )}
              >
                Upload New Files
              </button>
            </div>

            {activeTab === "existing" ? (
              <div className="space-y-4">
                <p className="text-xs text-plum/70 font-sans">
                  A memory can belong to multiple albums across our space without duplicating files.
                </p>

                {availableItems.length === 0 ? (
                  <p className="text-xs text-plum/50 italic py-6 text-center">No memories found in archive.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1 bg-cream/30 rounded-2xl border border-plum/10">
                    {availableItems.map(({ memory: mem, isAlreadyInAlbum }) => {
                      const isSelected = selectedMemoryIds.includes(mem.id);

                      return (
                        <div
                          key={mem.id}
                          onClick={() => {
                            if (!isAlreadyInAlbum) toggleSelectMemory(mem.id);
                          }}
                          className={cn(
                            "aspect-square rounded-xl overflow-hidden relative transition-all border-2",
                            isAlreadyInAlbum
                              ? "opacity-40 cursor-not-allowed border-transparent grayscale"
                              : isSelected
                              ? "border-plum ring-2 ring-blush scale-95 cursor-pointer"
                              : "border-transparent opacity-80 hover:opacity-100 cursor-pointer"
                          )}
                        >
                          <Image
                            src={mem.imageUrl}
                            alt={mem.title}
                            fill
                            sizes="120px"
                            className="object-cover"
                          />

                          {isSelected && (
                            <div className="absolute inset-0 bg-plum/40 flex items-center justify-center text-white">
                              <Check className="w-5 h-5 stroke-[3]" />
                            </div>
                          )}

                          {isAlreadyInAlbum && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold text-center px-1">
                              In Album
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-plum/10">
                  <span className="text-xs font-medium text-plum/70">
                    {selectedMemoryIds.length} {selectedMemoryIds.length === 1 ? "memory" : "memories"} selected
                  </span>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70 hover:bg-cream"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={selectedMemoryIds.length === 0 || isAddingMemories}
                      onClick={handleAddSelectedMemories}
                      className="px-5 py-2 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-medium shadow-paper disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {isAddingMemories ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Add to Album</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Direct Upload Tab */
              <div className="space-y-4">
                {/* Hidden Input for Multi-Files */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFilesSelected}
                />

                {/* Hidden Input for Direct Folders (webkitdirectory) */}
                <input
                  type="file"
                  ref={folderInputRef}
                  multiple
                  {...({ webkitdirectory: "", directory: "" } as any)}
                  className="hidden"
                  onChange={handleFolderSelected}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative",
                    isDragging
                      ? "border-plum bg-blush/40 scale-[0.99]"
                      : "border-plum/20 bg-cream/40 hover:bg-cream/70"
                  )}
                >
                  <Upload className="w-10 h-10 text-plum/50 mb-3" />
                  <p className="text-sm font-semibold text-plum">
                    Drag &amp; drop photos, clips, or <span className="underline decoration-plum/40">entire folders</span>
                  </p>
                  <p className="text-xs text-plum/50 mt-1">
                    Uploaded files will automatically be saved into &quot;{album.title}&quot;
                  </p>

                  {/* Two Direct Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-semibold shadow-sm transition-all"
                    >
                      <Files className="w-3.5 h-3.5" />
                      <span>Select Files</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-butter hover:bg-butter-dark border border-butter-dark/50 text-plum text-xs font-semibold shadow-sm transition-all"
                    >
                      <FolderUp className="w-3.5 h-3.5" />
                      <span>Upload Entire Folder</span>
                    </button>
                  </div>
                </div>

                {/* Queued Files Preview List */}
                {queuedFiles.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-plum">
                      <span>
                        Queued for Upload ({queuedFiles.length} {queuedFiles.length === 1 ? "item" : "items"})
                      </span>
                      <button
                        onClick={() => setQueuedFiles([])}
                        className="text-red-500 hover:text-red-700 text-[11px]"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-cream/30 rounded-2xl border border-plum/10">
                      {queuedFiles.map((qf) => (
                        <div
                          key={qf.id}
                          className="relative rounded-xl overflow-hidden border border-plum/10 bg-white p-1 text-center group"
                        >
                          <div className="aspect-square rounded-lg bg-cream-300 relative overflow-hidden mb-1">
                            {qf.previewUrl ? (
                              <Image
                                src={qf.previewUrl}
                                alt={qf.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-plum/40 text-[10px]">
                                {qf.mediaType}
                              </div>
                            )}
                            <button
                              onClick={() => removeQueuedFile(qf.id)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-plum font-medium truncate px-1">
                            {qf.name}
                          </p>
                          {qf.folderPath && (
                            <span className="inline-block text-[9px] px-1 py-0.5 rounded bg-blush text-plum/70 font-mono truncate max-w-[90%]">
                              📁 {qf.folderPath.split("/")[0]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-plum/10">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70"
                  >
                    Close
                  </button>

                  {queuedFiles.length > 0 && (
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={handleUploadDirectToAlbum}
                      className="px-5 py-2 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-medium shadow-paper disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>
                        {isUploading
                          ? "Uploading to Album..."
                          : `Upload ${queuedFiles.length} ${queuedFiles.length === 1 ? "Item" : "Items"} to Album`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Edit Album Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <h3 className="font-serif text-xl font-bold text-plum">Edit Album Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-plum/50 hover:text-plum text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditAlbum} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-1.5">
                  Album Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-cream/50 border border-plum/15 text-sm text-plum focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-cream/50 border border-plum/15 text-xs text-plum focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum/70 mb-1.5">
                  Cover Photo URL
                </label>
                <input
                  type="url"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-cream/50 border border-plum/15 text-xs text-plum focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-plum/10">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-5 py-2 rounded-xl bg-plum text-cream hover:bg-plum-light text-xs font-medium shadow-paper"
                >
                  {isEditing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float space-y-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-serif text-xl font-bold text-plum">Delete this Album?</h3>
              <p className="text-xs text-plum/70 leading-relaxed font-sans">
                Are you sure you want to delete &quot;{album.title}&quot;?
                <br />
                <strong className="text-plum">The original photographs and memories in this album will NOT be deleted</strong> and will remain safely preserved in your archive.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70 hover:bg-cream"
              >
                Keep Album
              </button>
              <button
                type="button"
                onClick={handleDeleteAlbum}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-paper"
              >
                Delete Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
