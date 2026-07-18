/**
 * Material-selection money math. PURE — no I/O — so it's reused on the server
 * (persisted total) and the client (live preview) without drift.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Extended cost for a selection line (quantity × unit cost). */
export function materialTotal(input: { quantity?: number; unitCost?: number }): number {
  return round2(n(input.quantity) * n(input.unitCost));
}
