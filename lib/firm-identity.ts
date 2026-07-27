/**
 * Firm identity for printed / previewed documents — the practice's OWN name and
 * location, never a hardcoded one.
 *
 * Printed documents used to carry "ZenArch Consultants · Dubai, United Arab
 * Emirates" in their bodies and footers. That is the founder company's identity,
 * so every other tenant's proposals, orders, estimates and minutes went out under
 * the wrong firm. Documents now resolve the name and location from Settings →
 * Practice.
 *
 * Two resolution paths, deliberately:
 *
 * 1. **Server print routes pass the values as props.** This is the authoritative
 *    path and the only one used on the server.
 * 2. **In-app preview modals read the module global below.** They are client
 *    components nested several levels inside client-only views, so threading a
 *    prop from a server parent would mean touching every intermediate view. The
 *    global is seeded once per page load by `<FirmIdentityInit>` in the (app)
 *    layout — the same pattern `lib/format.ts` uses for the System Currency.
 *
 * MULTI-TENANCY: the global is seeded **only in the browser bundle** (the init
 * component is "use client"). A server-side module global is per-process and
 * shared across concurrent requests, so seeding it there could bleed one tenant's
 * firm name into another tenant's document. On the server the global stays empty
 * and the explicit props apply. Do not add a server-side `setFirmIdentity` call.
 */

export type FirmIdentity = { name: string; location: string };

let FIRM: FirmIdentity = { name: "", location: "" };

/** Seeds the client-side identity. Called by <FirmIdentityInit> only — see above. */
export function setFirmIdentity(firm: Partial<FirmIdentity> | null | undefined): void {
  if (!firm) return;
  FIRM = { name: (firm.name ?? "").trim(), location: (firm.location ?? "").trim() };
}

export function getFirmIdentity(): FirmIdentity {
  return FIRM;
}

/**
 * Practice name for document text: explicit prop → configured identity → fallback.
 * The fallback only shows for a company that has not filled in Settings → Practice.
 */
export function firmName(override?: string, fallback = "AEC-flow"): string {
  return override?.trim() || FIRM.name || fallback;
}

/**
 * Location line for document footers. Returns "" when nothing is configured —
 * callers must drop the segment rather than print a placeholder address.
 */
export function firmLocation(override?: string): string {
  return override?.trim() || FIRM.location;
}

/**
 * Builds a footer location line from a practice profile. `emirate` is the
 * profile's region field (a UAE-era name kept for schema compatibility); it is
 * skipped when blank or when it merely repeats the city.
 *
 * "n/a"-style placeholders are dropped too: the region field is optional in most
 * countries, and testers type "na" / "-" rather than leaving it empty — printing
 * that on a client-facing footer looks like a bug.
 */
const PLACEHOLDER_PART = /^(n\/?a|none|-{1,2}|\.)$/i;

export function practiceLocationLine(p: {
  city?: string;
  emirate?: string;
  country?: string;
}): string {
  const parts = [p.city, p.emirate, p.country]
    .map((s) => (s ?? "").trim())
    .filter((s) => s && !PLACEHOLDER_PART.test(s));
  return parts.filter((s, i) => parts.indexOf(s) === i).join(", ");
}

/** Joins document footer segments, dropping any that are empty. */
export function documentFooterLine(...segments: (string | null | undefined)[]): string {
  return segments.map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
}
