"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Heart,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  ArrowRight,
  X,
  Gift,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  calculateCountdown,
  loadSavedBirthdayConfig,
  loadWidgetMinimized,
  saveWidgetMinimized,
  CountdownResult,
  BirthdayConfig,
} from "@/lib/birthday";

export function FloatingCountdown() {
  const pathname = usePathname();
  const [config, setConfig] = useState<BirthdayConfig | null>(null);
  const [countdown, setCountdown] = useState<CountdownResult | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Load config & persisted minimized state on mount
  useEffect(() => {
    const savedConfig = loadSavedBirthdayConfig();
    setConfig(savedConfig);
    setIsMinimized(loadWidgetMinimized());

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
    }
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!config || !config.widgetEnabled) return;

    const tick = () => {
      setCountdown(calculateCountdown(new Date(), config));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Don't render on the full-screen birthday surprise page itself to avoid duplication
  if (pathname === "/birthday" || isDismissed || !config?.widgetEnabled || !countdown) {
    return null;
  }

  const toggleMinimized = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    saveWidgetMinimized(next);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed z-30 right-4 sm:right-6 bottom-20 md:bottom-6 select-none pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* Minimized Floating Pill State */
          <motion.div
            key="minimized"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
            onClick={toggleMinimized}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-plum/15 shadow-float cursor-pointer text-plum hover:bg-cream group"
          >
            <div className="w-6 h-6 rounded-full bg-blush flex items-center justify-center text-plum">
              {countdown.isBirthday ? (
                <PartyPopper className="w-3.5 h-3.5 text-plum animate-bounce" />
              ) : (
                <Gift className="w-3.5 h-3.5 text-plum" />
              )}
            </div>

            <div className="text-xs font-medium pr-1">
              {countdown.isBirthday ? (
                <span className="font-serif font-bold text-plum">
                  Birthday Today! 🎂
                </span>
              ) : (
                <span>
                  <strong className="font-serif font-bold text-plum">
                    {countdown.days}d
                  </strong>{" "}
                  <span className="text-[11px] text-plum/60">
                    to {config.recipientName}&apos;s Birthday
                  </span>
                </span>
              )}
            </div>

            <ChevronUp className="w-3.5 h-3.5 text-plum/50 group-hover:text-plum transition-colors" />
          </motion.div>
        ) : (
          /* Expanded Floating Card State */
          <motion.div
            key="expanded"
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="w-80 rounded-3xl bg-white/95 backdrop-blur-md border border-plum/15 shadow-float p-5 text-plum relative overflow-hidden"
          >
            {/* Soft decorative background tint */}
            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-butter/50 blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-blush/40 blur-xl pointer-events-none" />

            {/* Header: Title & Window Controls */}
            <div className="relative flex items-center justify-between pb-3 border-b border-plum/10 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blush/80 flex items-center justify-center text-plum">
                  <Sparkles className="w-3.5 h-3.5 text-plum" />
                </div>
                <div>
                  <h4 className="font-serif text-sm font-bold text-plum">
                    {countdown.isBirthday
                      ? `${config.recipientName}'s Birthday!`
                      : "Birthday Countdown"}
                  </h4>
                  <p className="text-[10px] text-plum/50 font-sans">
                    {countdown.formattedTargetDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleMinimized}
                  className="p-1 rounded-lg text-plum/50 hover:text-plum hover:bg-cream-300 transition-colors"
                  title="Minimize countdown"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-1 rounded-lg text-plum/40 hover:text-plum hover:bg-cream-300 transition-colors"
                  title="Close for this session"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Countdown or Celebration Body */}
            {countdown.isBirthday ? (
              /* Birthday Celebration State (When target reaches zero / on November 24) */
              <div className="relative space-y-3 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-butter to-blush mx-auto flex items-center justify-center shadow-paper">
                  <PartyPopper className="w-6 h-6 text-plum animate-bounce" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-bold text-plum">
                    It&apos;s Your Day! ✨
                  </h3>
                  <p className="font-handwriting text-sm text-plum/80 leading-snug">
                    Another chapter, countless more shared memories. Happy Birthday!
                  </p>
                </div>

                <Link
                  href="/birthday"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-semibold shadow-paper transition-all group"
                >
                  <span>Open Celebration</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ) : (
              /* Active Recurring Countdown State */
              <div className="relative space-y-3.5">
                {/* 4 Time Digit Boxes */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "days", val: countdown.days },
                    { label: "hours", val: countdown.hours },
                    { label: "mins", val: countdown.minutes },
                    { label: "secs", val: countdown.seconds },
                  ].map((unit) => (
                    <div
                      key={unit.label}
                      className="p-2 rounded-2xl bg-cream/70 border border-plum/10 shadow-sm"
                    >
                      <span className="font-serif text-xl sm:text-2xl font-bold text-plum block leading-tight">
                        {String(unit.val).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-plum/50">
                        {unit.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtext Note */}
                <p className="text-center font-handwriting text-xs text-plum/70">
                  Some moments deserve a place that time can&apos;t touch ♡
                </p>

                {/* Quick Link to Preview Reveal */}
                <Link
                  href="/birthday"
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-butter/40 hover:bg-butter/70 border border-plum/10 text-xs font-medium text-plum transition-all group"
                >
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-plum/60 fill-blush" />
                    <span>Birthday experience preview</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-plum/50 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
