/**
 * The payment schedule. PURE — no Prisma, no React, no model.
 *
 * ─── THE FIGURES ARE OURS, NOT THE MODEL'S ──────────────────────────────────
 * A language model asked for "40% of AWG 1,275,000" will usually get it right,
 * and "usually" is not a standard a payment schedule can be held to. So the
 * model is told the numbers and never asked for one: this module computes every
 * instalment from the contract sum in integer cents, through the repo's one
 * exact-money primitive, and the document is corrected to match before it is
 * stored.
 *
 * ─── THE COLUMN MUST SUM TO THE CONTRACT SUM, TO THE CENT ───────────────────
 * Percentages of a sum do not divide evenly — three instalments of 33.33% of
 * AWG 1,000,000 leave a cent on the table, and a contract whose schedule adds
 * up to a cent less than its own price is a contract somebody will argue about.
 * `allocate` distributes the remainder, and the check at the end of
 * `buildSchedule` proves the result ties.
 *
 * ─── THE DOLLAR COLUMN IS A COURTESY, AND SAYS SO ───────────────────────────
 * Contracts here are written in Afl. with a US$ column beside it for the
 * client's benefit. The dollars are converted PER ROW from the florin amount,
 * so each line is individually checkable; the dollar total is the sum of those
 * rows, not a separate conversion of the total, or the column would not add up
 * on screen.
 */
import {
  add,
  allocate,
  fromMajor,
  multiply,
  subtract,
  sum,
  toMajor,
  zero,
  type Money,
} from "@/lib/proposals/engine/money";
import { DEFAULT_EXCHANGE_RATE, type ContractPhase, type PhaseInput } from "./types";

export type ScheduleTotals = {
  percent: number;
  amountAwg: number;
  amountUsd: number;
};

export type BuiltSchedule = {
  rows: ContractPhase[];
  totals: ScheduleTotals;
  /** True when the rows add up to the contract sum exactly. */
  ties: boolean;
  /** Human-readable problems: percentages that do not total 100, and so on. */
  warnings: string[];
};

/** Percentages are entered to two decimals; 33.333% is not a payment term. */
export function roundPercent(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function totalPercent(phases: Pick<PhaseInput, "percent">[]): number {
  return Math.round(phases.reduce((t, p) => t + roundPercent(p.percent), 0) * 100) / 100;
}

/** Within a hundredth of a point. Floating point makes exact equality a lie. */
export function percentsTotalHundred(phases: Pick<PhaseInput, "percent">[]): boolean {
  return Math.abs(totalPercent(phases) - 100) < 0.005;
}

export function usdFrom(amountAwg: number, rate: number, currency: string): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return toMajor(multiply(fromMajor(amountAwg, currency), 1 / rate));
}

/**
 * Build the schedule rows from the contract sum and the entered percentages.
 *
 * `allocate` splits the sum by weight in minor units and hands the remainder to
 * the last row, which is exactly where a contractor expects it: the final
 * instalment absorbs the rounding, never the deposit.
 */
export function buildSchedule(input: {
  contractSum: number;
  currency: string;
  exchangeRate?: number;
  phases: PhaseInput[];
}): BuiltSchedule {
  const currency = input.currency || "AWG";
  const rate = Number.isFinite(input.exchangeRate ?? NaN) && (input.exchangeRate as number) > 0
    ? (input.exchangeRate as number)
    : DEFAULT_EXCHANGE_RATE;

  const phases = (input.phases ?? []).filter((p) => roundPercent(p.percent) > 0);
  const warnings: string[] = [];

  if (phases.length === 0) {
    return {
      rows: [],
      totals: { percent: 0, amountAwg: 0, amountUsd: 0 },
      ties: true,
      warnings: [],
    };
  }

  const total = fromMajor(input.contractSum, currency);
  if (total.minor <= 0) {
    warnings.push("There is no contract sum, so the instalments have no amounts.");
  }

  const percents = phases.map((p) => roundPercent(p.percent));
  const pct = totalPercent(phases);
  if (Math.abs(pct - 100) >= 0.005) {
    warnings.push(
      `The instalments total ${pct}%, not 100%. The amounts below still divide the whole contract sum.`,
    );
  }

  // Weights, not percentages: allocate normalises them, so a schedule that
  // totals 95% still divides the whole sum rather than leaving 5% unbilled.
  const parts: Money[] = total.minor > 0 ? allocate(total, percents) : percents.map(() => zero(currency));

  const rows: ContractPhase[] = phases.map((p, i) => {
    const amountAwg = toMajor(parts[i]);
    return {
      phase: String(p.phase ?? "").trim() || String(i + 1),
      description: String(p.description ?? "").trim(),
      detail: String(p.detail ?? "").trim(),
      percent: percents[i],
      amountAwg,
      amountUsd: usdFrom(amountAwg, rate, currency),
    };
  });

  const summed = sum(
    rows.map((r) => fromMajor(r.amountAwg, currency)),
    currency,
  );
  const ties = total.minor <= 0 || summed.minor === total.minor;
  if (!ties) {
    // Belt and braces: allocate guarantees this, and a schedule is the wrong
    // place to trust a guarantee without checking it.
    warnings.push(
      `The instalments add up to ${toMajor(summed)}, not ${toMajor(total)}. Check the percentages.`,
    );
  }

  return {
    rows,
    totals: {
      percent: pct,
      amountAwg: toMajor(summed),
      amountUsd: toMajor(
        sum(
          rows.map((r) => fromMajor(r.amountUsd, currency)),
          currency,
        ),
      ),
    },
    ties,
    warnings,
  };
}

/**
 * Replace whatever the model put in the schedule with the computed rows,
 * keeping the model's WORDS where it supplied better ones.
 *
 * The model reads the template, so its instalment names ("Reservation and
 * Initial Deposit") are usually the contract's own and better than the label a
 * user typed in a form field. Its numbers are never used.
 */
export function reconcileSchedule(
  computed: ContractPhase[],
  fromModel: Partial<ContractPhase>[] | undefined,
): ContractPhase[] {
  if (!Array.isArray(fromModel) || fromModel.length === 0) return computed;
  return computed.map((row, i) => {
    const m = fromModel[i];
    if (!m) return row;
    return {
      ...row,
      phase: String(m.phase ?? row.phase).trim() || row.phase,
      description: String(m.description ?? "").trim() || row.description,
      detail: String(m.detail ?? "").trim() || row.detail,
    };
  });
}

/** `1 US$ = AWG 1.75` — the line that prints under the schedule. */
export function exchangeRateLine(rate: number, currency = "AWG"): string {
  const r = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_EXCHANGE_RATE;
  return `Converted at 1 US$ = ${currency} ${r.toFixed(2)}`;
}

/**
 * The contract sum in words, as contracts write it.
 *
 * WHY THIS EXISTS RATHER THAN A LIBRARY. A contract says "one million two
 * hundred seventy-five thousand Aruban florins and 00/100", and the cents are
 * written as a fraction, not as words — that convention is the point, and it is
 * three lines of code once the number itself is spelled. English only: a Dutch
 * or Spanish template gets its amount in words from the model, which is reading
 * a document already written in that language.
 */
export function amountInWords(amount: number, currencyWord = "Aruban florins"): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  return `${spellOut(whole)} ${currencyWord} and ${String(cents).padStart(2, "0")}/100`;
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

function spellOut(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const r = n % 10;
    return r ? `${t}-${ONES[r]}` : t;
  }
  if (n < 1000) {
    const h = `${ONES[Math.floor(n / 100)]} hundred`;
    const r = n % 100;
    return r ? `${h} ${spellOut(r)}` : h;
  }
  for (const [value, name] of SCALES) {
    if (n >= value) {
      const head = `${spellOut(Math.floor(n / value))} ${name}`;
      const r = n % value;
      return r ? `${head} ${spellOut(r)}` : head;
    }
  }
  return String(n);
}

/** Retention held back per instalment, when the contract has a retention term. */
export function retentionOn(amount: number, percent: number | null, currency: string): number {
  if (!percent || !Number.isFinite(percent) || percent <= 0) return 0;
  return toMajor(multiply(fromMajor(amount, currency), percent / 100));
}

/** What is actually paid on an instalment once retention is held. */
export function netOfRetention(amount: number, percent: number | null, currency: string): number {
  const held = retentionOn(amount, percent, currency);
  if (held === 0) return amount;
  return toMajor(subtract(fromMajor(amount, currency), fromMajor(held, currency)));
}

/** Sum of a column, for a caller that has rows but not the builder. */
export function columnTotal(rows: { amountAwg: number }[], currency: string): number {
  return toMajor(
    rows.reduce((acc, r) => add(acc, fromMajor(r.amountAwg, currency)), zero(currency)),
  );
}
