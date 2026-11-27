"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Heart,
  Upload,
  Camera,
  FolderUp,
  Files,
  X,
  Check,
  Loader2,
  Play,
  Volume2,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Memory } from "@/lib/sample-data";

const SAMPLE_TAGS = ["All", "Favorites", "Adventures", "Quiet Moments", "Inside Jokes", "Milestones"];

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  folderPath?: string;
  mediaType: "image" | "video" | "audio";
}

function MemoriesContent() {
  const searchParams = useSearchParams();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeTag, setActiveTag] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [selectedViewerMemory, setSelectedViewerMemory] = useState<Memory | null>(null);

  // Upload modal state
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [uploadTag, setUploadTag] = useState("Adventures");
  const [uploadStory, setUploadStory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Load memories from API
  const fetchMemories = async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
        const favs: Record<string, boolean> = {};
        data.memories.forEach((m: Memory) => {
          if (m.isFavorite) favs[m.id] = true;
        });
        setFavorites(favs);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  // Open modal if ?upload=true
  useEffect(() => {
    if (searchParams.get("upload") === "true") {
      setShowUploadModal(true);
    }
  }, [searchParams]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper to determine media type
  const getMediaType = (file: File): "image" | "video" | "audio" => {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "image";
  };

  // Process raw file list into queued files with preview
  const processFiles = (files: File[], folderPrefix?: string) => {
    const newItems: QueuedFile[] = files.map((file) => {
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

  // Standard multi-file picker change handler
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  // Folder picker change handler (webkitdirectory)
  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  // Recursive directory reader for Drag and Drop
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

  // Drag and Drop handlers
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

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // Convert File to Base64 / Data URL for persistent in-memory and client display
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit queued files to API & local state
  const handleUploadSubmit = async () => {
    if (queuedFiles.length === 0) return;

    try {
      setIsUploading(true);
      const itemsToUpload: Partial<Memory>[] = [];

      for (const qf of queuedFiles) {
        let imageUrl = qf.previewUrl;
        // Convert to data URL so it can be saved persistently
        if (qf.mediaType === "image") {
          imageUrl = await fileToDataUrl(qf.file);
        } else {
          imageUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80";
        }

        const titleFromName = qf.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        itemsToUpload.push({
          title: titleFromName,
          caption: uploadStory || `Imported from ${qf.folderPath || "device"}`,
          story: uploadStory || `Saved to House of Memories.`,
          imageUrl,
          mediaType: qf.mediaType,
          tag: uploadTag,
          location: qf.folderPath ? `Folder: ${qf.folderPath.split("/")[0]}` : "Our Sanctuary",
          author: "Alex",
        });
      }

      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToUpload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Clean up preview object URLs
      queuedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });

      setQueuedFiles([]);
      setUploadStory("");
      setShowUploadModal(false);
      setUploadSuccessMessage(`Successfully uploaded ${itemsToUpload.length} moments! ✨`);
      setTimeout(() => setUploadSuccessMessage(null), 4000);

      // Refresh gallery with new memories
      fetchMemories();
    } catch (err: any) {
      alert(err?.message || "Failed to complete upload");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredMemories = memories.filter((mem) => {
    if (activeTag === "Favorites" && !favorites[mem.id]) return false;
    if (activeTag !== "All" && activeTag !== "Favorites" && mem.tag !== activeTag) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        mem.title.toLowerCase().includes(q) ||
        mem.caption.toLowerCase().includes(q) ||
        mem.location.toLowerCase().includes(q) ||
        mem.tag.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-10 animate-fade-in pb-16 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {uploadSuccessMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-plum text-cream text-xs font-medium shadow-float border border-white/20 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-butter" />
          <span>{uploadSuccessMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-plum/10">
        <div>
          <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
            Archive Gallery
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
            Memory Library
          </h1>
          <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
            Our private collection of photographs, clips, and shared stories.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-paper hover:shadow-float active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photos &amp; Folders</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tags bar */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {SAMPLE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeTag === tag
                  ? "bg-plum text-cream shadow-sm"
                  : "bg-white text-plum/70 border border-plum/10 hover:border-plum/30"
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-plum/40 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search captions, places, tags..."
            className="w-full px-3.5 py-1.5 pl-9 rounded-full bg-white border border-plum/15 text-xs text-plum placeholder:text-plum/40 focus:outline-none focus:ring-2 focus:ring-plum/20 transition-all shadow-paper"
          />
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredMemories.map((item, idx) => {
          const isFav = favorites[item.id] || false;
          const rotations = ["-rotate-1", "rotate-1", "-rotate-0.5", "rotate-1.5", "-rotate-1.5"];
          const rot = item.rotation || rotations[idx % rotations.length];

          return (
            <div
              key={item.id}
              onClick={() => setSelectedViewerMemory(item)}
              className={cn(
                "polaroid-card group cursor-pointer border border-plum/10 relative transition-all bg-white",
                rot
              )}
            >
              <div className="washi-tape-corner" />

              {/* Photo Area */}
              <div className="aspect-[4/3] rounded-lg overflow-hidden relative mb-3 bg-cream-300 shadow-inner">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {item.mediaType === "video" && (
                  <div className="absolute bottom-2.5 left-2.5 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 fill-white" />
                  </div>
                )}
                {item.mediaType === "audio" && (
                  <div className="absolute bottom-2.5 left-2.5 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                )}

                <button
                  onClick={(e) => toggleFavorite(item.id, e)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/85 hover:bg-white text-plum/60 hover:text-plum shadow-sm transition-all"
                  title={isFav ? "Favorited" : "Add to favorites"}
                >
                  <Heart
                    className={cn(
                      "w-3.5 h-3.5 transition-colors",
                      isFav ? "fill-blush-dark text-plum" : "text-plum/50"
                    )}
                  />
                </button>
              </div>

              {/* Details & Caption */}
              <div className="space-y-1.5 px-1">
                <div className="flex items-center justify-between text-[11px] text-plum/50 font-sans">
                  <span>{item.date}</span>
                  <span className="font-handwriting text-xs text-plum/70">{item.location}</span>
                </div>

                <h3 className="font-serif text-base font-bold text-plum group-hover:text-plum-light transition-colors">
                  {item.title}
                </h3>

                <p className="font-handwriting text-base text-plum/80 leading-snug line-clamp-2">
                  &ldquo;{item.caption}&rdquo;
                </p>

                <div className="pt-2 flex items-center justify-between border-t border-plum/5 text-[10px] text-plum/40 uppercase tracking-wider font-semibold">
                  <span>{item.tag}</span>
                  <span className="normal-case font-handwriting text-xs text-plum/60">by {item.author}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMemories.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-plum/10 p-8 space-y-3">
          <Camera className="w-10 h-10 text-plum/30 mx-auto" />
          <h3 className="font-serif text-lg font-bold text-plum">No moments found</h3>
          <p className="text-xs text-plum/60">Upload some photographs or try selecting &quot;All&quot;.</p>
        </div>
      )}

      {/* Full-Screen Memory Viewer Modal */}
      {selectedViewerMemory && (
        <div
          className="fixed inset-0 bg-plum/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setSelectedViewerMemory(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float relative max-h-[92vh] overflow-y-auto space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-plum">
                  {selectedViewerMemory.title}
                </h3>
                <span className="text-xs text-plum/60">
                  {selectedViewerMemory.location} · {selectedViewerMemory.date} · Saved by {selectedViewerMemory.author}
                </span>
              </div>
              <button
                onClick={() => setSelectedViewerMemory(null)}
                className="p-1.5 rounded-full hover:bg-cream text-plum/60 hover:text-plum text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden relative shadow-inner bg-cream-300">
              <Image
                src={selectedViewerMemory.imageUrl}
                alt={selectedViewerMemory.title}
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-contain bg-black/5"
              />
            </div>

            <div className="space-y-2 px-1">
              <p className="font-handwriting text-2xl text-plum/90 leading-relaxed">
                &ldquo;{selectedViewerMemory.caption}&rdquo;
              </p>
              {selectedViewerMemory.story && (
                <p className="text-xs sm:text-sm text-plum/70 font-sans leading-relaxed pt-1">
                  {selectedViewerMemory.story}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Upload Modal (Files & Direct Folder Upload Support) */}
      {/* ================================================================= */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!isUploading) setShowUploadModal(false);
          }}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-float space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-plum">
                  Upload Memories
                </h3>
                <p className="text-xs text-plum/60 font-sans">
                  Import photographs, videos, audio, or entire folders into our archive.
                </p>
              </div>
              <button
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
                className="text-plum/50 hover:text-plum text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Interactive Dropzone */}
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
                Drag &amp; drop photos, clips, or <span className="underline decoration-plum/40">entire folders</span> here
              </p>
              <p className="text-xs text-plum/50 mt-1">
                Supports JPG, PNG, WebP, HEIC, MP4, MOV, and MP3
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
                        <p className="text-[9px] text-plum/50 truncate px-1 font-mono">
                          📁 {qf.folderPath.split("/")[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Tag & Story Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-plum/60 mb-1">
                      Collection Tag
                    </label>
                    <select
                      value={uploadTag}
                      onChange={(e) => setUploadTag(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-cream/50 border border-plum/15 text-xs text-plum font-medium"
                    >
                      {SAMPLE_TAGS.filter((t) => t !== "All" && t !== "Favorites").map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-plum/60 mb-1">
                      Caption / Memory Note
                    </label>
                    <input
                      type="text"
                      value={uploadStory}
                      onChange={(e) => setUploadStory(e.target.value)}
                      placeholder="e.g. Unforgettable weekend..."
                      className="w-full px-3 py-1.5 rounded-xl bg-cream/50 border border-plum/15 text-xs text-plum font-medium placeholder:text-plum/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-plum/10">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl border border-plum/15 text-xs font-medium text-plum/70 hover:text-plum hover:bg-cream"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={queuedFiles.length === 0 || isUploading}
                onClick={handleUploadSubmit}
                className="px-6 py-2.5 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-semibold shadow-paper flex items-center gap-2 disabled:opacity-40"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading {queuedFiles.length} moments...</span>
                  </>
                ) : (
                  <span>
                    Upload {queuedFiles.length > 0 ? `(${queuedFiles.length})` : ""}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-plum/50">Loading memories...</div>}>
      <MemoriesContent />
    </Suspense>
  );
}
