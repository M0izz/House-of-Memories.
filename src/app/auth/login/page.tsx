"use client";

import { useState } from "react";
import { Heart, Sparkles, Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Placeholder until Supabase credentials are configured in .env.local
    setTimeout(() => {
      setIsLoading(false);
      setMessage("Please connect your Supabase project in .env.local to authenticate.");
    }, 600);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4">
      {/* Container Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 border border-plum/10 shadow-float relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blush/60 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-butter/60 blur-2xl pointer-events-none" />

        <div className="relative text-center space-y-3 mb-8">
          <div className="inline-flex w-12 h-12 rounded-full bg-blush items-center justify-center text-plum shadow-sm mb-2">
            <Heart className="w-6 h-6 fill-plum/20 text-plum" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-plum">House of Memories</h1>
          <p className="text-xs text-plum/60 tracking-wide uppercase font-medium">
            Private 2-Person Archive
          </p>
          <p className="text-xs text-plum/70 font-sans italic pt-1">
            &ldquo;Some moments deserve a place that time can&apos;t touch.&rdquo;
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 relative">
          <div>
            <label className="block text-xs font-semibold text-plum/70 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 pl-10 rounded-xl bg-cream/50 border border-plum/15 text-plum text-sm focus:outline-none focus:ring-2 focus:ring-plum/20 transition-all placeholder:text-plum/30"
              />
              <Mail className="w-4 h-4 text-plum/40 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-plum/70 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 pl-10 rounded-xl bg-cream/50 border border-plum/15 text-plum text-sm focus:outline-none focus:ring-2 focus:ring-plum/20 transition-all placeholder:text-plum/30"
              />
              <Lock className="w-4 h-4 text-plum/40 absolute left-3.5 top-3" />
            </div>
          </div>

          {message && (
            <div className="p-3 rounded-xl bg-butter/60 border border-butter-dark text-plum text-xs text-center font-medium">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-plum hover:bg-plum-light text-cream font-medium text-sm transition-all shadow-paper flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <span>{isLoading ? "Signing in..." : "Enter our Space"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-plum/10 text-center">
          <p className="text-[11px] text-plum/50">
            By invitation only. Exactly two members can access this space.
          </p>
        </div>
      </div>
    </div>
  );
}
