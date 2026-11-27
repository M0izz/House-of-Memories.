"use client";

import { useState } from "react";
import { MapPin, Navigation, Compass, Sparkles } from "lucide-react";

const SAMPLE_PLACES = [
  { name: "Old Town Coffee", count: 8, location: "Downtown", date: "April 2024" },
  { name: "Sunny Ridge Lookout", count: 14, location: "North Peak", date: "June 2024" },
  { name: "Midnight Diner", count: 5, location: "Westside", date: "August 2024" },
  { name: "Lakefront Cabin", count: 22, location: "Pinewood", date: "October 2024" },
];

export default function MemoryMapPage() {
  const [selectedPlace, setSelectedPlace] = useState(SAMPLE_PLACES[0]);

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
            Every coffee shop, road trip stop, and quiet corner we visited together.
          </p>
        </div>
      </div>

      {/* Map + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map Visual Surface */}
        <div className="lg:col-span-2 h-[420px] rounded-3xl bg-cream-300/60 border border-plum/15 shadow-paper relative overflow-hidden flex flex-col items-center justify-center p-6 text-center">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#493C46_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative z-10 space-y-3 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-blush mx-auto flex items-center justify-center text-plum shadow-sm">
              <MapPin className="w-6 h-6 text-plum" />
            </div>
            <h3 className="font-serif text-lg font-bold text-plum">
              Interactive Map Experience
            </h3>
            <p className="text-xs text-plum/70 leading-relaxed font-sans">
              Connect your MapLibre GL tile provider in <code className="bg-white/80 px-1 py-0.5 rounded text-[11px]">.env.local</code> to render live vector tiles and pin clusters.
            </p>
          </div>
        </div>

        {/* Places List */}
        <div className="space-y-3">
          <h3 className="font-serif text-lg font-bold text-plum px-1">
            Visited Places
          </h3>
          <div className="space-y-2.5">
            {SAMPLE_PLACES.map((place, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPlace(place)}
                className="p-4 rounded-2xl bg-white border border-plum/10 shadow-paper hover:shadow-float transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sage/50 flex items-center justify-center text-plum/70">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif text-sm font-semibold text-plum">
                      {place.name}
                    </h4>
                    <span className="text-[11px] text-plum/50">
                      {place.location} • {place.date}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-handwriting text-plum/70">
                  {place.count} memories
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
