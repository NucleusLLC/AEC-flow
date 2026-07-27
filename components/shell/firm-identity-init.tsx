"use client";

import { setFirmIdentity } from "@/lib/firm-identity";

/**
 * Seeds the client-side firm identity from the server value, before any sibling
 * renders, so in-app document previews show the practice's own name and location
 * on the very first client render — no hydration mismatch. Rendered in the app
 * layout alongside <SystemCurrencyInit>.
 *
 * Client-only by design: see the multi-tenancy note in lib/firm-identity.ts.
 */
export function FirmIdentityInit({ name, location }: { name: string; location: string }) {
  setFirmIdentity({ name, location });
  return null;
}
