"use client";

import { useState } from "react";
import { Calendar, Plus, Sparkles, Clock, Heart } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const DATES = [
  {
    id: "d1",
    title: "Her Birthday",
    date: new Date(2027, 3, 15),
    recurrence: "Yearly",
    isPrimary: true,
  },
  {
    id: "d2",
    title: "Friendship Anniversary",
    date: new Date(2027, 3, 12),
    recurrence: "Yearly",
    isPrimary: false,
  },
  {
    id: "d3",
    title: "Annual Road Trip",
    date: new Date(2027, 9, 1),
    recurrence: "Yearly",
    isPrimary: false,
  },
];

export default function SpecialDatesPage() {
  const today = new Date();

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-plum/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-butter/60 text-plum text-xs font-medium mb-1">
            <Clock className="w-3.5 h-3.5 text-plum/70" />
            <span>Time & Countdowns</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
            Special Dates
          </h1>
          <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
            Our private calendar of birthdays, anniversaries, and future milestones.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Add Occasion</span>
        </button>
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DATES.map((item) => {
          const daysLeft = Math.max(0, differenceInDays(item.date, today));

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border border-plum/10 shadow-paper hover:shadow-float transition-all space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-plum/50">
                  {item.recurrence}
                </span>
                {item.isPrimary && (
                  <Sparkles className="w-4 h-4 text-plum/70 animate-pulse-soft" />
                )}
              </div>

              <div>
                <h3 className="font-serif text-xl font-bold text-plum">
                  {item.title}
                </h3>
                <span className="text-xs text-plum/60">
                  {format(item.date, "MMMM do, yyyy")}
                </span>
              </div>

              {/* Countdown badge */}
              <div className="p-4 rounded-xl bg-cream/70 border border-plum/10 flex items-center justify-between">
                <span className="text-xs text-plum/70 font-medium">Countdown</span>
                <span className="font-serif text-xl font-bold text-plum">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
