/**
 * The BBO contained in a proposal's price.
 *
 * PURE — no Prisma, no React, no I/O, and client-safe. It uses the module's own
 * exact-money primitive (engine/money.ts), so the figure agrees to the cent with
 * the engine's own tax arithmetic rather than being a second, drifting opinion.
 *
 * WHY IT IS STATED SEPARATELY. The practice quotes tax-inclusive: the fee a
 * client sees is what they pay, and the BBO is already inside it. That is fine
 * for the client and useless for the bookkeeping, because the amount owed to the
 * tax office every month is the part of those prices that was never the
 * practice's. So every proposal now states the contained figure, and the
 * accounting side can add up what is payable without re-deriving it from each
 * proposal's own settings.
 *
 * THE RATE COMES FROM THE PROPOSAL WHEN THE PROPOSAL SAYS. A proposal with tax
 * rows uses them — their name, their percentage, their mode. Only a proposal
 * with no tax configured at all falls back to the practice default below, and
 * `source` says which happened, so a screen can be honest about an assumption
 * rather than printing an invented certainty.
 */
import {
  allocate,
  applyPercent,
  fromMajor,
  money,
  subtract,
  sum,
  toMajor,
  zero,
} from "./engine/money";

/**
 * Aruba's turnover tax as the practice quotes it, in percent.
 *
 * It is the rate used only when a proposal carries no tax rows of its own.
 * Changing a rate here does NOT rewrite an issued proposal: the engine stores
 * each proposal's own tax rows, and those win.
 */
export const DEFAULT_BBO_PERCENT = 7;

export const DEFAULT_BBO_NAME = "BBO";

export type BboTaxRow = {
  name: string;
  percent: number;
  mode: "EXCLUSIVE" | "INCLUSIVE";
};

export type BboLine = {
  /** What to call it on the sheet — the proposal's own tax name when it has one. */
  name: string;
  percent: number;
  /** The tax contained in (or added to) the price, in major units. */
  amount: number;
  /** True when the price already contains it — the practice's normal case. */
  included: boolean;
  /** Where the rate came from. "default" means the proposal configured none. */
  source: "proposal" | "default";
};

/** The tax inside a gross figure: `gross − gross / (1 + p/100)`. */
export function bboContainedIn(gross: number | string | null | undefined, percent: number, currency: string): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const g = fromMajor(gross, currency);
  if (g.minor === 0) return 0;
  const net = money(Math.round(g.minor / (1 + percent / 100)), currency);
  return toMajor(subtract(g, net));
}

/** The tax added on top of a net figure. */
export function bboAddedTo(net: number | string | null | undefined, percent: number, currency: string): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return toMajor(applyPercent(fromMajor(net, currency), percent));
}

/**
 * The BBO line to show for a proposal.
 *
 * `taxTotal` is preferred when the proposal has tax rows, because it is the
 * engine's own figure — computed from the taxable subtotal after discounts,
 * which is not the same as a percentage of the grand total. The percentage is
 * only used to recompute when no engine figure was handed in.
 */
export function resolveBbo(args: {
  currency: string;
  /** The price the client pays. */
  grandTotal: number | string | null | undefined;
  /** The proposal's own tax rows, if any. */
  taxes?: BboTaxRow[] | null;
  /** The engine's computed tax total for this proposal, if known. */
  taxTotal?: number | string | null;
  /** The taxable subtotal the engine applied the tax to, if known. */
  taxableSubtotal?: number | string | null;
}): BboLine {
  const { currency } = args;
  const rows = (args.taxes ?? []).filter((t) => Number.isFinite(t.percent) && t.percent > 0);

  if (rows.length === 0) {
    // No tax configured on the proposal: state the practice's own rate as an
    // inclusive figure, because that is how the practice quotes.
    return {
      name: DEFAULT_BBO_NAME,
      percent: DEFAULT_BBO_PERCENT,
      amount: bboContainedIn(args.grandTotal, DEFAULT_BBO_PERCENT, currency),
      included: true,
      source: "default",
    };
  }

  const percent = rows.reduce((n, t) => n + t.percent, 0);
  const included = rows.every((t) => t.mode === "INCLUSIVE");
  // One row keeps its own name ("BBO", "BBO/BAZV"); several are summed and take
  // the practice's generic name rather than inventing a combined one.
  const name = rows.length === 1 ? rows[0].name.trim() || DEFAULT_BBO_NAME : DEFAULT_BBO_NAME;

  const engineFigure =
    args.taxTotal === null || args.taxTotal === undefined ? null : fromMajor(args.taxTotal, currency);
  if (engineFigure && engineFigure.minor !== 0) {
    return { name, percent, amount: toMajor(engineFigure), included, source: "proposal" };
  }

  const base = args.taxableSubtotal ?? args.grandTotal;
  return {
    name,
    percent,
    amount: included
      ? bboContainedIn(base, percent, currency)
      : bboAddedTo(base, percent, currency),
    included,
    source: "proposal",
  };
}

/**
 * The sentence printed under the figure. Short on purpose: the client needs to
 * know the price is not about to grow, and the bookkeeper needs to know the
 * figure is not an addition to it.
 */
export function bboNote(line: BboLine): string {
  return line.included
    ? `${line.name} is included in the price.`
    : `${line.name} is added to the price.`;
}

/**
 * The BBO inside each payment milestone.
 *
 * WHY THIS IS AN ALLOCATION AND NOT A PERCENTAGE OF EACH ROW. Backing 7% out of
 * each milestone separately and adding the results up does not reliably give the
 * BBO of the whole — the roundings do not have to agree — and a schedule whose
 * column does not add up to the figure above it is a schedule a bookkeeper stops
 * trusting. So the proposal's BBO is split across the milestones by their
 * amounts, largest-remainder, which sums to the total exactly.
 *
 * The result is per milestone id, so the month a milestone is invoiced is the
 * month its BBO becomes payable.
 */
export function bboPerMilestone(
  milestones: { id: string; amount: number | string | null | undefined }[],
  bboAmount: number | string | null | undefined,
  currency: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (milestones.length === 0) return out;
  const total = fromMajor(bboAmount, currency);
  const weights = milestones.map((m) => {
    const w = toMajor(fromMajor(m.amount, currency));
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const shares = allocate(total, weights);
  milestones.forEach((m, i) => {
    out[m.id] = toMajor(shares[i]);
  });
  return out;
}

/** What a month's BBO comes to across several proposals, to the cent. */
export function bboTotal(lines: { amount: number }[], currency: string): number {
  return toMajor(
    lines.length === 0
      ? zero(currency)
      : sum(
          lines.map((l) => fromMajor(l.amount, currency)),
          currency,
        ),
  );
}
