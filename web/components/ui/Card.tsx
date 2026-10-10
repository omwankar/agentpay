import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function Card({ children, className, title, description, action }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
    >
      {title || action || description ? (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-medium tracking-tight text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-white/45">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
