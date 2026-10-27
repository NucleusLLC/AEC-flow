/**
 * POST /api/v1/estimates/import — the payload a connected app (M.E.P.flow) sends,
 * and how it becomes a draft cost estimate. PURE: zod in, plain rows out. The
 * route does the auth, the project lookup and the one transaction.
 *
 * A take-off carries QUANTITIES only. Every unit cost lands at 0 and the code at
 * null: pricing is the estimator's work in the app, against the practice's own
 * price book — an add-in must never invent a price.
 *
 * Where the provenance goes (no new columns):
 *   - an item's `note`              → appended to its task text ("Pipe DN100 — note");
 *   - the `title`                   → the estimate's project name when no project is
 *                                     linked (with one, the project's own name wins);
 *   - `source`, `sourceVersion`,
 *     `title`                       → `budget.import`, the structured-extras JSON every
 *                                     estimate already has (lib/data/estimates.types.ts).
 */
import { z } from "zod";

export const IMPORT_LIMITS = {
  /** Request body, in bytes. */
  maxBodyBytes: 1024 * 1024,
  maxCategories: 200,
  maxItems: 5000,
  maxString: 300,
} as const;

const text = (label: string) =>
  z
    .string({ error: `${label} must be text` })
    .max(IMPORT_LIMITS.maxString, `${label} is longer than ${IMPORT_LIMITS.maxString} characters`);

const requiredText = (label: string) =>
  text(label)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, `${label} is required`);

const optionalText = (label: string) =>
  z
    .union([text(label), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : ""));

const item = z.object({
  task: requiredText("items[].task"),
  size: optionalText("items[].size"),
  qty: z
    .number({ error: "items[].qty must be a number" })
    .refine((n) => Number.isFinite(n), "items[].qty must be a finite number")
    .refine((n) => n >= 0, "items[].qty must not be negative"),
  unit: optionalText("items[].unit"),
  note: optionalText("items[].note"),
});

const category = z.object({
  name: requiredText("categories[].name"),
  items: z.array(item, { error: "categories[].items must be a list" }),
});

export const importPayloadSchema = z
  .object({
    source: requiredText("source"),
    sourceVersion: optionalText("sourceVersion"),
    projectId: z
      .union([text("projectId"), z.null()])
      .optional()
      .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null)),
    title: requiredText("title"),
    currency: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "USD"))
      .refine((c) => /^[A-Z]{3}$/.test(c), "currency must be a three-letter code such as USD"),
    categories: z
      .array(category, { error: "categories must be a list" })
      .max(IMPORT_LIMITS.maxCategories, `At most ${IMPORT_LIMITS.maxCategories} categories`),
  })
  .refine(
    (p) => p.categories.reduce((n, c) => n + c.items.length, 0) <= IMPORT_LIMITS.maxItems,
    `At most ${IMPORT_LIMITS.maxItems} items in all`,
  );

export type ImportPayload = z.infer<typeof importPayloadSchema>;

export type ParseResult = { ok: true; payload: ImportPayload } | { ok: false; message: string };

/** Validate a parsed JSON body. The message names the first problem, for the add-in's log. */
export function parseImportPayload(body: unknown): ParseResult {
  const r = importPayloadSchema.safeParse(body);
  if (r.success) return { ok: true, payload: r.data };
  const issue = r.error.issues[0];
  const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
  return { ok: false, message: `${where}${issue?.message ?? "Invalid body"}` };
}

/** The project an import is filed under, as the route found it inside the practice. */
export type ImportProject = {
  id: string;
  projectNumber: string;
  name: string;
  siteAddress: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type EstimateItemRow = {
  task: string;
  qty: number;
  unit: string;
  code: null;
  laborNorm: 0;
  materialUnitCost: 0;
  equipmentUnitCost: 0;
  subcontractUnitCost: 0;
  poc: 0;
  sortOrder: number;
};

export type EstimateImportPlan = {
  estimate: {
    projectId: string | null;
    projectNumber: string | null;
    projectName: string;
    client: string | null;
    clientId: string | null;
    location: string | null;
    currency: string;
    status: "DRAFT";
    locked: false;
    amount: 0;
    date: Date;
    budget: { import: { source: string; sourceVersion: string | null; title: string; importedAt: string } };
  };
  categories: { name: string; sortOrder: number; items: EstimateItemRow[] }[];
};

/** "<task> <size>", then " — <note>" when there is one. */
export function itemTask(it: { task: string; size: string; note: string }): string {
  const base = `${it.task} ${it.size}`.replace(/\s+/g, " ").trim();
  return it.note ? `${base} — ${it.note}` : base;
}

/** Turn a validated payload into the rows to write. `now` is injectable for tests. */
export function planEstimateImport(
  payload: ImportPayload,
  project: ImportProject | null,
  now: Date = new Date(),
): EstimateImportPlan {
  return {
    estimate: {
      projectId: project?.id ?? null,
      projectNumber: project?.projectNumber ?? null,
      projectName: project?.name ?? payload.title,
      client: project?.clientName ?? null,
      clientId: project?.clientId ?? null,
      location: project?.siteAddress ?? null,
      currency: payload.currency,
      status: "DRAFT",
      locked: false,
      amount: 0,
      date: now,
      budget: {
        import: {
          source: payload.source,
          sourceVersion: payload.sourceVersion || null,
          title: payload.title,
          importedAt: now.toISOString(),
        },
      },
    },
    categories: payload.categories.map((c, ci) => ({
      name: c.name,
      sortOrder: ci,
      items: c.items.map((it, ii) => ({
        task: itemTask(it),
        qty: it.qty,
        // The estimate's own default unit ("no") when the add-in sends none.
        unit: it.unit || "no",
        code: null,
        laborNorm: 0,
        materialUnitCost: 0,
        equipmentUnitCost: 0,
        subcontractUnitCost: 0,
        poc: 0,
        sortOrder: ii,
      })),
    })),
  };
}

/** The page that opens one estimate in the app (the Estimates workspace, by estimate id). */
export function estimateUrl(base: string, estimateId: string): string {
  return `${base.replace(/\/+$/, "")}/estimates?project=${encodeURIComponent(estimateId)}`;
}
