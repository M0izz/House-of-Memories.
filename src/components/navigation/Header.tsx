"use client";

import { useState } from "react";
import { Volume2, VolumeX, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

export function Header() {
  const [isMuted, setIsMuted] = useState(true);

  const toggleSound = () => {
    setIsMuted(!isMuted);
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-cream/80 backdrop-blur-md border-b border-plum/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-handwriting text-xl text-plum/80 hidden sm:inline-block">
           moments that time can&apos;t touch ✨
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Ambient Music Toggle */}
        <button
          onClick={toggleSound}
          title={isMuted ? "Unmute ambient music" : "Mute ambient music"}
          className="p-2 rounded-full hover:bg-cream-300 text-plum/70 hover:text-plum transition-all border border-plum/10"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4 text-plum animate-pulse-soft" />
          )}
        </button>

        {/* Quick Upload Button */}
        <Link
          href="/memories?upload=true"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs font-medium shadow-sm hover:shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Memory</span>
        </Link>
      </div>
    </header>
  );
}
