import { parseEther } from "viem";

export type CatalogItem = {
  id: string;
  kind: "movie" | "flight";
  name: string;
  priceWei: bigint;
};

export const DEMO_DISCLAIMER =
  "DEMO MERCHANT. Monad testnet only. Not affiliated with BookMyShow.";

export const CATALOG: CatalogItem[] = [
  { id: "movie-midnight", kind: "movie", name: "Midnight Protocol", priceWei: parseEther("0.05") },
  { id: "movie-parallel", kind: "movie", name: "Parallel City", priceWei: parseEther("0.05") },
  { id: "movie-finality", kind: "movie", name: "Finality", priceWei: parseEther("0.05") },
  { id: "flight-bom", kind: "flight", name: "PNQ to BOM", priceWei: parseEther("0.3") },
  { id: "flight-del", kind: "flight", name: "PNQ to DEL", priceWei: parseEther("0.3") },
];

export function findItem(id: string) {
  return CATALOG.find((item) => item.id === id) ?? null;
}
