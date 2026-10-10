"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { shortAddress } from "@/components/ui/format";

export function AddressPill({ address, className }: { address: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1",
        className,
      )}
    >
      <span className="font-mono text-sm text-white/90">{shortAddress(address)}</span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy address"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition duration-200 hover:bg-white/10 hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
