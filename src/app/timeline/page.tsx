"use client";

import Image from "next/image";
import { Plus, MapPin, Sparkles, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_MILESTONES } from "@/lib/sample-data";

export default function TimelinePage() {
  return (
    <div className="space-y-10 animate-fade-in pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-plum/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-butter/60 text-plum text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5 text-plum/70" />
            <span>Chronological Journey</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
            Our Timeline
          </h1>
          <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
            A chronological tapestry of our friendship, milestones, and shared stories.
          </p>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-paper hover:shadow-float self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Add Milestone</span>
        </button>
      </div>

      {/* Vertical Timeline Stream */}
      <div className="relative pl-6 sm:pl-10 space-y-12 before:absolute before:left-2 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-plum/15">
        <div className="space-y-8">
          {SAMPLE_MILESTONES.map((ev, idx) => (
            <div key={ev.id} className="relative group">
              {/* Timeline Node Dot */}
              <div
                className={cn(
                  "absolute -left-[30px] sm:-left-[46px] top-5 w-4 h-4 rounded-full border-2 border-cream transition-all group-hover:scale-125 z-10",
                  ev.isCore
                    ? "bg-plum ring-4 ring-blush"
                    : "bg-plum/40 ring-2 ring-plum/10"
                )}
              />

              {/* Event Card */}
              <div className="bg-white rounded-3xl p-5 sm:p-7 border border-plum/10 shadow-paper group-hover:shadow-float transition-all grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Milestone Photo Preview */}
                <div className="md:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden relative bg-cream-300 shadow-inner">
                  <Image
                    src={ev.imageUrl}
                    alt={ev.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {ev.isCore && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 text-plum text-[10px] font-semibold shadow-sm flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-blush text-plum" />
                      <span>Core Memory</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="md:col-span-7 space-y-2">
                  <div className="flex items-center justify-between text-xs text-plum/50">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-plum/60">{ev.date}</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-plum/50" />
                      <span className="font-handwriting text-sm text-plum/70">{ev.location}</span>
                    </div>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-plum group-hover:text-plum-light transition-colors">
                    {ev.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-plum/80 leading-relaxed font-sans">
                    {ev.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
