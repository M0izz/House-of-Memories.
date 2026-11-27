"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Gift, Heart, ArrowRight, RotateCcw, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    step: 1,
    title: "Happy Birthday!",
    subtitle: "A little something crafted especially for you.",
    content: "Welcome to your birthday surprise. Step through a few moments that capture just how special this year has been.",
  },
  {
    step: 2,
    title: "Chapter 1: The Journey",
    subtitle: "From where we began to where we are now.",
    content: "Looking back at the photographs, it's wild how quickly time flies when every day is filled with laughter and shared adventures.",
  },
  {
    step: 3,
    title: "Chapter 2: The Little Things",
    subtitle: "Inside jokes, late-night tea, and endless chats.",
    content: "It's never just the big milestones. It's the random voice notes, the spilled coffee, and the quiet moments where nothing needed to be said.",
  },
  {
    step: 4,
    title: "Your Birthday Letter",
    subtitle: "Penned from the heart.",
    content: "May your upcoming year be full of gentle mornings, brave leaps, boundless joy, and plenty of shared memories. Happy Birthday!",
  },
];

export default function BirthdayPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const slide = SLIDES[currentStep];

  const handleNext = () => {
    if (currentStep < SLIDES.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsRevealed(true);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsRevealed(false);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
      {!isRevealed ? (
        <div className="w-full bg-white rounded-3xl p-8 sm:p-12 border border-plum/10 shadow-float relative space-y-6 animate-fade-in">
          {/* Decorative Sparkles */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-butter to-blush mx-auto flex items-center justify-center text-plum shadow-paper">
            <Gift className="w-8 h-8 text-plum animate-pulse-soft" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-plum/50">
              Part {slide.step} of {SLIDES.length}
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
              {slide.title}
            </h1>
            <p className="text-xs sm:text-sm font-sans text-plum/60 italic">
              {slide.subtitle}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-cream/50 border border-plum/10 shadow-inner">
            <p className="font-handwriting text-xl sm:text-2xl text-plum leading-relaxed">
              &ldquo;{slide.content}&rdquo;
            </p>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === currentStep
                    ? "w-8 bg-plum"
                    : "w-2 bg-plum/20"
                )}
              />
            ))}
          </div>

          {/* Action button */}
          <button
            onClick={handleNext}
            className="w-full sm:w-auto px-8 py-3 rounded-full bg-plum hover:bg-plum-light text-cream font-medium text-sm transition-all shadow-paper flex items-center justify-center gap-2 mx-auto"
          >
            <span>{currentStep === SLIDES.length - 1 ? "Open the Reveal 🎉" : "Continue"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Final Reveal Screen */
        <div className="w-full bg-gradient-to-br from-butter/50 via-blush/40 to-cream rounded-3xl p-8 sm:p-12 border border-plum/15 shadow-float space-y-6 animate-scale-up">
          <div className="w-20 h-20 rounded-full bg-white mx-auto flex items-center justify-center text-plum shadow-paper">
            <PartyPopper className="w-10 h-10 text-plum animate-bounce" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-plum">
              Happy Birthday! ✨
            </h1>
            <p className="font-handwriting text-2xl text-plum/80">
              Here is to another year of unforgettable memories.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-plum/70 font-sans max-w-md mx-auto leading-relaxed">
            This space will remain our private home to keep adding every snapshot, inside joke, and story as we go.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/memories"
              className="px-6 py-3 rounded-full bg-plum hover:bg-plum-light text-cream font-medium text-sm transition-all shadow-paper flex items-center gap-2"
            >
              <span>Explore Our Memories</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-full bg-white hover:bg-cream border border-plum/15 text-plum font-medium text-sm transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-plum/60" />
              <span>Watch Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
