import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgentPay",
    short_name: "AgentPay",
    description: "Spending rules for AI agents on Monad testnet.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#07110F",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
