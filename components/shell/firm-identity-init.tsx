"use client";

import { setFirmIdentity, type FirmLogo } from "@/lib/firm-identity";

/**
 * Seeds the client-side firm identity from the server value, before any sibling
 * renders, so in-app document previews show the practice's own name, location
 * and logo on the very first client render — no hydration mismatch. Rendered in
 * the app layout alongside <SystemCurrencyInit>.
 *
 * The logo matters here: preview modals are nested inside client-only views and
 * receive no logo prop, so without this seed a preview would show a text
 * wordmark while the printed document showed the uploaded logo.
 *
 * Client-only by design: see the multi-tenancy note in lib/firm-identity.ts.
 */
export function FirmIdentityInit({
  name,
  location,
  logo,
}: {
  name: string;
  location: string;
  logo: FirmLogo;
}) {
  setFirmIdentity({ name, location, logo });
  return null;
}
