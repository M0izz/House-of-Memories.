"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Image as ImageIcon, Clock, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { label: "Home", href: "/", icon: Home },
  { label: "Memories", href: "/memories", icon: ImageIcon },
  { label: "Timeline", href: "/timeline", icon: Clock },
];

const MORE_LINKS = [
  { label: "Albums", href: "/albums" },
  { label: "Open When Letters", href: "/letters" },
  { label: "Memory Lane", href: "/memory-lane" },
  { label: "Memory Map", href: "/map" },
  { label: "Special Dates", href: "/dates" },
  { label: "Birthday Secret", href: "/birthday" },
  { label: "Settings", href: "/settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More Sheet */}
      {showMore && (
        <div
          className="fixed inset-0 bg-plum/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-20 left-4 right-4 bg-cream p-4 rounded-2xl shadow-float border border-plum/10 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold text-plum/50 uppercase tracking-wider px-3 py-1">
              Explore More
            </p>
            {MORE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMore(false)}
                className={cn(
                  "block px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-blush text-plum font-semibold"
                    : "text-plum/80 hover:bg-cream-300"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-cream/90 backdrop-blur-lg border-t border-plum/10 flex items-center justify-around px-4 z-40 md:hidden">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all",
                isActive ? "text-plum" : "text-plum/50 hover:text-plum/80"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-plum fill-plum/15" : "text-plum/60"
                )}
              />
              <span className="text-[10px] font-medium tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl transition-all",
            showMore ? "text-plum" : "text-plum/50 hover:text-plum/80"
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">More</span>
        </button>
      </nav>
    </>
  );
}
