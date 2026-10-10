import { defineChain } from "viem";

const parsedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "10143");
export const CHAIN_ID = Number.isInteger(parsedChainId) && parsedChainId > 0 ? parsedChainId : 10143;

export const MONAD_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz";

const rawExplorer = process.env.NEXT_PUBLIC_EXPLORER_URL;
export const EXPLORER_URL =
  rawExplorer === undefined ? "https://testnet.monadvision.com" : rawExplorer.replace(/\/$/, "");

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_RPC_URL] },
  },
  ...(EXPLORER_URL
    ? { blockExplorers: { default: { name: "Explorer", url: EXPLORER_URL } } }
    : {}),
});

export function chainIdHex() {
  return `0x${CHAIN_ID.toString(16)}` as const;
}

export function txUrl(hash: string) {
  if (!EXPLORER_URL) return null;
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string) {
  if (!EXPLORER_URL) return null;
  return `${EXPLORER_URL}/address/${address}`;
}
