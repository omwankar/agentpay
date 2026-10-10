import type { InputHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  invalid?: boolean;
  mono?: boolean;
};

export function Input({ label, hint, invalid, mono, id, className, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);

  return (
    <label className="block text-sm text-white/70" htmlFor={inputId}>
      {label}
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        className={cn(
          "mt-1.5 w-full rounded-xl border bg-[#0b0d12] px-3 py-2.5 text-sm text-white outline-none transition duration-200 placeholder:text-white/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid
            ? "border-red-500/80 focus:border-red-400 focus:ring-2 focus:ring-red-500/30"
            : "border-white/10 focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/35",
          mono && "font-mono",
          className,
        )}
        {...props}
      />
      {hint ? <span className={cn("mt-1.5 block text-xs", invalid ? "text-red-400" : "text-white/40")}>{hint}</span> : null}
    </label>
  );
}
