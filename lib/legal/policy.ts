/**
 * The facts the Terms of Service and Privacy Policy rest on, in one place.
 *
 * AEC-flow is a product of CADflow, the company behind cad-flow.com, and these
 * pages follow the beta terms CADflow publishes there: the operating legal
 * entity and governing law are finalised before general release, and beta
 * users are told before anything material changes.
 *
 * Bump TERMS_VERSION / PRIVACY_VERSION (an ISO date) whenever the text of the
 * page changes in substance. Every account records the versions it accepted
 * (see `termsAcceptance`), so a later change can be put to existing users.
 */

export const LEGAL = {
  operator: "CADflow",
  product: "AEC-flow",
  contactEmail: "hello@cad-flow.com",
  companySite: "https://cad-flow.com",
} as const;

export const TERMS_VERSION = "2026-10-01";
export const PRIVACY_VERSION = "2026-10-01";

/** The public paths of the two documents. proxy.ts keeps both reachable signed out. */
export const LEGAL_PATHS = { terms: "/terms", privacy: "/privacy" } as const;

/**
 * "2026-10-01" → "1 October 2026" in English, or the same date in the reader's
 * locale ("1 de octubre de 2026"). Read as a calendar date, not a moment, so no
 * time zone can move it to the day before.
 */
export function formatVersionDate(version: string, locale = "en-GB"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  const month = m ? Number(m[2]) : 0;
  const day = m ? Number(m[3]) : 0;
  if (!m || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Not an ISO date version: ${version}`);
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(m[1]), month - 1, day)));
}

/**
 * What an account stores, in its preferences JSON, when the person agrees to
 * the Terms and the Privacy Policy. No schema change: preferences already
 * carries the beta sign-up record.
 */
export function termsAcceptance(now: Date) {
  return {
    termsAcceptedAt: now.toISOString(),
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  };
}

export const TERMS_NOT_ACCEPTED = "Please accept the Terms of Service and Privacy Policy.";

/**
 * Where an account stands against the current Terms and Privacy Policy:
 *  - "current"  — it accepted both current versions;
 *  - "never"    — it has no acceptance on record (every account made before
 *                 the pages existed, on 1 Oct 2026);
 *  - "outdated" — it accepted an earlier version of either.
 */
export type TermsStatus = "current" | "never" | "outdated";

export function termsStatus(preferences: unknown): TermsStatus {
  const p = preferences && typeof preferences === "object" ? (preferences as Record<string, unknown>) : {};
  if (typeof p.termsVersion !== "string" && typeof p.privacyVersion !== "string") return "never";
  return p.termsVersion === TERMS_VERSION && p.privacyVersion === PRIVACY_VERSION ? "current" : "outdated";
}

/** The account's preferences with today's acceptance recorded; every other key kept. */
export function withTermsAcceptance(preferences: unknown, now: Date): Record<string, unknown> {
  const p = preferences && typeof preferences === "object" && !Array.isArray(preferences)
    ? (preferences as Record<string, unknown>)
    : {};
  return { ...p, ...termsAcceptance(now) };
}
