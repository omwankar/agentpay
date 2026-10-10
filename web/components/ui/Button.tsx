import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "dangerSolid" | "ghost" | "dangerGhost";
  icon?: boolean;
  tooltip?: string;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#2DD4BF] text-[#06241f] shadow-[0_8px_24px_rgba(45,212,191,0.28)] hover:-translate-y-0.5 hover:bg-[#5EEAD4] hover:shadow-[0_12px_28px_rgba(45,212,191,0.42)]",
  danger:
    "border border-red-500/70 bg-transparent text-red-300 hover:-translate-y-0.5 hover:bg-red-500/10 hover:shadow-[0_8px_24px_rgba(239,68,68,0.22)]",
  dangerSolid:
    "bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.28)] hover:-translate-y-0.5 hover:bg-red-400 hover:shadow-[0_12px_28px_rgba(239,68,68,0.4)]",
  ghost: "bg-transparent text-white/75 hover:bg-white/[0.06] hover:text-white",
  dangerGhost: "bg-transparent text-white/45 hover:bg-red-500/10 hover:text-red-300",
};

export function Button({
  variant = "primary",
  icon = false,
  tooltip,
  className,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const button = (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-200",
        "cursor-pointer active:translate-y-0 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none",
        disabled && tooltip && "pointer-events-none",
        icon && "h-8 w-8 px-0",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (!disabled || !tooltip) return button;

  return (
    <span className="group relative inline-flex cursor-not-allowed">
      {button}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#14161d] px-2.5 py-1.5 text-xs text-white/80 opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
}

export function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition duration-200 hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </a>
  );
}
