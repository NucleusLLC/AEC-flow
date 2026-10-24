/**
 * What a proposal's payment milestone is worth ON AN INVOICE. PURE — no Prisma,
 * no React, no I/O.
 *
 * WHY THIS FILE EXISTS. The fee engine splits the proposal's GRAND TOTAL across
 * its payment milestones (lib/proposals/engine/engine.ts, "Payment schedule (of
 * the grand total)"). When the proposal's tax is added on top of the price, the
 * grand total already contains that tax, and so does every milestone amount.
 * An invoice raised from a milestone used to take that amount as its line and
 * then add the same tax again: a 535.00 milestone (500.00 + 7%) was invoiced as
 * 572.45. The client was billed the tax twice.
 *
 * The rule here: an invoice line carries the milestone BEFORE an added tax, and
 * the invoice adds the tax once. 500.00 + 7% = 535.00, the figure the client
 * accepted. A tax that is included in the price was never the problem — its
 * milestone amounts are gross, the invoice backs the tax out of them, and they
 * are left exactly as they were.
 *
 * Shares are allocated, not computed row by row, so the milestones of a
 * schedule that totals 100% add up to the proposal's own figures to the cent.
 *
 * MONEY IS NEVER A FLOAT HERE: lib/proposals/engine/money.ts, as everywhere else.
 */
import { allocate, fromMajor, multiply, subtract, sum, toMajor, zero, type Money } from "@/lib/proposals/engine/money";
import type { InvoiceLineInput, TaxMode } from "./types";

export type ProposalTaxRow = {
  name: string;
  percent: number | string | null | undefined;
  mode: TaxMode;
};

export type MilestoneBasisInput = {
  currency: string;
  /** The proposal's stored figures, as the fee engine wrote them. */
  grandTotal: number | string | null | undefined;
  taxTotal: number | string | null | undefined;
  taxableSubtotal: number | string | null | undefined;
  taxes: ProposalTaxRow[];
  /** `amount` is the milestone's share of the grand total. */
  milestones: { id: string; amount: number | string | null | undefined }[];
};

export type MilestoneBasis = {
  /** The tax an invoice raised from this proposal carries. */
  taxName: string | null;
  taxPercent: number;
  taxMode: TaxMode;
  /**
   * The invoice's second tax (BBO + BAVP): same mode, same taxable amounts, not
   * compounded. Null / 0 unless the proposal has exactly two taxes in one mode.
   */
  tax2Name: string | null;
  tax2Percent: number;
  /** True when the amounts below are before tax and the invoice adds it. */
  taxOnTop: boolean;
  /**
   * Per milestone id: `billable` is what an invoice line may carry in total,
   * `taxable` is the part of it the tax applies to (the rest is not taxed).
   */
  amounts: Record<string, { billable: number; taxable: number }>;
  /** Things the person raising the invoice has to be told. Plain English. */
  warnings: string[];
};

const percentOf = (t: ProposalTaxRow): number => {
  const n = Number(t.percent);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** total x part / whole, to the cent; the whole of it when there is no whole. */
function scale(total: Money, part: Money, whole: Money): Money {
  if (whole.minor <= 0) return total;
  if (part.minor >= whole.minor) return total;
  return multiply(total, Math.max(0, part.minor) / whole.minor);
}

/**
 * The invoice basis of every milestone on a proposal: what each may be billed,
 * how much of that is taxed, and the one tax snapshot the invoice carries.
 */
export function milestoneBasis(input: MilestoneBasisInput): MilestoneBasis {
  const { currency } = input;
  const active = input.taxes.filter((t) => percentOf(t) > 0);
  const warnings: string[] = [];

  const gross = input.milestones.map((m) => {
    const g = fromMajor(m.amount, currency);
    return g.minor > 0 ? g : zero(currency);
  });
  const grossSum = gross.length ? sum(gross, currency) : zero(currency);
  const grandTotal = fromMajor(input.grandTotal, currency);
  const taxTotal = fromMajor(input.taxTotal, currency);
  const taxableSubtotal = fromMajor(input.taxableSubtotal, currency);
  const weights = gross.map((g) => g.minor);

  const build = (
    billable: Money[],
    taxable: Money[],
    tax: Pick<MilestoneBasis, "taxName" | "taxPercent" | "taxMode" | "taxOnTop"> &
      Partial<Pick<MilestoneBasis, "tax2Name" | "tax2Percent">>,
  ): MilestoneBasis => {
    const amounts: MilestoneBasis["amounts"] = {};
    input.milestones.forEach((m, i) => {
      const b = billable[i];
      const t = taxable[i].minor > b.minor ? b : taxable[i];
      amounts[m.id] = { billable: toMajor(b), taxable: toMajor(t) };
    });
    return { tax2Name: null, tax2Percent: 0, ...tax, amounts, warnings };
  };

  // No tax at all: the milestone is the line, as it always was.
  if (active.length === 0) {
    const first = input.taxes[0];
    return build(gross, gross, {
      taxName: first?.name?.trim() || null,
      taxPercent: 0,
      taxMode: first?.mode ?? "EXCLUSIVE",
      taxOnTop: false,
    });
  }

  const modes = new Set(active.map((t) => t.mode));
  const name = active.map((t) => t.name.trim()).filter(Boolean).join(" + ") || null;
  const percent = Math.round(active.reduce((n, t) => n + percentOf(t), 0) * 10000) / 10000;

  // A tax that is included and a tax that is added, on one proposal. One
  // invoice carries one tax in one mode, so neither can be reproduced honestly.
  // Bill the milestone as accepted and add nothing: the total is right, and the
  // person is told to set the tax themselves.
  if (modes.size > 1) {
    warnings.push(
      "This proposal has a tax that is included in the price and a tax that is added to it. The milestone amounts already contain both, so no tax is added to this invoice. Check the tax before issuing it.",
    );
    return build(gross, gross, { taxName: null, taxPercent: 0, taxMode: "EXCLUSIVE", taxOnTop: false });
  }

  // The tax snapshot the invoice carries. Two taxes in one mode (BBO + BAVP)
  // travel as the invoice's two taxes, each on the same taxable amounts, so the
  // combined rate, and every amount below, is unchanged. Three or more still
  // fold into one line, and the person is told.
  let snapshot: Pick<MilestoneBasis, "taxName" | "taxPercent" | "tax2Name" | "tax2Percent"> = {
    taxName: name,
    taxPercent: percent,
    tax2Name: null,
    tax2Percent: 0,
  };
  if (active.length === 2) {
    snapshot = {
      taxName: active[0].name.trim() || null,
      taxPercent: percentOf(active[0]),
      tax2Name: active[1].name.trim() || null,
      tax2Percent: percentOf(active[1]),
    };
  } else if (active.length > 2) {
    warnings.push(
      `This proposal has ${active.length} taxes (${name}). An invoice carries at most two tax lines, so they are combined as ${percent}%.`,
    );
  }

  // Included in the price: the milestone amounts are gross and stay gross. The
  // taxed part of each is its share of the proposal's taxable subtotal.
  if (modes.has("INCLUSIVE")) {
    const taxableShare = allocate(scale(taxableSubtotal, grossSum, grandTotal), weights);
    return build(gross, taxableShare, { ...snapshot, taxMode: "INCLUSIVE", taxOnTop: false });
  }

  // Added on top: take the tax back out of every milestone, once, so the
  // invoice can add it once.
  const net = subtract(grandTotal, taxTotal);
  const netShare = allocate(scale(net.minor > 0 ? net : zero(currency), grossSum, grandTotal), weights);
  const taxableShare = allocate(
    scale(taxableSubtotal.minor > net.minor ? net : taxableSubtotal, grossSum, grandTotal),
    weights,
  );
  return build(netShare, taxableShare, { ...snapshot, taxMode: "EXCLUSIVE", taxOnTop: true });
}

/**
 * The invoice lines for what is left of one milestone.
 *
 * Usually one line. When part of the proposal is not taxed (a reimbursable
 * passed on without tax, say), the milestone carries that same proportion, so
 * it becomes two lines against the same milestone: the taxed part and the part
 * that is not. Both keep `milestoneId`, which is what the "already invoiced"
 * figure adds up.
 */
export function milestoneInvoiceLines(
  milestone: { id: string; name: string; remaining: number; billable: number; taxable: number },
  opts: { currency: string; taxPercent: number; notTaxedLabel: (name: string) => string },
): InvoiceLineInput[] {
  const remaining = fromMajor(milestone.remaining, opts.currency);
  if (remaining.minor <= 0) return [];
  const line = (description: string, amount: Money, taxable: boolean): InvoiceLineInput => ({
    description,
    milestoneId: milestone.id,
    milestoneName: milestone.name,
    amount: toMajor(amount),
    taxable,
  });

  // With no tax on the invoice the flag changes nothing; keep the one line.
  if (!(opts.taxPercent > 0)) return [line(milestone.name, remaining, true)];

  const billable = fromMajor(milestone.billable, opts.currency);
  const taxable = fromMajor(milestone.taxable, opts.currency);
  const taxedPart = scale(remaining, taxable, billable);
  if (taxedPart.minor >= remaining.minor) return [line(milestone.name, remaining, true)];
  if (taxedPart.minor <= 0) return [line(milestone.name, remaining, false)];
  return [
    line(milestone.name, taxedPart, true),
    line(opts.notTaxedLabel(milestone.name), subtract(remaining, taxedPart), false),
  ];
}
