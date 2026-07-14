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
import { prisma } from "@/lib/db";
import type {
  CostEstimate,
  EstimateProject,
  EstimateStatus,
  CalculationMethod,
  AssemblyComponent,
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
    const project = await prisma.project.findUnique({ where: { id: pid }, select: { clientId: true } });
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
export async function saveEstimate(input: CostEstimate, amount: number): Promise<{ id: string }> {
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
