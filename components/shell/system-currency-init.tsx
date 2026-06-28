"use client";

import { setSystemCurrency } from "@/lib/format";

/**
 * Seeds the client-side System Currency global from the server value, before any
 * sibling renders, so `formatCurrency()` (called without an explicit currency)
 * uses the configured org-wide unit on the very first client render too — no
 * hydration mismatch. Rendered first in the app layout.
 */
export function SystemCurrencyInit({ currency }: { currency: string }) {
  setSystemCurrency(currency);
  return null;
}
