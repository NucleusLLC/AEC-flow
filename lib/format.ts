/**
 * Formatting helpers. Currency is parameterised so per-proposal/order currencies
 * render correctly, but when omitted it falls back to the org-wide System Currency
 * (set in Settings → Practice) rather than a hardcoded unit.
 */

// System monetary unit — the org-wide default applied across every module.
// Initialised once per process (server) and on the client by <SystemCurrencyInit>
// from the value persisted in Settings → Practice. Single-tenant, so a module
// global is the right fit; per-record currencies still override by passing `currency`.
//
// IMPORTANT (RSC ordering): server pages render BEFORE the (app) layout's
// setSystemCurrency runs, so on a cold render they'd format with this default.
// Seed the default from the SYSTEM_CURRENCY env on the server so server-rendered
// money (KPI tiles, etc.) matches the configured currency instead of falling back
// to the built-in default. The client still gets the live DB value via
// <SystemCurrencyInit>.
//
// LAST-RESORT DEFAULT ONLY. Keep it in step with DEFAULT_SYSTEM_CURRENCY in
// lib/server/practice-config.ts — that server value (DB → env → default) is what
// actually reaches the UI once the layout has run.
const ENV_SYSTEM_CURRENCY =
  typeof process !== "undefined" && /^[A-Za-z]{3}$/.test(process.env.SYSTEM_CURRENCY ?? "")
    ? (process.env.SYSTEM_CURRENCY as string).toUpperCase()
    : null;
let SYSTEM_CURRENCY = ENV_SYSTEM_CURRENCY ?? "AWG";
export function setSystemCurrency(currency: string | null | undefined): void {
  if (currency && /^[A-Za-z]{3}$/.test(currency)) SYSTEM_CURRENCY = currency.toUpperCase();
}
export function getSystemCurrency(): string {
  return SYSTEM_CURRENCY;
}

/**
 * Presentation locale for money, numbers and dates across the whole app.
 *
 * This is a LOCALE, not a currency: it decides digit grouping and date word
 * order, never which unit is shown (that's `SYSTEM_CURRENCY`). It used to be
 * "en-AE", which tied every rendered figure and date to the UAE. "en-GB" is the
 * region-neutral equivalent for this app: identical Latin digits and
 * `1,234,567.89` grouping, identical `24 Jul 2026` day-first dates (so nothing
 * regresses visually), and it matches the day-first convention used in Aruba —
 * whereas "en-US" would silently flip every date in the app to month-first.
 *
 * Single knob so a future per-tenant locale setting has one place to land.
 */
export const SYSTEM_LOCALE = "en-GB";

export function formatCurrency(
  amount: number | string,
  currency = SYSTEM_CURRENCY,
  options: Intl.NumberFormatOptions = {},
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(SYSTEM_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Compact currency, e.g. AWG 1.2M — for dashboard tiles. */
export function formatCurrencyCompact(amount: number | string, currency = SYSTEM_CURRENCY): string {
  return formatCurrency(amount, currency, { notation: "compact", maximumFractionDigits: 1 });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(SYSTEM_LOCALE).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(SYSTEM_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
