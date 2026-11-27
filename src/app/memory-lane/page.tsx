"use client";

import { useState } from "react";
import Image from "next/image";
import { Shuffle, Sparkles, Heart, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_MEMORIES, Memory } from "@/lib/sample-data";

export default function MemoryLanePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);

  const shuffleNext = () => {
    setIsShuffling(true);
    setTimeout(() => {
      let nextIdx = Math.floor(Math.random() * SAMPLE_MEMORIES.length);
      if (nextIdx === currentIndex) {
        nextIdx = (currentIndex + 1) % SAMPLE_MEMORIES.length;
      }
      setCurrentIndex(nextIdx);
      setIsShuffling(false);
    }, 350);
  };

  const currentMemory: Memory = SAMPLE_MEMORIES[currentIndex];

  return (
    <div className="space-y-8 animate-fade-in pb-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 pb-6 border-b border-plum/10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-butter/60 text-plum text-xs font-medium">
          <Shuffle className="w-3.5 h-3.5 text-plum/70" />
          <span>Random Discovery</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
          Memory Lane
        </h1>
        <p className="text-xs sm:text-sm text-plum/70 font-sans max-w-md mx-auto">
          Spin the reels of time. A delightful way to stumble upon forgotten moments.
        </p>
      </div>

      {/* Interactive Polaroid Shuffle Container */}
      <div className="flex flex-col items-center justify-center pt-2">
        <div
          className={cn(
            "w-full max-w-md polaroid-card border border-plum/10 transition-all duration-300 relative bg-white",
            isShuffling ? "scale-95 rotate-2 opacity-50 blur-[1px]" : "scale-100 rotate-0 opacity-100"
          )}
        >
          <div className="washi-tape" />

          {/* Photo Frame */}
          <div className="w-full aspect-[4/3] rounded-lg overflow-hidden relative mb-4 bg-cream-300 shadow-inner">
            <Image
              src={currentMemory.imageUrl}
              alt={currentMemory.title}
              fill
              sizes="(max-width: 768px) 100vw, 450px"
              className="object-cover"
            />
            <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/90 text-plum text-[11px] font-medium shadow-sm flex items-center gap-1">
              <Heart className="w-3 h-3 fill-blush text-plum" />
              <span>{currentMemory.tag}</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-center px-2 pb-2">
            <div className="flex items-center justify-center gap-3 text-xs text-plum/60">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-plum/50" />
                <span>{currentMemory.date}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-plum/50" />
                <span>{currentMemory.location}</span>
              </div>
            </div>

            <h2 className="font-serif text-xl font-bold text-plum">
              {currentMemory.title}
            </h2>

            <p className="font-handwriting text-xl text-plum/85 leading-relaxed">
              &ldquo;{currentMemory.caption}&rdquo;
            </p>

            <p className="text-xs text-plum/70 font-sans leading-relaxed pt-1">
              {currentMemory.story}
            </p>
          </div>
        </div>

        {/* Shuffle Button */}
        <button
          onClick={shuffleNext}
          disabled={isShuffling}
          className="mt-8 flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-plum hover:bg-plum-light text-cream font-medium text-sm transition-all shadow-paper hover:shadow-float active:scale-95 disabled:opacity-50"
        >
          <Shuffle className={cn("w-4 h-4", isShuffling && "animate-spin")} />
          <span>{isShuffling ? "Finding another moment..." : "Surprise Me Again ✨"}</span>
        </button>
      </div>
    </div>
  );
}
