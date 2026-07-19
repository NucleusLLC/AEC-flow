/**
 * Purchase-order money math. PURE — no I/O, no Prisma — so it can be unit-tested
 * and reused on both the server (persisted totals) and the client (live preview)
 * without drift.
 */
import type { PurchaseOrderLine } from "./types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Extended amount for one line (quantity × unit price). */
export function lineAmount(line: Pick<PurchaseOrderLine, "quantity" | "unitPrice">): number {
  return round2(n(line.quantity) * n(line.unitPrice));
}

export interface PoTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

/** Subtotal (sum of lines) + tax (% of subtotal) + flat shipping. */
export function poTotals(input: {
  lineItems: PurchaseOrderLine[];
  taxPercentage?: number;
  shipping?: number;
}): PoTotals {
  const subtotal = round2(input.lineItems.reduce((sum, l) => sum + lineAmount(l), 0));
  const tax = round2((subtotal * n(input.taxPercentage)) / 100);
  const shipping = round2(n(input.shipping));
  const total = round2(subtotal + tax + shipping);
  return { subtotal, tax, shipping, total };
}

/** Received quantity for a line, clamped to [0, ordered]. */
export function lineReceived(line: PurchaseOrderLine): number {
  const qty = n(line.quantity);
  const recv = n(line.receivedQty);
  return Math.max(0, Math.min(recv, qty));
}

export interface ReceiptProgress {
  totalLines: number;
  receivedLines: number;
  fullyReceived: boolean;
  anyReceived: boolean;
}

/** Line-level receiving progress. A line counts as received once its received
 *  quantity reaches the ordered quantity. */
export function receiptProgress(lines: PurchaseOrderLine[]): ReceiptProgress {
  const totalLines = lines.length;
  let receivedLines = 0;
  let anyReceived = false;
  for (const l of lines) {
    const recv = lineReceived(l);
    if (recv > 0) anyReceived = true;
    if (n(l.quantity) > 0 && recv >= n(l.quantity)) receivedLines += 1;
  }
  return {
    totalLines,
    receivedLines,
    fullyReceived: totalLines > 0 && receivedLines === totalLines,
    anyReceived,
  };
}
