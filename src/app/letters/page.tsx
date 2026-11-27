"use client";

import { useState } from "react";
import { Mail, Lock, Unlock, Heart, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Letter {
  id: string;
  title: string;
  unlockCondition: string;
  isLocked: boolean;
  color: "butter" | "blush" | "lavender" | "sage";
  content?: string;
}

const LETTERS: Letter[] = [
  {
    id: "l1",
    title: "Open when you're feeling down",
    unlockCondition: "Immediate",
    isLocked: false,
    color: "butter",
    content: "Whenever you feel overwhelmed or sad, remember how resilient you are. You have made it through 100% of your hardest days so far, and I am always in your corner.",
  },
  {
    id: "l2",
    title: "Open when you need a good laugh",
    unlockCondition: "Immediate",
    isLocked: false,
    color: "blush",
    content: "Remember that time we tried to bake without checking if we had eggs, used applesauce instead, and ended up with a literal rubber pancake? Still the greatest dessert ever created.",
  },
  {
    id: "l3",
    title: "Open on your birthday",
    unlockCondition: "Locked until Birthday",
    isLocked: true,
    color: "lavender",
  },
  {
    id: "l4",
    title: "Open when you miss our road trips",
    unlockCondition: "Immediate",
    isLocked: false,
    color: "sage",
    content: "The open road, horrible singing, gas station snacks, and missing our exits three times in a row. Our next adventure is already being planned!",
  },
];

export default function LettersPage() {
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

  const getColorClasses = (color: Letter["color"]) => {
    switch (color) {
      case "butter":
        return "bg-butter/70 hover:bg-butter border-butter-dark";
      case "blush":
        return "bg-blush/70 hover:bg-blush border-blush-dark";
      case "lavender":
        return "bg-lavender/70 hover:bg-lavender border-lavender-dark";
      case "sage":
        return "bg-sage/70 hover:bg-sage border-sage-dark";
      default:
        return "bg-cream-300 border-plum/10";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-plum/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blush/60 text-plum text-xs font-medium mb-1">
            <Heart className="w-3.5 h-3.5 fill-plum/20 text-plum" />
            <span>Private Notes</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
            Open When Letters
          </h1>
          <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
            A bundle of handwritten letters sealed in envelopes, waiting for the right moment.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-plum text-cream hover:bg-plum-light transition-all text-xs sm:text-sm font-medium shadow-sm hover:shadow self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Write a Letter</span>
        </button>
      </div>

      {/* Envelopes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {LETTERS.map((letter) => {
          return (
            <div
              key={letter.id}
              onClick={() => {
                if (!letter.isLocked) setSelectedLetter(letter);
              }}
              className={cn(
                "relative rounded-2xl p-6 border transition-all select-none shadow-paper cursor-pointer group",
                getColorClasses(letter.color),
                letter.isLocked ? "opacity-80 cursor-not-allowed" : "hover:-translate-y-1 hover:shadow-float"
              )}
            >
              {/* Envelope Flap decoration */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-plum shadow-sm">
                  {letter.isLocked ? (
                    <Lock className="w-4 h-4 text-plum/50" />
                  ) : (
                    <Mail className="w-4 h-4 text-plum/70 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-plum/60 bg-white/60 px-2.5 py-1 rounded-full">
                  {letter.unlockCondition}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-serif text-lg font-bold text-plum group-hover:text-plum-light transition-colors">
                  {letter.title}
                </h3>
                <p className="font-handwriting text-sm text-plum/70">
                  {letter.isLocked
                    ? "Sealed with a wax stamp. Keep waiting!"
                    : "Tap to open and read envelope 💌"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Letter Reading Modal */}
      {selectedLetter && (
        <div
          className="fixed inset-0 bg-plum/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLetter(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-8 sm:p-10 border border-plum/10 shadow-float relative space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wax Seal / Stamp Header */}
            <div className="flex items-center justify-between border-b border-plum/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center text-plum">
                  <Heart className="w-4 h-4 fill-plum/30 text-plum" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-plum">
                    {selectedLetter.title}
                  </h3>
                  <span className="text-[11px] text-plum/50">From your friend</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLetter(null)}
                className="text-plum/40 hover:text-plum text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Letter Content (Paper & Handwriting) */}
            <div className="p-6 rounded-2xl bg-cream/40 border border-plum/10 shadow-inner">
              <p className="font-handwriting text-xl sm:text-2xl text-plum leading-relaxed whitespace-pre-wrap">
                {selectedLetter.content}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLetter(null)}
                className="px-5 py-2 rounded-xl bg-plum text-cream text-xs font-medium hover:bg-plum-light transition-all shadow-sm"
              >
                Fold Letter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
