"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Home,
  Image as ImageIcon,
  BookImage,
  Clock,
  Mail,
  Shuffle,
  MapPin,
  Calendar,
  Settings,
  Heart,
  Sparkles,
  Music,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Memories", href: "/memories", icon: ImageIcon },
  { label: "Albums", href: "/albums", icon: BookImage },
  { label: "Our Timeline", href: "/timeline", icon: Clock },
  { label: "Open When", href: "/letters", icon: Mail },
  { label: "Memory Lane", href: "/memory-lane", icon: Shuffle },
  { label: "Memory Map", href: "/map", icon: MapPin },
  { label: "Special Dates", href: "/dates", icon: Calendar },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-cream/80 backdrop-blur-md border-r border-plum/10 p-5 justify-between select-none z-30">
      <div className="space-y-6">
        {/* Shared Space Identity */}
        <div className="pb-4 border-b border-plum/10">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Dual Interlinked Monogram Avatars */}
            <div className="relative flex items-center">
              <div className="w-8 h-8 rounded-full bg-blush text-plum font-serif text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-plum/10">
                A
              </div>
              <div className="w-8 h-8 rounded-full bg-butter text-plum font-serif text-xs font-bold flex items-center justify-center -ml-2.5 border-2 border-white shadow-sm ring-1 ring-plum/10">
                M
              </div>
            </div>

            <div>
              <h1 className="font-serif text-base font-bold tracking-tight text-plum flex items-center gap-1.5">
                <span>House of Memories</span>
              </h1>
              <p className="font-handwriting text-xs text-plum/70 tracking-wide">
                Alex &amp; Maya&apos;s Sanctuary
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/albums" && pathname.startsWith("/albums"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blush/90 text-plum shadow-sm translate-x-1"
                    : "text-plum/70 hover:text-plum hover:bg-cream-300/60"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-plum fill-plum/15" : "text-plum/50"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Featured Mini Album Peek in Sidebar — Navigates to corresponding real album */}
        <div className="pt-2">
          <Link
            href="/albums/alb-1"
            className="block p-2.5 rounded-xl bg-white/70 hover:bg-white border border-plum/10 shadow-paper hover:shadow-float transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg overflow-hidden relative flex-shrink-0 border border-plum/10">
                <Image
                  src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=120&q=80"
                  alt="Road Trips Album"
                  fill
                  sizes="40px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-plum/50 tracking-wider">
                  Featured Album
                </p>
                <p className="font-serif text-xs font-bold text-plum truncate">
                  Road Trips &amp; Detours
                </p>
                <p className="text-[10px] text-plum/60 font-sans">
                  Open Collection →
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer: Ambient Sound & Birthday Secret */}
      <div className="pt-3 border-t border-plum/10 space-y-2">
        {/* Gentle Ambient Sound Indicator */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cream-300/40 text-[11px] text-plum/70">
          <div className="flex items-center gap-1.5">
            <Music className="w-3 h-3 text-plum/60 animate-pulse-soft" />
            <span className="font-handwriting text-xs text-plum/80">Acoustic Sunlight</span>
          </div>
          <span className="text-[10px] text-plum/40 font-mono">playing</span>
        </div>

        {/* Secret Birthday Entry */}
        <Link
          href="/birthday"
          className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-butter/60 to-blush/60 hover:from-butter hover:to-blush text-xs text-plum/80 font-medium transition-all group shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-plum/70 animate-pulse-soft" />
            <span>Birthday Secret</span>
          </div>
          <span className="font-handwriting text-sm text-plum/60 group-hover:text-plum">
            open ✨
          </span>
        </Link>
      </div>
    </aside>
  );
}
