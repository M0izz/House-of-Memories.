"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  Heart,
  Plus,
  ArrowRight,
  Shuffle,
  MapPin,
  Clock,
  Mail,
  PartyPopper,
  Compass,
  Bookmark,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  SAMPLE_MEMORIES,
  SAMPLE_MILESTONES,
  SAMPLE_ALBUMS,
  Memory,
} from "@/lib/sample-data";

export default function HomePage() {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isSimulatedBirthday, setIsSimulatedBirthday] = useState(false);

  const featuredMemory: Memory = SAMPLE_MEMORIES[featuredIndex];
  const today = new Date();
  const formattedToday = format(today, "EEEE, MMMM do, yyyy");

  // Configured birthday date (e.g., April 15)
  const birthdayDate = new Date(today.getFullYear(), 3, 15);
  const daysUntilBirthday = differenceInDays(birthdayDate, today) > 0
    ? differenceInDays(birthdayDate, today)
    : 365 + differenceInDays(birthdayDate, today);

  const handleNextFeatured = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setFeaturedIndex((prev) => (prev + 1) % SAMPLE_MEMORIES.length);
      setIsShuffling(false);
    }, 280);
  };

  // Find a memory for "On This Day / In this Season"
  const onThisDayMemory = SAMPLE_MEMORIES[1]; // Old Town Coffee memory

  return (
    <div className="space-y-12 animate-fade-in pb-16 max-w-6xl mx-auto">
      {/* 1. Header & Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-plum/10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blush/70 text-plum text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-plum/70" />
            <span>A little place for our memories ✨</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-plum tracking-tight">
            Welcome Home.
          </h1>

          <p className="font-handwriting text-xl sm:text-2xl text-plum/80">
            Some moments deserve a place of their own.
          </p>

          <p className="text-xs text-plum/60 font-sans pt-0.5">
            {formattedToday} · 2 friends · {SAMPLE_MEMORIES.length * 7} moments recorded
          </p>
        </div>

        {/* Quick Actions & Date Simulation Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsSimulatedBirthday(!isSimulatedBirthday)}
            title="Preview how the home screen responds on the actual birthday"
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5",
              isSimulatedBirthday
                ? "bg-butter border-butter-dark text-plum font-semibold shadow-sm"
                : "border-plum/15 text-plum/60 hover:text-plum hover:bg-cream-300"
            )}
          >
            <PartyPopper className="w-3.5 h-3.5" />
            <span>{isSimulatedBirthday ? "Birthday Mode: Active" : "Preview Birthday"}</span>
          </button>

          <Link
            href="/memories"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-paper hover:shadow-float"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </Link>
        </div>
      </section>

      {/* 2. Dynamic Date-Aware Birthday Celebration or Countdown Banner */}
      {isSimulatedBirthday ? (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-butter via-blush to-butter p-6 sm:p-8 border border-plum/15 shadow-float text-plum animate-scale-up">
          <div className="washi-tape washi-tape-blush" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
                <PartyPopper className="w-7 h-7 text-plum animate-bounce" />
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold tracking-widest text-plum/70">
                  Today is the Day! 🎂
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-plum">
                  Happy Birthday, Maya!
                </h2>
                <p className="font-handwriting text-lg text-plum/80">
                  Your special birthday reveal is ready and waiting for you.
                </p>
              </div>
            </div>

            <Link
              href="/birthday"
              className="px-6 py-3 rounded-full bg-plum text-cream hover:bg-plum-light font-medium text-xs sm:text-sm transition-all shadow-paper flex items-center gap-2 group flex-shrink-0"
            >
              <span>Open Birthday Surprise</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      ) : null}

      {/* 3. Main Experience Row: Featured Memory (Scrapbook Polaroid) + Curated Discovery Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Featured Memory — The Emotional Anchor (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-paper relative space-y-6">
          <div className="washi-tape" />

          {/* Section Heading */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
                A Memory to Revisit
              </span>
              <h2 className="font-serif text-2xl font-bold text-plum">
                One of those unforgettable days.
              </h2>
            </div>

            <button
              onClick={handleNextFeatured}
              disabled={isShuffling}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cream-300 hover:bg-cream-400 text-plum text-xs font-medium transition-all border border-plum/10 active:scale-95 disabled:opacity-50"
              title="Shuffle another memory"
            >
              <Shuffle className={cn("w-3.5 h-3.5", isShuffling && "animate-spin")} />
              <span>Next Moment</span>
            </button>
          </div>

          {/* Living Polaroid Presentation */}
          <div
            className={cn(
              "polaroid-card bg-cream-100 transition-all duration-300",
              isShuffling ? "scale-98 opacity-60 blur-[1px]" : "scale-100 opacity-100"
            )}
          >
            {/* The Actual Rich Photograph */}
            <div className="w-full aspect-[16/10] sm:aspect-[16/9] rounded-lg overflow-hidden relative shadow-inner bg-cream-300">
              <Image
                src={featuredMemory.imageUrl}
                alt={featuredMemory.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 650px"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm text-plum text-[11px] font-medium flex items-center gap-1 shadow-sm">
                <Heart className="w-3 h-3 fill-blush text-plum" />
                <span>Core memory</span>
              </div>
            </div>

            {/* Handwritten & Editorial Caption Details */}
            <div className="pt-5 pb-2 px-2 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-plum/60 border-b border-plum/10 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-plum/50" />
                  <span className="font-medium text-plum/80">{featuredMemory.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-plum/50" />
                  <span>{featuredMemory.location}</span>
                </div>
                <span className="text-[11px] font-handwriting text-plum/70 px-2 py-0.5 rounded-full bg-cream-300/80">
                  saved by {featuredMemory.author}
                </span>
              </div>

              <h3 className="font-serif text-xl font-bold text-plum">
                {featuredMemory.title}
              </h3>

              <p className="font-handwriting text-xl text-plum/85 leading-relaxed">
                &ldquo;{featuredMemory.caption}&rdquo;
              </p>

              <p className="text-xs text-plum/75 leading-relaxed font-sans pt-1">
                {featuredMemory.story}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Portals & Memory Rediscovery (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* A Memory From One Year Ago / In this Season */}
          <div className="bg-white rounded-3xl p-6 border border-plum/10 shadow-paper relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-plum/60" />
                <span className="text-[11px] font-semibold text-plum/60 uppercase tracking-wider">
                  Remember When
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sage text-plum font-medium">
                One Year Ago
              </span>
            </div>

            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 rounded-2xl overflow-hidden relative flex-shrink-0 border border-plum/10 shadow-sm rotate-2">
                <Image
                  src={onThisDayMemory.imageUrl}
                  alt={onThisDayMemory.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <h4 className="font-serif text-base font-bold text-plum truncate">
                  {onThisDayMemory.title}
                </h4>
                <p className="font-handwriting text-sm text-plum/80 line-clamp-2">
                  &ldquo;{onThisDayMemory.caption}&rdquo;
                </p>
                <span className="text-[11px] text-plum/50 block">
                  {onThisDayMemory.location} · {onThisDayMemory.date}
                </span>
              </div>
            </div>
          </div>

          {/* Open When Letters Portal */}
          <Link
            href="/letters"
            className="block bg-gradient-to-br from-butter/60 via-cream to-blush/40 rounded-3xl p-6 border border-plum/15 shadow-paper hover:shadow-float transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-plum shadow-sm group-hover:scale-105 transition-transform">
                <Mail className="w-5 h-5 text-plum/70" />
              </div>
              <span className="text-xs font-handwriting text-plum/70 bg-white/70 px-2.5 py-1 rounded-full">
                4 sealed envelopes
              </span>
            </div>

            <h3 className="font-serif text-lg font-bold text-plum group-hover:text-plum-light transition-colors">
              Open When Envelopes
            </h3>
            <p className="text-xs text-plum/70 font-sans mt-1">
              Personal letters waiting for you — for when you need a laugh, comfort, or a little boost.
            </p>

            <div className="flex items-center gap-1 text-xs font-semibold text-plum mt-3">
              <span>Choose an envelope</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Memory Lane / Discovery Portal */}
          <Link
            href="/memory-lane"
            className="block bg-white rounded-3xl p-6 border border-plum/10 shadow-paper hover:shadow-float transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-lavender/60 flex items-center justify-center text-plum shadow-sm group-hover:scale-105 transition-transform">
                <Shuffle className="w-5 h-5 text-plum/70" />
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cream-300 text-plum/60 font-medium">
                Surprise Me
              </span>
            </div>

            <h3 className="font-serif text-lg font-bold text-plum group-hover:text-plum-light transition-colors">
              Memory Lane
            </h3>
            <p className="text-xs text-plum/70 font-sans mt-1">
              Spin the wheel of time and discover a completely randomized photograph from our archive.
            </p>

            <div className="flex items-center gap-1 text-xs font-semibold text-plum mt-3">
              <span>Let&apos;s revisit something</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Birthday Anticipation (When not in birthday mode) */}
          {!isSimulatedBirthday && (
            <div className="bg-cream-100 rounded-3xl p-6 border border-plum/10 shadow-paper space-y-3">
              <div className="flex items-center justify-between text-xs text-plum/60 uppercase tracking-wider font-semibold">
                <span>Special Occasion</span>
                <Sparkles className="w-4 h-4 text-plum/50" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-plum">
                  Upcoming Birthday
                </h4>
                <p className="text-xs text-plum/70">
                  {daysUntilBirthday} days until our next big private celebration.
                </p>
              </div>
              <Link
                href="/birthday"
                className="text-xs font-semibold text-plum/80 hover:text-plum flex items-center gap-1 group"
              >
                <span>View celebration preview</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 4. OUR STORY, SO FAR — Milestone Timeline Glimpse */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-plum/10 pb-4">
          <div>
            <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
              Our Story, So Far
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-plum">
              Every moment matters.
            </h2>
            <p className="text-xs sm:text-sm text-plum/70 font-sans">
              A glimpse of our friendship timeline from the very first days.
            </p>
          </div>

          <Link
            href="/timeline"
            className="text-xs font-semibold text-plum/80 hover:text-plum flex items-center gap-1 group"
          >
            <span>Explore full timeline</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Varied Scrapbook Milestone Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SAMPLE_MILESTONES.map((milestone, idx) => {
            const rotations = ["-rotate-1", "rotate-1", "-rotate-0.5"];
            const rot = rotations[idx % rotations.length];

            return (
              <div
                key={milestone.id}
                className={cn(
                  "polaroid-card bg-white transition-all group cursor-pointer",
                  rot
                )}
              >
                {/* Milestone Photo */}
                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden relative bg-cream-300 mb-3 shadow-inner">
                  <Image
                    src={milestone.imageUrl}
                    alt={milestone.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 350px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {milestone.isCore && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-plum text-[10px] font-medium shadow-sm">
                      Milestone
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 px-1">
                  <div className="flex items-center justify-between text-[11px] text-plum/50">
                    <span>{milestone.date}</span>
                    <span className="font-handwriting text-xs text-plum/70">
                      {milestone.location}
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-plum group-hover:text-plum-light transition-colors">
                    {milestone.title}
                  </h3>

                  <p className="text-xs text-plum/70 leading-relaxed font-sans line-clamp-2">
                    {milestone.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Living Albums Preview — Actual Multi-Photo Stack Effect */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center justify-between border-b border-plum/10 pb-4">
          <div>
            <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
              Curated Collections
            </span>
            <h2 className="font-serif text-2xl font-bold text-plum">
              Our Photo Albums
            </h2>
          </div>

          <Link
            href="/albums"
            className="text-xs font-semibold text-plum/80 hover:text-plum flex items-center gap-1 group"
          >
            <span>All albums</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {SAMPLE_ALBUMS.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group block"
            >
              {/* Photo Stack Effect */}
              <div className="photo-stack mb-4 aspect-[4/3] rounded-2xl overflow-hidden relative border border-plum/10 shadow-paper group-hover:shadow-float transition-all">
                <Image
                  src={album.coverImage}
                  alt={album.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 350px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-plum/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                <div className="absolute bottom-3 left-3 text-white">
                  <span className="text-[11px] font-medium bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    {album.memoryCount} moments
                  </span>
                </div>
              </div>

              <div className="space-y-0.5 px-1">
                <h3 className="font-serif text-base font-bold text-plum group-hover:text-plum-light transition-colors">
                  {album.title}
                </h3>
                <p className="font-handwriting text-sm text-plum/60">
                  Collection · {album.theme}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
