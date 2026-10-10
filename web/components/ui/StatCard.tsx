import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type StatTone = "teal" | "sky" | "amber" | "emerald";

const toneClass: Record<StatTone, string> = {
  teal: "bg-[#2DD4BF]",
  sky: "bg-[#38BDF8]",
  amber: "bg-[#FBBF24]",
  emerald: "bg-emerald-400",
};

type StatCardProps = {
  label: string;
  value: string;
  unit?: string;
  loading?: boolean;
  tone?: StatTone;
  children?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, unit, loading, tone = "teal", children, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition duration-200 hover:border-white/15 hover:bg-white/[0.045]",
        className,
      )}
    >
      <span className={cn("mb-3 h-1 w-8 rounded-full", toneClass[tone])} />
      <p className="text-xs font-medium tracking-wide text-white/45">{label}</p>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-28 rounded-lg" />
      ) : (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-2xl leading-none tracking-tight text-white sm:text-[1.7rem]">{value}</span>
          {unit ? <span className="text-xs font-medium tracking-wide text-white/40">{unit}</span> : null}
        </p>
      )}
      {children ? (
        loading ? (
          <div className="skeleton mt-4 h-8 w-full rounded-lg" />
        ) : (
          <div className="mt-4">{children}</div>
        )
      ) : null}
    </article>
  );
}
