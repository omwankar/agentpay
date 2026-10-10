import { CATALOG, DEMO_DISCLAIMER } from "@/lib/catalog";
import { formatEther } from "viem";

export function GET() {
  return Response.json({
    disclaimer: DEMO_DISCLAIMER,
    items: CATALOG.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      priceWei: item.priceWei.toString(),
      priceMon: formatEther(item.priceWei),
    })),
  });
}
