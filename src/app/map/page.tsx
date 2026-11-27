"use client";

import dynamic from "next/dynamic";
import { Compass, Sparkles, MapPin } from "lucide-react";

// Client-only dynamic import of WebGL map to prevent any SSR hydration issues
const InteractiveMemoryMap = dynamic(
  () => import("@/components/map/interactive-memory-map"),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 h-[520px] rounded-3xl bg-cream-300/60 border border-plum/15 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blush flex items-center justify-center text-plum shadow-sm mb-3">
            <MapPin className="w-6 h-6 animate-bounce" />
          </div>
          <h3 className="font-serif text-lg font-bold text-plum">
            Loading Interactive Memory Map...
          </h3>
          <p className="text-xs text-plum/60 mt-1">
            Setting up vector tiles and memory coordinates.
          </p>
        </div>
        <div className="h-[520px] rounded-3xl bg-cream-200/50 border border-plum/10 p-4 space-y-3">
          <div className="h-6 w-32 bg-plum/10 rounded-lg"></div>
          <div className="h-20 bg-white/70 rounded-2xl"></div>
          <div className="h-20 bg-white/70 rounded-2xl"></div>
          <div className="h-20 bg-white/70 rounded-2xl"></div>
        </div>
      </div>
    ),
  }
);

export default function MemoryMapPage() {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-plum/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage/60 text-plum text-xs font-medium mb-1">
            <Compass className="w-3.5 h-3.5 text-plum/70" />
            <span>Geographic Footprints</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
            Memory Map
          </h1>
          <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
            Every coffee shop, road trip stop, and quiet corner we visited together across the world.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blush/60 text-plum text-xs font-handwriting font-bold border border-plum/10">
            <Sparkles className="w-3.5 h-3.5 text-plum/70" />
            <span>Our Shared Journey</span>
          </span>
        </div>
      </div>

      {/* Real Interactive Map Component */}
      <InteractiveMemoryMap />
    </div>
  );
}
