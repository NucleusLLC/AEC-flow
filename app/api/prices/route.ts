import { NextResponse } from "next/server";
import { ARUBA_PRICES, type PriceItem } from "@/lib/data/price-lists";

/**
 * Live local-price fetch for the estimating Price Lists.
 *
 * Today this returns the seeded Aruba supplier catalogue (APEX, Kooyman) with a
 * small market jitter so the "Refresh live prices" button shows movement.
 *
 * TODO(live): wire the real AI/web fetch here — read current shelf prices from
 * APEX (ready-mix concrete, 4"/6"/8" blocks) and kooymanbv.com (wood, plywood,
 * screws, paint, stucco, lumber, plumbing), normalise to PriceItem[] and return.
 * This route is the single integration point; the UI already consumes its shape.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? "Aruba";
  const supplier = url.searchParams.get("supplier"); // optional filter: APEX | Kooyman

  let prices: PriceItem[] = ARUBA_PRICES.filter((p) => (p.region ?? "Aruba") === region);
  if (supplier) prices = prices.filter((p) => (p.supplier ?? "").toLowerCase() === supplier.toLowerCase());

  // Simulated live movement (±3%) until the real fetch is wired.
  const fetched = prices.map((p) => {
    const drift = 1 + (Math.random() - 0.5) * 0.06;
    return { ...p, unitPrice: Math.round(p.unitPrice * drift * 100) / 100 };
  });

  return NextResponse.json(
    {
      region,
      source: ["APEX", "kooymanbv.com"],
      fetchedAt: new Date().toISOString(),
      live: false, // flip to true once the real integration is connected
      prices: fetched,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
