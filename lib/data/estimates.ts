/**
 * Cost-Estimation data-access layer (BOQ-style estimate sheets).
 *
 * SERVER-ONLY (imports Prisma → pg). Client components import shapes/units from
 * `./estimates.types` instead (re-exported below so server call sites importing
 * from "@/lib/data/estimates" keep working). See [[aec-prisma-client-boundary]].
 *
 * Costing model lives in `lib/estimates/calc.ts` (single source of truth, drives
 * screen + PDF + the stored `amount`).
 */
import type { Prisma, EstimateStatus as DbEstimateStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { copyLines, type Selection } from "@/lib/estimates/copy-lines";
import { estimateTotals } from "@/lib/estimates/calc";
import type {
  CostEstimate,
  EstimateProject,
  EstimateStatus,
  CalculationMethod,
  AssemblyComponent,
  CopyDestination,
} from "./estimates.types";

export * from "./estimates.types";

/** The estimate opened by default in the workspace (the seeded demo BOQ). */
const DEFAULT_ESTIMATE_ID = "EST-2026-014";

const STATUS_TO_DTO: Record<DbEstimateStatus, EstimateStatus> = {
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
};
export const STATUS_TO_DB: Record<EstimateStatus, DbEstimateStatus> = {
  draft: "DRAFT",
  in_review: "IN_REVIEW",
  approved: "APPROVED",
};

function ymd(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

type EstimateRow = Prisma.CostEstimateGetPayload<{
  include: { categories: { include: { items: true } } };
}>;

function toDto(e: EstimateRow): CostEstimate {
  return {
    id: e.id,
    projectId: e.projectId,
    projectNumber: e.projectNumber,
    projectName: e.projectName,
    version: e.version,
    date: ymd(e.date),
    location: e.location ?? "",
    client: e.client ?? undefined,
    clientId: e.clientId ?? undefined,
    currency: e.currency,
    avgLaborRate: e.avgLaborRate,
    profitPct: e.profitPct,
    bboPct: e.bboPct,
    gfa: e.gfa ?? undefined,
    locked: e.locked,
    status: STATUS_TO_DTO[e.status],
    budget: (e.budget as CostEstimate["budget"]) ?? undefined,
    categories: e.categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code ?? undefined,
      items: c.items.map((i) => ({
        id: i.id,
        task: i.task,
        qty: i.qty,
        unit: i.unit,
        laborNorm: i.laborNorm,
        materialUnitCost: i.materialUnitCost,
        equipmentUnitCost: i.equipmentUnitCost,
        subcontractUnitCost: i.subcontractUnitCost,
        poc: i.poc,
        code: i.code ?? undefined,
        calculationMethod: (i.calculationMethod ?? undefined) as CalculationMethod | undefined,
        laborRatePerUnit: i.laborRatePerUnit ?? undefined,
        assembly: (i.assembly as AssemblyComponent[] | null) ?? undefined,
      })),
    })),
  };
}

const WITH_LINES = {
  categories: {
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  },
} as const;

const EMPTY_ESTIMATE: CostEstimate = {
  id: "",
  projectId: null,
  projectName: "Untitled estimate",
  version: "V1.0",
  date: "",
  location: "",
  currency: "USD",
  avgLaborRate: 45,
  profitPct: 24,
  bboPct: 7,
  status: "draft",
  categories: [],
};

async function loadEstimate(id: string): Promise<CostEstimate | null> {
  const row = await prisma.costEstimate.findUnique({ where: { id }, include: WITH_LINES });
  return row ? toDto(row) : null;
}

/** The workspace's initial estimate — the default demo BOQ, else the newest. */
export async function getEstimate(): Promise<CostEstimate> {
  const byDefault = await loadEstimate(DEFAULT_ESTIMATE_ID);
  if (byDefault) return byDefault;
  const first = await prisma.costEstimate.findFirst({
    orderBy: { updatedAt: "desc" },
    include: WITH_LINES,
  });
  return first ? toDto(first) : EMPTY_ESTIMATE;
}

/** Full estimate (categories + items) by id, for the workspace / PDF export. */
export async function getEstimateById(id: string): Promise<CostEstimate | null> {
  return loadEstimate(id);
}

/** Header rows for the estimate list (no line items loaded). */
export async function getEstimateProjects(): Promise<EstimateProject[]> {
  const rows = await prisma.costEstimate.findMany({ orderBy: { date: "desc" } });
  return rows.map((e) => ({
    id: e.id,
    projectNumber: e.projectNumber ?? "",
    projectName: e.projectName,
    address: e.location ?? "",
    client: e.client ?? "",
    version: e.version,
    date: ymd(e.date),
    currency: e.currency,
    status: STATUS_TO_DTO[e.status],
    amount: e.amount,
  }));
}

/**
 * Work out which Client an estimate belongs to.
 *
 * The sheet has always stored the client as a free-text NAME, with no foreign key, so
 * an estimate could never be found from the client side — the client page showed
 * nothing. `clientId` is the real link; this resolves it, most-trustworthy source first:
 *
 *   1. an explicit id already on the sheet (set by the client picker);
 *   2. the estimate's project — a project has a required clientId, and an estimate
 *      started from a project is keyed by that project's own id, so both `projectId`
 *      and the estimate's `id` are worth probing;
 *   3. an exact (case-insensitive) match on the typed name.
 *
 * Returns null when nothing matches — an estimate may legitimately be drafted before
 * its client exists as a record. Because this runs on every save, an unlinked estimate
 * heals itself the moment the name matches a real client.
 */
async function resolveClientId(input: CostEstimate): Promise<string | null> {
  if (input.clientId) return input.clientId;

  for (const pid of [input.projectId, input.id]) {
    if (!pid) continue;
    // findFirst, NOT findUnique. Behaviour-preserving fix: the tenant extension's
    // findUnique guard reads `companyId` off the returned row, which a `select` of
    // just `clientId` leaves undefined — so for a signed-in user this always read
    // null and the estimate→client link never healed. findFirst puts the company
    // scope in the WHERE; `id` is unique, so it is the same single row.
    const project = await prisma.project.findFirst({ where: { id: pid }, select: { clientId: true } });
    if (project?.clientId) return project.clientId;
  }

  const name = input.client?.trim();
  if (name) {
    const match = await prisma.client.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (match) return match.id;
  }

  return null;
}

/**
 * Persist a full estimate (header + categories + items). Categories/items are
 * replaced wholesale (cascade delete + recreate) — the editor sends the whole
 * sheet. `amount` is the computed grand total (from lib/estimates/calc.ts),
 * stored so the list can show it without loading every line.
 */
/**
 * A locked estimate is FROZEN — a superseded version must not drift.
 *
 * Enforced here, server-side, rather than by disabling inputs: the sheet autosaves every
 * 2.5s, so a tab left open from before the lock (or any stale client) would happily keep
 * writing. This is the only gate every write path passes through.
 */
async function assertUnlocked(id: string | undefined): Promise<void> {
  if (!id) return;
  // findFirst, NOT findUnique. Behaviour-preserving fix, and the highest-stakes one
  // in this file: the tenant extension's findUnique guard reads `companyId` off the
  // returned row, which a `select` of just `locked` leaves undefined — so for a
  // signed-in user this read came back null, `row?.locked` was falsy, and the lock
  // gate below never fired. findFirst puts the company scope in the WHERE; `id` is
  // unique, so it is the same single row.
  const row = await prisma.costEstimate.findFirst({ where: { id }, select: { locked: true } });
  if (row?.locked) throw new Error("This version is locked. Unlock it before making changes.");
}

/** Lock / unlock a version. The ONLY writer of `locked` — saveEstimate never touches it. */
export async function setEstimateLock(id: string, locked: boolean): Promise<void> {
  await prisma.costEstimate.update({ where: { id }, data: { locked } });
}

/**
 * Copy an estimate into a NEW version — a new row, new id, its own lines. The original is
 * untouched (typically locked first), so the old number stays quotable while the new one
 * is edited.
 *
 * Deliberately NOT a shallow header copy: categories and items are deep-copied with fresh
 * ids, and `budget` (schedule / payment / take-off / fx) is carried over, so the new
 * version opens as a true working duplicate rather than an empty shell. It starts DRAFT
 * and unlocked whatever the source was.
 */
export async function duplicateEstimate(id: string, version: string): Promise<{ id: string }> {
  const src = await prisma.costEstimate.findUnique({ where: { id }, include: WITH_LINES });
  if (!src) throw new Error("Estimate not found.");

  return prisma.$transaction(
    async (tx) => {
      const copy = await tx.costEstimate.create({
        data: {
          projectId: src.projectId,
          projectNumber: src.projectNumber,
          projectName: src.projectName,
          client: src.client,
          clientId: src.clientId,
          location: src.location,
          version,
          date: src.date,
          currency: src.currency,
          avgLaborRate: src.avgLaborRate,
          profitPct: src.profitPct,
          bboPct: src.bboPct,
          gfa: src.gfa,
          status: "DRAFT",
          locked: false,
          amount: src.amount,
          budget: (src.budget as Prisma.InputJsonValue) ?? undefined,
        },
      });

      for (const [ci, c] of src.categories.entries()) {
        await tx.estimateCategory.create({
          data: {
            estimateId: copy.id,
            name: c.name,
            code: c.code,
            sortOrder: ci,
            items: {
              create: c.items.map((it, ii) => ({
                task: it.task,
                qty: it.qty,
                unit: it.unit,
                laborNorm: it.laborNorm,
                materialUnitCost: it.materialUnitCost,
                equipmentUnitCost: it.equipmentUnitCost,
                subcontractUnitCost: it.subcontractUnitCost,
                poc: it.poc,
                code: it.code,
                calculationMethod: it.calculationMethod,
                laborRatePerUnit: it.laborRatePerUnit,
                assembly: (it.assembly as Prisma.InputJsonValue) ?? undefined,
                sortOrder: ii,
              })),
            },
          },
        });
      }

      return { id: copy.id };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}

/**
 * Copy chosen coded tasks from one estimate into ANOTHER PROJECT's estimate.
 *
 * The selection arrives as ids, not as rows: the source estimate is read here,
 * and `copyLines` decides which fields travel (lib/estimates/copy-lines.ts). A
 * client that sent the rows themselves could send any price it liked into
 * someone else's sheet, and the sheet it landed in would look hand-typed.
 *
 * APPENDS. The destination keeps everything it already has and the copied
 * sections arrive after it, which is what `SectionCopy`'s paste has always done
 * and what "copy to another project" means to the person pressing the button.
 * Replacing a sheet is `Load template…`, a different control with its own
 * confirmation.
 *
 * WHAT IT REFUSES. A locked destination, through the same `assertUnlocked` gate
 * every other write passes; a destination that is the source; and an empty
 * selection. Each throws with a sentence, because the caller shows it.
 *
 * WHAT IT PROTECTS.
 *   - `budget` on the destination is never written. That column holds the
 *     schedule, the payment terms, the take-off rows and the FX in ONE json
 *     blob, and any writer that passes a partial object deletes the keys it
 *     omitted. This function has no business in it.
 *   - `amount` IS rewritten, from the destination's own lines after the append,
 *     because it is a denormalised cache the estimates list reads. Left alone it
 *     shows the pre-copy figure.
 *   - `locked` is never touched, here or anywhere but `setEstimateLock`.
 */
/**
 * The projects a selection of tasks could be copied INTO, with what the picker
 * needs to describe each one honestly.
 *
 * Every project in the practice is offered, not only those that already have an
 * estimate: a project with none is the "new project" half of the request, and
 * the copy creates its sheet. The source project is excluded — copying a task
 * onto itself is the one destination that is never meant.
 *
 * An estimate's id IS its project's id (see the note on copyTasksToProject), so
 * the two lists are joined on that rather than on `projectId`, which holds a
 * cuid on some rows and a project NUMBER on others.
 */
export async function listCopyDestinations(
  excludeProjectId: string,
): Promise<CopyDestination[]> {
  const [projects, estimates] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true, projectNumber: true, currency: true },
      orderBy: { projectNumber: "asc" },
    }),
    prisma.costEstimate.findMany({ select: { id: true, date: true, locked: true, currency: true } }),
  ]);
  const byId = new Map(estimates.map((e) => [e.id, e]));

  return projects
    .filter((p) => p.id !== excludeProjectId)
    .map((p) => {
      const est = byId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        projectNumber: p.projectNumber,
        // The estimate's own currency wins when it has one: that is the currency
        // the prices in it are actually denominated in.
        currency: est?.currency ?? p.currency,
        estimateDate: est?.date ? est.date.toISOString().slice(0, 10) : null,
        hasEstimate: Boolean(est),
        locked: est?.locked ?? false,
      };
    });
}

export async function copyTasksToProject(input: {
  sourceEstimateId: string;
  /** The destination PROJECT's id. An estimate's own id IS its project's id. */
  targetProjectId: string;
  selection: Selection;
  options: { includeQuantities?: boolean; includePrices?: boolean };
}): Promise<{
  estimateId: string;
  created: boolean;
  taskCount: number;
  sectionCount: number;
  pricesWithheld: boolean;
}> {
  if (input.sourceEstimateId === input.targetProjectId) {
    throw new Error("That is the project this estimate belongs to. Choose a different one.");
  }

  const source = await getEstimateById(input.sourceEstimateId);
  if (!source) throw new Error("The estimate being copied from could not be read.");

  // findFirst, not findUnique: see the note on assertUnlocked. A narrow select
  // through the tenant extension's findUnique guard returns null for a row that
  // exists, and this one decides whether to CREATE a second estimate.
  const existing = await prisma.costEstimate.findFirst({
    where: { id: input.targetProjectId },
    select: { id: true, currency: true, locked: true },
  });
  if (existing?.locked) {
    throw new Error("The destination estimate is locked. Unlock it before copying into it.");
  }

  // The destination project, for the header of an estimate that does not exist
  // yet. Read through Prisma's own scope — Project is a tenant model — so a
  // project in another practice cannot be a destination.
  const project = await prisma.project.findFirst({
    where: { id: input.targetProjectId },
    select: { id: true, name: true, projectNumber: true, currency: true, clientId: true, siteAddress: true },
  });
  if (!project) throw new Error("That project could not be found.");

  const targetCurrency = existing?.currency ?? project.currency ?? source.currency;
  const copied = copyLines(
    source.categories,
    input.selection,
    {
      includeQuantities: input.options.includeQuantities,
      includePrices: input.options.includePrices,
      sourceCurrency: source.currency,
      targetCurrency,
    },
    (kind) => (kind === "section" ? `sec-${randomUUID()}` : `item-${randomUUID()}`),
  );
  if (copied.taskCount === 0) throw new Error("Nothing was selected to copy.");

  const estimateId = await prisma.$transaction(
    async (tx) => {
      let id = existing?.id;
      if (!id) {
        /**
         * A project with no estimate yet. WHO it is for comes from the PROJECT —
         * its own client, number, name and address — and never from the source,
         * or copying tasks would quietly re-address another client's sheet.
         *
         * The three RATES do come from the source, and must: they are the
         * practice's own commercial settings, not the client's. Every column in
         * this table defaults to 0 (see the schema), so a sheet created without
         * them holds a labour rate of zero — and a labour norm is hours, priced
         * by the destination's rate. Measured: without this the two copied tasks
         * arrived with 0.8 and 2.5 hours per unit and a labour cost of nothing,
         * which is a sheet that looks finished and is empty.
         *
         * `gfa` is deliberately NOT carried. Built-up area describes a building.
         */
        const created = await tx.costEstimate.create({
          data: {
            id: project.id,
            projectId: project.id,
            projectNumber: project.projectNumber,
            projectName: project.name,
            clientId: project.clientId,
            location: project.siteAddress ?? null,
            currency: targetCurrency,
            avgLaborRate: source.avgLaborRate,
            profitPct: source.profitPct,
            bboPct: source.bboPct,
            status: "DRAFT",
            locked: false,
            amount: 0,
          },
          select: { id: true },
        });
        id = created.id;
      }

      const existingSections = await tx.estimateCategory.count({ where: { estimateId: id } });
      for (const [ci, category] of copied.categories.entries()) {
        await tx.estimateCategory.create({
          data: {
            estimateId: id,
            name: category.name,
            code: category.code ?? null,
            // After what is already there: this appends, and sortOrder is what
            // "after" means on a sheet read top to bottom.
            sortOrder: existingSections + ci,
            items: {
              create: category.items.map((it, ii) => ({
                task: it.task,
                qty: it.qty,
                unit: it.unit,
                laborNorm: it.laborNorm,
                materialUnitCost: it.materialUnitCost,
                equipmentUnitCost: it.equipmentUnitCost,
                subcontractUnitCost: it.subcontractUnitCost,
                poc: it.poc,
                code: it.code ?? null,
                calculationMethod: it.calculationMethod ?? null,
                laborRatePerUnit: it.laborRatePerUnit ?? null,
                assembly: it.assembly ? (it.assembly as unknown as Prisma.InputJsonValue) : undefined,
                sortOrder: ii,
              })),
            },
          },
        });
      }
      return id;
    },
    { timeout: 30000, maxWait: 10000 },
  );

  // The list reads `amount`, so it is recomputed from what the destination now
  // holds — after the transaction, from the saved rows, rather than from an
  // arithmetic guess about what was added.
  const saved = await getEstimateById(estimateId);
  if (saved) {
    await prisma.costEstimate.update({
      where: { id: estimateId },
      data: { amount: estimateTotals(saved).grandTotal },
    });
  }

  return {
    estimateId,
    created: !existing,
    taskCount: copied.taskCount,
    sectionCount: copied.categories.length,
    pricesWithheld: copied.pricesWithheld,
  };
}

export async function saveEstimate(input: CostEstimate, amount: number): Promise<{ id: string }> {
  await assertUnlocked(input.id);
  const clientId = await resolveClientId(input);
  const header = {
    projectId: input.projectId ?? null,
    projectNumber: input.projectNumber ?? null,
    projectName: input.projectName,
    client: input.client ?? null,
    clientId,
    location: input.location || null,
    version: input.version,
    date: input.date ? new Date(input.date) : null,
    currency: input.currency,
    avgLaborRate: input.avgLaborRate,
    profitPct: input.profitPct,
    bboPct: input.bboPct,
    gfa: input.gfa ?? null,
    status: STATUS_TO_DB[input.status ?? "draft"],
    amount,
    budget: input.budget ? (input.budget as unknown as Prisma.InputJsonValue) : undefined,
  };

  // ATOMIC: upsert the header, then replace categories/items, all in ONE
  // transaction. Previously this was a bare deleteMany + recreate loop — if it
  // failed midway the estimate was left with NO lines (silent data loss). Now a
  // failure rolls the whole thing back and the previously-saved sheet survives.
  return prisma.$transaction(
    async (tx) => {
      const saved = await tx.costEstimate.upsert({
        where: { id: input.id || "__new__" },
        update: header,
        create: { ...(input.id ? { id: input.id } : {}), ...header },
      });

      await tx.estimateCategory.deleteMany({ where: { estimateId: saved.id } });
      for (let ci = 0; ci < input.categories.length; ci++) {
        const c = input.categories[ci];
        await tx.estimateCategory.create({
          data: {
            estimateId: saved.id,
            name: c.name,
            code: c.code ?? null,
            sortOrder: ci,
            items: {
              create: c.items.map((it, ii) => ({
                task: it.task,
                qty: it.qty,
                unit: it.unit,
                laborNorm: it.laborNorm,
                materialUnitCost: it.materialUnitCost,
                equipmentUnitCost: it.equipmentUnitCost,
                subcontractUnitCost: it.subcontractUnitCost,
                poc: it.poc,
                code: it.code ?? null,
                calculationMethod: it.calculationMethod ?? null,
                laborRatePerUnit: it.laborRatePerUnit ?? null,
                // Json column: store the component array, or skip (→ NULL) when absent.
                assembly: it.assembly ? (it.assembly as unknown as Prisma.InputJsonValue) : undefined,
                sortOrder: ii,
              })),
            },
          },
        });
      }

      return { id: saved.id };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
