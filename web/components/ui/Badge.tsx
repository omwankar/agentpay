import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type BadgeTone = "success" | "danger" | "neutral" | "warning" | "live";

const tones: Record<BadgeTone, string> = {
  success: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  danger: "bg-red-500/15 text-red-300 ring-red-400/35",
  neutral: "bg-white/[0.06] text-white/55 ring-white/10",
  warning: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
  live: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1",
        tones[tone],
      )}
    >
      {tone === "live" ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
      ) : null}
      {children}
    </span>
  );
}
