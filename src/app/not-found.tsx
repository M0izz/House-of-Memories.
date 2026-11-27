import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-5">
      <div className="w-14 h-14 rounded-full bg-blush flex items-center justify-center text-plum shadow-sm">
        <Heart className="w-7 h-7 fill-plum/20 text-plum" />
      </div>

      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
          Moment Not Found
        </h1>
        <p className="text-xs sm:text-sm text-plum/70 font-sans max-w-sm mx-auto">
          This memory seems to be tucked away in another corner of our archive.
        </p>
      </div>

      <Link
        href="/"
        className="px-5 py-2.5 rounded-full bg-plum text-cream hover:bg-plum-light font-medium text-xs sm:text-sm transition-all shadow-paper flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return Home</span>
      </Link>
    </div>
  );
}
