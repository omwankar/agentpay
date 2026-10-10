import { formatEther } from "viem";

export function shortAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatMon(value: bigint) {
  const [whole, frac = ""] = formatEther(value).split(".");
  if (!frac || /^0+$/.test(frac)) return whole;
  const cut = frac.slice(0, 6).replace(/0+$/, "");
  return cut ? `${whole}.${cut}` : whole;
}

export function formatAgo(timestamp: number, now: number) {
  const delta = Math.max(0, Math.round((now - timestamp) / 1000));
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const minutes = Math.floor(delta / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function spentRatio(spent: bigint, budget: bigint) {
  if (budget <= 0n) return spent > 0n ? 100 : 0;
  return Number((spent * 10000n) / budget) / 100;
}

const SCAN = "https://testnet.monadscan.com";

export function scanTxUrl(hash: string) {
  return `${SCAN}/tx/${hash}`;
}

export function scanAddressUrl(address: string) {
  return `${SCAN}/address/${address}`;
}
