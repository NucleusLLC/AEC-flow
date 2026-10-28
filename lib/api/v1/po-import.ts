/**
 * POST /api/v1/purchase-orders/import — the same take-off a connected app
 * (M.E.P.flow, W&Dflow) sends to /api/v1/estimates/import, turned into ONE draft
 * purchase order for the Procurement section. PURE: a validated payload in, the
 * row to write out. The route does the auth, the project lookup; the data layer
 * (lib/data/api-v1.ts) picks the PO number and writes the row.
 *
 * The body is EXACTLY the estimates-import body: the zod gate is reused from
 * lib/api/v1/estimate-import.ts (parseImportPayload), never copied.
 *
 * A take-off carries QUANTITIES only. Every unit price lands at 0 and the totals
 * at 0: pricing is the buyer's work against a real supplier quote — an add-in
 * must never invent a price. The supplier is not known either, so the required
 * vendor column gets a placeholder the user replaces when the order is placed.
 *
 * Where the payload goes (no new columns):
 *   - each item           → one line, in payload order (categories, then items);
 *                           description "<category> — <task> <size>", plus
 *                           " (<note>)" when there is a note;
 *   - the project         → projectId + projectName (the project's own name);
 *                           without one, projectName = the take-off's title;
 *   - source, version,
 *     title               → `notes`: "Imported from <source> <version>: <title>".
 */
import type { ImportPayload, ImportProject } from "./estimate-import";

/** The vendor column is required; an imported take-off has no supplier yet. */
export const PO_IMPORT_VENDOR = "To be assigned";

/** One PO line, in the shape the Procurement pages read (lib/procurement/types.ts PurchaseOrderLine). */
export type PoImportLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: 0;
};

export type PoImportPlan = {
  projectId: string | null;
  projectName: string;
  vendorName: string;
  status: "DRAFT";
  currency: string;
  lineItems: PoImportLine[];
  subtotal: 0;
  taxPercentage: 0;
  shipping: 0;
  total: 0;
  notes: string;
  createdByName: string | null;
};

/** "<category> — <task> <size>", then " (<note>)" when there is one. Whitespace collapsed. */
export function poLineDescription(category: string, it: { task: string; size: string; note: string }): string {
  const base = `${category} — ${it.task} ${it.size}`.replace(/\s+/g, " ").trim();
  const note = it.note.replace(/\s+/g, " ").trim();
  return note ? `${base} (${note})` : base;
}

/** "Imported from <source> <sourceVersion>: <title>" — the version left out when absent. */
export function poImportNotes(payload: Pick<ImportPayload, "source" | "sourceVersion" | "title">): string {
  const from = `${payload.source} ${payload.sourceVersion ?? ""}`.replace(/\s+/g, " ").trim();
  return `Imported from ${from}: ${payload.title}`;
}

/**
 * Turn a validated payload into the purchase-order row to write (everything but
 * the PO number, which only the database can decide). `createdByName` is the
 * API token's name, so the list shows which connected app filed the order.
 */
export function planPoImport(
  payload: ImportPayload,
  project: ImportProject | null,
  createdByName: string | null = null,
): PoImportPlan {
  const lineItems: PoImportLine[] = [];
  for (const c of payload.categories) {
    for (const it of c.items) {
      lineItems.push({
        description: poLineDescription(c.name, it),
        quantity: it.qty,
        // The Procurement form's own empty unit; the pages show "—" for it.
        unit: it.unit,
        unitPrice: 0,
      });
    }
  }
  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? payload.title,
    vendorName: PO_IMPORT_VENDOR,
    status: "DRAFT",
    currency: payload.currency,
    lineItems,
    subtotal: 0,
    taxPercentage: 0,
    shipping: 0,
    total: 0,
    notes: poImportNotes(payload),
    createdByName: createdByName?.trim() || null,
  };
}

/** The page that opens one purchase order in the app (Procurement, by PO id). */
export function purchaseOrderUrl(base: string, poId: string): string {
  return `${base.replace(/\/+$/, "")}/procurement/${encodeURIComponent(poId)}`;
}
