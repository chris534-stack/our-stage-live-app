"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { CommunityDirectory } from "@/components/community/CommunityDirectory";

export function HeroMembersButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="inline-flex items-center gap-3">
        <button
          type="button"
          aria-label="Our Members"
          onClick={() => setOpen(true)}
          className="group relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-yellow-300 to-blue-500 text-black shadow-[0_10px_30px_rgba(0,0,0,0.15)] ring-2 ring-yellow-300 transition-all duration-200 hover:scale-105 hover:ring-4 focus:outline-none focus:ring-4 focus:ring-yellow-400/60"
        >
          {/* Glow layers */}
          <span
            aria-hidden
            className="absolute -z-10 h-16 w-16 rounded-full bg-yellow-300/40 blur-lg group-hover:bg-yellow-300/60 group-hover:blur-xl transition-all"
          />
          <span
            aria-hidden
            className="absolute -z-10 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl group-hover:bg-blue-400/30 transition-all"
          />
          <BookOpen className="h-6 w-6 drop-shadow-sm" />
          {/* Hover label (desktop tooltip) */}
          <span className="hidden sm:block pointer-events-none absolute left-14 whitespace-nowrap rounded-full bg-background/95 px-3 py-1 text-sm font-semibold text-foreground opacity-0 shadow-md ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100">
            Our Members
          </span>
        </button>
        {/* Always-visible clickable text */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-primary-foreground/95 hover:text-primary-foreground underline-offset-4 hover:underline font-semibold"
        >
          Our Members
        </button>
      </div>

      <CommunityDirectory isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

