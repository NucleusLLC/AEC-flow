/**
 * Exact money arithmetic for the Service Proposal module.
 *
 * WHY THIS EXISTS
 * ---------------
 * The rest of the application computes money as JavaScript `number` with local
 * `round2()` helpers. That is adequate for an internal estimate but not for a
 * contractual fee document, where a fee split across phases must reconcile to the
 * total exactly and a payment schedule must sum to the penny. Binary floating point
 * cannot promise that: 0.1 + 0.2 !== 0.3, and a 3-way split of 100.00 loses a cent.
 *
 * So inside this module money is an INTEGER COUNT OF MINOR UNITS (cents) and every
 * operation stays on integers. Conversion to/from `number` / `Prisma.Decimal` happens
 * only at the persistence and presentation boundaries.
 *
 * SCOPE OF THE GUARANTEE (stated honestly — see docs/proposal-module/03-CRITICAL-REVIEW.md §A6)
 * Exactness holds *within* a proposal. The cost basis may arrive from the protected
 * Estimates system as a float, so the input can carry imprecision this module cannot undo.
 * What is eliminated here are the allocation and reconciliation errors — the ones that
 * produce a visibly wrong document.
 *
 * PURE: no I/O, no Prisma, no React. Safe to import from client components for preview.
 */

/** An exact monetary amount, carried as a whole number of minor units (e.g. cents). */
export interface Money {
  /** Signed integer count of minor units. */
  readonly minor: number;
  /** ISO 4217 code, e.g. "USD", "AWG". */
  readonly currency: string;
}

/** Minor units per major unit. 2 covers every currency this application supports. */
export const MINOR_UNITS = 100;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertInteger(minor: number): void {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    throw new MoneyError(`Money must be a whole number of minor units, received ${minor}`);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(`Money value ${minor} exceeds safe integer range`);
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

/** Round half-up (away from zero on .5), the convention used for invoiced amounts. */
function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function money(minor: number, currency: string): Money {
  assertInteger(minor);
  return { minor, currency };
}

export function zero(currency: string): Money {
  return { minor: 0, currency };
}

/**
 * Build Money from a major-unit amount (what a user types, or what the DB returns).
 * Fractions beyond the minor unit are rounded half-up — this is the single point where
 * an imprecise input becomes exact, and it is deliberate.
 */
export function fromMajor(amount: number | string | null | undefined, currency: string): Money {
  if (amount === null || amount === undefined || amount === "") return zero(currency);
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) {
    throw new MoneyError(`Cannot convert ${JSON.stringify(amount)} to money`);
  }
  // Scale first, then round — Math.round(2.675 * 100) is exact where 2.675 alone is not.
  return { minor: roundHalfUp(n * MINOR_UNITS), currency };
}

/** Major-unit number, for persistence (Prisma Decimal accepts this) and formatting. */
export function toMajor(m: Money): number {
  return m.minor / MINOR_UNITS;
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function sum(items: Money[], currency: string): Money {
  return items.reduce<Money>((acc, m) => add(acc, m), zero(currency));
}

export function negate(m: Money): Money {
  return money(-m.minor, m.currency);
}

export function isZero(m: Money): boolean {
  return m.minor === 0;
}

export function isNegative(m: Money): boolean {
  return m.minor < 0;
}

/** Floor a negative amount at zero — used where a typo must not create a negative fee. */
export function clampToZero(m: Money): Money {
  return m.minor < 0 ? zero(m.currency) : m;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.minor === b.minor ? 0 : a.minor < b.minor ? -1 : 1;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor;
}

/**
 * Apply a percentage rate. `percent` is expressed as a human percentage (7.5 means 7.5%).
 * Rounded half-up to the minor unit.
 */
export function applyPercent(m: Money, percent: number): Money {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`Percentage must be finite, received ${percent}`);
  }
  return money(roundHalfUp((m.minor * percent) / 100), m.currency);
}

/** Multiply by a plain factor (e.g. quantity × unit price, or a 1.1 markup). */
export function multiply(m: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Factor must be finite, received ${factor}`);
  }
  return money(roundHalfUp(m.minor * factor), m.currency);
}

/**
 * Split an amount across weights so the parts sum EXACTLY to the original.
 *
 * Largest-remainder method: floor every share, then hand the leftover minor units out one
 * at a time to the shares with the largest fractional remainders (ties broken by original
 * order, so the result is deterministic). This is what makes a 10/15/35/40 phase split of
 * any fee reconcile precisely, and why a 3-way split of 100.00 yields 33.34/33.33/33.33
 * rather than losing a cent.
 *
 * Weights need not sum to 100 — they are treated as relative shares. All-zero weights (or
 * an empty list) return zeros, never NaN.
 */
export function allocate(total: Money, weights: number[]): Money[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError("Allocation weights must be finite and non-negative");
  }

  const weightTotal = weights.reduce((s, w) => s + w, 0);
  if (weightTotal <= 0) return weights.map(() => zero(total.currency));

  const sign = total.minor < 0 ? -1 : 1;
  const absTotal = Math.abs(total.minor);

  const exact = weights.map((w) => (absTotal * w) / weightTotal);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = absTotal - floored.reduce((s, v) => s + v, 0);

  // Distribute the leftover units to the largest fractional remainders first.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac === a.frac ? a.i - b.i : b.frac - a.frac));

  const result = [...floored];
  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    result[order[k].i] += 1;
    remainder -= 1;
  }

  return result.map((minor) => money(sign * minor, total.currency));
}

/**
 * Split by explicit percentages that are expected to total 100. Unlike `allocate`, the
 * percentages are honoured literally — if they total 97, only 97% is distributed and the
 * shortfall is the caller's to report as a warning. Use `allocate` when the whole amount
 * must be consumed regardless.
 */
export function allocateByPercent(total: Money, percentages: number[]): Money[] {
  return percentages.map((p) => applyPercent(total, p));
}

/** Locale-independent plain string, e.g. "1234.50". For display use `formatCurrency`. */
export function toPlainString(m: Money): string {
  const sign = m.minor < 0 ? "-" : "";
  const abs = Math.abs(m.minor);
  const major = Math.floor(abs / MINOR_UNITS);
  const minor = abs % MINOR_UNITS;
  return `${sign}${major}.${String(minor).padStart(2, "0")}`;
}
