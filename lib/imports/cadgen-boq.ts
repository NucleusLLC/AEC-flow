/**
 * "Import from MEPflow": the BOQ file the Pool & Jacuzzi generator (and every
 * other CAD-generators / M.E.P.flow tool that writes schema `cadgen.boq/1`)
 * saves, and how it becomes a draft cost estimate or a draft purchase order.
 *
 * PURE — zod in, plain rows out, no database, no React. The page parses the
 * file with it to show the preview; the server action parses the same body
 * again (never trusts the browser's reading) and writes the plan.
 *
 * The file, as written by cad-generators pool/src/boq.js `boqAec()`:
 *   { schema: "cadgen.boq/1", source, purpose: "estimate" | "purchase-order",
 *     generated, project: { number, name, owner, address, drawing },
 *     cover: { rendering?, floorPlan?, equipmentDiagram? },   // data URLs
 *     currency: "", lines: [{ line, code, category, description,
 *     specification, quantity, unit, unitRate: null, amount: null }] }
 *
 * Prices: a take-off carries QUANTITIES. A unit cost is filled only from the
 * practice's own price book, where the line's code equals a price-book code
 * (case and spaces ignored) AND that price is in the estimate's currency. A
 * unitRate inside the file is never used: a generator must not set a price.
 */
import { z } from "zod";
import type { EstimateImportPlan, EstimateItemRow, ImportProject } from "@/lib/api/v1/estimate-import";
import type { PoImportLine, PoImportPlan } from "@/lib/api/v1/po-import";
import { PO_IMPORT_VENDOR } from "@/lib/api/v1/po-import";

export const BOQ_SCHEMA = "cadgen.boq/1";

export const BOQ_LIMITS = {
  /** The whole file as picked (it carries base64 images). */
  maxFileBytes: 15 * 1024 * 1024,
  maxLines: 5000,
  maxString: 300,
  /** The cover rendering after the browser shrinks it (≤ 1600 px JPEG). */
  maxRenderingBytes: 1_500_000,
  /** The floor plan (SVG or PNG data URL). */
  maxPlanBytes: 800_000,
} as const;

export type BoqPurpose = "estimate" | "purchase-order";

const str = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim().slice(0, BOQ_LIMITS.maxString));

const line = z.object({
  code: str,
  category: str,
  description: str,
  specification: str,
  quantity: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : Number(String(v).replace(",", "."))))
    .refine((n) => Number.isFinite(n), "quantity must be a number")
    .refine((n) => n >= 0, "quantity must not be negative"),
  unit: str,
});

const project = z
  .object({ number: str, name: str, owner: str, address: str, drawing: str })
  .partial()
  .optional()
  .transform((p) => ({
    number: p?.number ?? "",
    name: p?.name ?? "",
    owner: p?.owner ?? "",
    address: p?.address ?? "",
    drawing: p?.drawing ?? "",
  }));

/** The file minus its images: what the server action receives and re-checks. */
export const boqCoreSchema = z.object({
  schema: z.literal(BOQ_SCHEMA, { error: `This is not a ${BOQ_SCHEMA} file` }),
  source: str,
  purpose: z
    .string()
    .optional()
    .transform((p): BoqPurpose => (p === "purchase-order" ? "purchase-order" : "estimate")),
  generated: str,
  project,
  currency: str,
  lines: z
    .array(line, { error: "lines must be a list" })
    .min(1, "The file has no lines")
    .max(BOQ_LIMITS.maxLines, `At most ${BOQ_LIMITS.maxLines} lines`),
});

export type BoqCore = z.infer<typeof boqCoreSchema>;
export type BoqLine = BoqCore["lines"][number];

export type BoqImage = { dataUrl: string; caption: string; mime: string };
export type BoqFile = BoqCore & { rendering: BoqImage | null; floorPlan: BoqImage | null };

export type BoqParse = { ok: true; file: BoqFile } | { ok: false; message: string };

function firstIssue(e: z.ZodError): string {
  const issue = e.issues[0];
  const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue?.message ?? "Invalid file"}`;
}

function image(v: unknown): BoqImage | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  const m = /^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,/.exec(dataUrl);
  if (!m) return null;
  return { dataUrl, mime: m[1], caption: typeof o.caption === "string" ? o.caption.slice(0, BOQ_LIMITS.maxString) : "" };
}

/** Read the picked file's text. The message names the first problem. */
export function parseBoqFile(text: string): BoqParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: "The file is not valid JSON." };
  }
  const r = boqCoreSchema.safeParse(raw);
  if (!r.success) return { ok: false, message: firstIssue(r.error) };
  const cover = (raw as { cover?: Record<string, unknown> }).cover ?? {};
  return { ok: true, file: { ...r.data, rendering: image(cover.rendering), floorPlan: image(cover.floorPlan) } };
}

/** Re-check the core the browser sends (no images). */
export function parseBoqCore(body: unknown): { ok: true; core: BoqCore } | { ok: false; message: string } {
  const r = boqCoreSchema.safeParse(body);
  return r.success ? { ok: true, core: r.data } : { ok: false, message: firstIssue(r.error) };
}

/* ── price book ─────────────────────────────────────────────────────────── */

/** One price-book entry as the import needs it (lib/data/price-lists.types.ts PriceItem + currencyOf). */
export type BoqPrice = { code: string; name: string; unit: string; unitPrice: number; currency: string; kind: "material" | "equipment" };

export type PriceMatch =
  | { status: "priced"; kind: "material" | "equipment"; unitPrice: number; name: string }
  | { status: "other-currency"; currency: string; unitPrice: number; name: string }
  | { status: "unpriced" };

export const normCode = (c: string): string => c.replace(/\s+/g, "").toUpperCase();

/** Index the book by code. A code on both lists: the material entry wins (it is listed first). */
export function priceIndex(book: readonly BoqPrice[]): Map<string, BoqPrice[]> {
  const ix = new Map<string, BoqPrice[]>();
  for (const p of book) {
    const k = normCode(p.code);
    if (!k) continue;
    const list = ix.get(k) ?? [];
    list.push(p);
    ix.set(k, list);
  }
  return ix;
}

/** The price for one line: same code AND same currency, or why not. */
export function matchPrice(code: string, ix: Map<string, BoqPrice[]>, currency: string): PriceMatch {
  const hits = ix.get(normCode(code));
  if (!code.trim() || !hits?.length) return { status: "unpriced" };
  const same = hits.find((p) => p.currency.toUpperCase() === currency.toUpperCase());
  if (same) return { status: "priced", kind: same.kind, unitPrice: same.unitPrice, name: same.name };
  const p = hits[0];
  return { status: "other-currency", currency: p.currency, unitPrice: p.unitPrice, name: p.name };
}

/* ── preview ────────────────────────────────────────────────────────────── */

export type PreviewLine = BoqLine & { task: string; match: PriceMatch; amount: number };
export type PreviewSection = { name: string; lines: PreviewLine[]; total: number };
export type BoqPreview = {
  sections: PreviewSection[];
  lineCount: number;
  priced: number;
  otherCurrency: number;
  unpriced: number;
  total: number;
};

/** "<description> — <specification>" (the API import's itemTask rule). */
export function lineTask(l: Pick<BoqLine, "description" | "specification" | "code">): string {
  const base = l.description || l.code || "Item";
  return l.specification ? `${base} — ${l.specification}` : base;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lines grouped into one section per category, in the order categories first appear. */
export function buildPreview(core: Pick<BoqCore, "lines">, book: readonly BoqPrice[], currency: string): BoqPreview {
  const ix = priceIndex(book);
  const by = new Map<string, PreviewLine[]>();
  for (const l of core.lines) {
    const name = l.category || "General";
    const match = matchPrice(l.code, ix, currency);
    const amount = match.status === "priced" ? round2(l.quantity * match.unitPrice) : 0;
    const list = by.get(name) ?? [];
    list.push({ ...l, task: lineTask(l), match, amount });
    by.set(name, list);
  }
  const sections = [...by].map(([name, lines]) => ({ name, lines, total: round2(lines.reduce((s, x) => s + x.amount, 0)) }));
  const all = sections.flatMap((s) => s.lines);
  return {
    sections,
    lineCount: all.length,
    priced: all.filter((l) => l.match.status === "priced").length,
    otherCurrency: all.filter((l) => l.match.status === "other-currency").length,
    unpriced: all.filter((l) => l.match.status === "unpriced").length,
    total: round2(sections.reduce((s, x) => s + x.total, 0)),
  };
}

/* ── plans ──────────────────────────────────────────────────────────────── */

export function importTitle(core: Pick<BoqCore, "project" | "source">): string {
  return core.project.name || core.project.drawing || core.source || "MEPflow import";
}

/** The draft estimate: one section per category, priced lines filled from the book. */
export function planBoqEstimate(
  core: BoqCore,
  preview: BoqPreview,
  project: ImportProject,
  currency: string,
  cover: { image: string | null; plan: string | null },
  now: Date = new Date(),
): EstimateImportPlan {
  const hasCover = Boolean(cover.image || cover.plan);
  return {
    estimate: {
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      client: project.clientName,
      clientId: project.clientId,
      location: project.siteAddress ?? (core.project.address || null),
      currency,
      status: "DRAFT",
      locked: false,
      amount: 0,
      date: now,
      budget: {
        import: {
          source: core.source || "MEPflow",
          sourceVersion: core.generated || null,
          title: importTitle(core),
          importedAt: now.toISOString(),
        },
        ...(hasCover ? { cover: { on: true, image: cover.image, plan: cover.plan } } : {}),
      },
    },
    categories: preview.sections.map((s, si) => ({
      name: s.name,
      sortOrder: si,
      items: s.lines.map(
        (l, li): EstimateItemRow => ({
          task: l.task,
          qty: l.quantity,
          unit: l.unit || "no",
          code: l.code || null,
          laborNorm: 0,
          materialUnitCost: l.match.status === "priced" && l.match.kind === "material" ? l.match.unitPrice : 0,
          equipmentUnitCost: l.match.status === "priced" && l.match.kind === "equipment" ? l.match.unitPrice : 0,
          subcontractUnitCost: 0,
          poc: 0,
          sortOrder: li,
        }),
      ),
    })),
  };
}

/** The draft purchase order: one line per BOQ line, priced from the book, totals summed. */
export function planBoqPurchaseOrder(
  core: BoqCore,
  preview: BoqPreview,
  project: ImportProject | null,
  currency: string,
  createdByName: string | null,
): PoImportPlan {
  const lineItems: PoImportLine[] = preview.sections.flatMap((s) =>
    s.lines.map((l) => ({
      description: `${l.code ? `${l.code} · ` : ""}${s.name} — ${l.task}`,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.match.status === "priced" ? l.match.unitPrice : 0,
    })),
  );
  const subtotal = round2(lineItems.reduce((n, l) => n + l.quantity * l.unitPrice, 0));
  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? importTitle(core),
    vendorName: PO_IMPORT_VENDOR,
    status: "DRAFT",
    currency,
    lineItems,
    subtotal,
    taxPercentage: 0,
    shipping: 0,
    total: subtotal,
    notes: `Imported from ${core.source || "MEPflow"}: ${importTitle(core)}`,
    createdByName: createdByName?.trim() || null,
  };
}

/** Accept only an image data URL of the allowed types and size; anything else is dropped. */
export function cleanDataUrl(v: unknown, allowed: readonly string[], maxBytes: number): string | null {
  if (typeof v !== "string") return null;
  const m = /^data:([a-z+/]+);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m || !allowed.includes(m[1])) return null;
  // base64 length × 3/4 ≈ bytes.
  if (Math.floor((m[2].length * 3) / 4) > maxBytes) return null;
  return v;
}
