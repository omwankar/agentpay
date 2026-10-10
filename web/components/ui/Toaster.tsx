"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "border border-white/10 bg-[#12141c] text-white shadow-xl",
          title: "text-sm font-medium",
          description: "text-xs text-white/70",
        },
      }}
    />
  );
}
