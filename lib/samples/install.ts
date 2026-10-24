/**
 * Installing, removing and reporting on a company's SAMPLE SET.
 *
 * What is recorded, and where. No schema change: the ids of every row a run
 * created are written, per company, into that company's AppConfig JSON as
 *
 *   sampleSet: { version, lang, createdAt, token, ids: { <model>: [id, ...] } }
 *
 * and removal deletes exactly those ids. AppConfig is one row per company,
 * keyed by the companyId, and is not a tenant model.
 *
 * The four promises this file keeps:
 *   - IDEMPOTENT. A second install is a no-op: the record says a set is there.
 *     A per-company advisory lock makes two simultaneous clicks one install.
 *   - ALL OR NOTHING. One transaction per company. A failure half-way leaves
 *     no partial set and no record.
 *   - BESIDE, NEVER INSTEAD. It only inserts. It reads nothing of the
 *     company's own data except its owner, its name and its currency, and it
 *     updates nothing but the sampleSet key.
 *   - NEVER SILENT, NEVER THROWN. Every entry point returns a result. A
 *     failure names the module that failed and is written as one
 *     `[aecflow-error]` line (docs/ERRORS.md), which is what the old signup
 *     seed did not do: it lost every project for every signup and said nothing.
 *
 * TENANCY. Everything here goes through `unscopedPrisma()` and names the
 * company on every query. See unscoped-db.ts for why the scoped client can
 * not do this job.
 *
 * SERVER-ONLY.
 */
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { unscopedPrisma } from "./unscoped-db";
import {
  SAMPLE_CHILD_MODELS,
  SAMPLE_MODEL_ORDER,
  SAMPLE_SET_VERSION,
  buildSampleSet,
  isSampleLang,
  moduleCounts,
  planIds,
  sampleNumber,
  sampleToken,
  totalRows,
  type SampleCounts,
  type SampleLang,
  type SampleModel,
  type SamplePlan,
} from "./build";
import { ERROR_LOG_TAG, redactText } from "@/lib/observability/error-record";
import { APP_VERSION, appBuildId } from "@/lib/version";

export type SampleSetRecord = {
  version: number;
  lang: SampleLang;
  createdAt: string;
  token: string;
  ids: Partial<Record<SampleModel, string[]>>;
};

export type SampleSetStatus =
  | { installed: false }
  | { installed: true; version: number; lang: SampleLang; createdAt: string; counts: SampleCounts; total: number };

export type InstallResult =
  | { ok: true; status: "installed"; counts: SampleCounts; total: number; lang: SampleLang }
  | { ok: true; status: "already"; counts: SampleCounts; total: number; lang: SampleLang }
  | { ok: false; error: string; module?: string };

export type PlanResult =
  | { ok: true; status: "would-install"; counts: SampleCounts; total: number; lang: SampleLang }
  | { ok: true; status: "already"; counts: SampleCounts; total: number; lang: SampleLang }
  | { ok: false; error: string };

export type KeptRecord = { model: SampleModel; id: string; reason: string };

export type RemoveResult =
  | { ok: true; status: "removed"; removed: number; kept: KeptRecord[] }
  | { ok: true; status: "none" }
  | { ok: false; error: string; module?: string };

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

/** A step that failed, with the model it failed on: what the log line and the UI name. */
class SampleStepError extends Error {
  override name = "SampleStepError";
  constructor(
    readonly model: string,
    readonly detail: unknown,
  ) {
    super(`${model}: ${detail instanceof Error ? detail.message : String(detail)}`);
  }
}

/** Prisma's messages run to many lines of source context; the last one is the sentence. */
function shortMessage(error: unknown): string {
  const detail = error instanceof SampleStepError ? error.detail : error;
  const text = detail instanceof Error ? detail.message : String(detail);
  return text.trim().split("\n").filter(Boolean).pop()?.trim().slice(0, 300) || "Unknown error";
}

/** One `[aecflow-error]` line per failure, in the shape docs/ERRORS.md describes. */
function logSampleError(op: string, companyId: string, error: unknown): void {
  try {
    const model = error instanceof SampleStepError ? error.model : undefined;
    const detail = shortMessage(error);
    const record = {
      kind: "server",
      at: new Date().toISOString(),
      name: "SampleSet",
      message: redactText(`${op} failed for company ${companyId}${model ? ` at ${model}` : ""}: ${detail}`).slice(0, 500),
      op,
      companyId,
      module: model,
      version: APP_VERSION,
      build: appBuildId() || "dev",
    };
    console.error(`${ERROR_LOG_TAG} ${JSON.stringify(record)}`);
  } catch {
    // Never let error reporting become the error.
  }
}

function failure(op: string, companyId: string, error: unknown): { ok: false; error: string; module?: string } {
  logSampleError(op, companyId, error);
  const model = error instanceof SampleStepError ? error.model : undefined;
  const short = shortMessage(error);
  return { ok: false, error: model ? `${model}: ${short}` : short, module: model };
}

const newId = () => `c${randomBytes(12).toString("hex")}`;

function parseRecord(data: unknown): SampleSetRecord | null {
  const raw = (data as { sampleSet?: unknown } | null | undefined)?.sampleSet;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.ids || typeof r.ids !== "object") return null;
  const ids: Partial<Record<SampleModel, string[]>> = {};
  for (const model of SAMPLE_MODEL_ORDER) {
    const list = (r.ids as Record<string, unknown>)[model];
    if (Array.isArray(list)) ids[model] = list.filter((x): x is string => typeof x === "string");
  }
  return {
    version: typeof r.version === "number" ? r.version : 0,
    lang: isSampleLang(r.lang) ? r.lang : "en",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    token: typeof r.token === "string" ? r.token : "",
    ids,
  };
}

function statusOf(record: SampleSetRecord | null): SampleSetStatus {
  if (!record) return { installed: false };
  return {
    installed: true,
    version: record.version,
    lang: record.lang,
    createdAt: record.createdAt,
    counts: moduleCounts(record.ids),
    total: SAMPLE_MODEL_ORDER.reduce((n, m) => n + (record.ids[m]?.length ?? 0), 0),
  };
}

async function readRecord(db: Db, companyId: string): Promise<SampleSetRecord | null> {
  const row = await db.appConfig.findUnique({ where: { id: companyId } });
  return parseRecord(row?.data);
}

/** Whether this company has a sample set, and what is in it. */
export async function getSampleSetStatus(companyId: string): Promise<SampleSetStatus> {
  try {
    return statusOf(await readRecord(unscopedPrisma(), companyId));
  } catch (e) {
    logSampleError("status", companyId, e);
    return { installed: false };
  }
}

/** The same, for many companies in one query: the founder panel. */
export async function getSampleSetStatuses(companyIds: string[]): Promise<Map<string, SampleSetStatus>> {
  const out = new Map<string, SampleSetStatus>();
  if (companyIds.length === 0) return out;
  const rows = await unscopedPrisma().appConfig.findMany({ where: { id: { in: companyIds } } });
  const byId = new Map(rows.map((r) => [r.id, r.data]));
  for (const id of companyIds) out.set(id, statusOf(parseRecord(byId.get(id))));
  return out;
}

type Context = {
  companyName: string;
  owner: { id: string; name: string };
  currency: string;
};

/** The three things the sample needs from the company: its name, its owner and its currency. */
async function loadContext(db: Db, companyId: string): Promise<Context> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) throw new Error("This company does not exist.");

  // The owner: the first director or admin, else the first member. The sample's
  // tasks, meeting and time are assigned to this person.
  const users = await db.user.findMany({
    where: { companyId, status: { not: "INACTIVE" } },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const owner = users.find((u) => u.role === "DIRECTOR" || u.role === "ADMIN") ?? users[0];
  if (!owner) throw new Error("This company has no active user to assign the sample records to.");

  // The company's currency, resolved the way docs/CURRENCY.md describes.
  const cfg = await db.appConfig.findUnique({ where: { id: companyId } });
  const saved = (cfg?.data as { currency?: unknown } | null | undefined)?.currency;
  const env = process.env.SYSTEM_CURRENCY?.trim().toUpperCase();
  const pick = [saved, env, "AWG"].find((c): c is string => typeof c === "string" && /^[A-Z]{3}$/.test(c));

  return { companyName: company.name, owner: { id: owner.id, name: owner.name }, currency: pick ?? "AWG" };
}

/**
 * The company's number token. Its own last six characters unless a number on
 * that series is already taken (another company with the same tail, or a
 * sample record that was kept at an earlier removal), in which case a random
 * one. Checked against the globally unique project number and the three
 * per-company series a kept record is most likely to sit on.
 */
async function freeToken(db: Db, companyId: string): Promise<string> {
  let token = sampleToken(companyId);
  for (let attempt = 0; attempt < 6; attempt++) {
    const [project, invoice, proposal, order, punch] = await Promise.all([
      // Deliberately across companies: the project number is unique in the whole table.
      db.project.findFirst({ where: { projectNumber: sampleNumber(token, "PRJ") }, select: { id: true } }),
      db.invoice.findFirst({ where: { companyId, number: sampleNumber(token, "INV") }, select: { id: true } }),
      db.serviceProposal.findFirst({ where: { companyId, number: sampleNumber(token, "SP") }, select: { id: true } }),
      db.purchaseOrder.findFirst({ where: { companyId, poNumber: sampleNumber(token, "PO") }, select: { id: true } }),
      db.punchListItem.findFirst({ where: { itemNumber: { startsWith: `SMP-${token}-` } }, select: { id: true } }),
    ]);
    if (!project && !invoice && !proposal && !order && !punch) return token;
    token = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  }
  return token;
}

async function buildFor(db: Db, companyId: string, lang: SampleLang): Promise<{ plan: SamplePlan; token: string }> {
  const ctx = await loadContext(db, companyId);
  const token = await freeToken(db, companyId);
  const plan = buildSampleSet({
    companyId,
    companyName: ctx.companyName,
    token,
    lang,
    currency: ctx.currency,
    owner: ctx.owner,
    today: new Date(),
    newId,
  });
  return { plan, token };
}

type Delegate = {
  createMany(args: { data: unknown[] }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
};
const delegate = (tx: Tx, model: SampleModel): Delegate => (tx as unknown as Record<string, Delegate>)[model];

/** Serialises install and remove for one company inside the current transaction. */
async function lockCompany(tx: Tx, companyId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`aecflow-sample-set:${companyId}`}))`;
}

async function writeRecord(tx: Tx, companyId: string, record: SampleSetRecord | null): Promise<void> {
  const row = await tx.appConfig.findUnique({ where: { id: companyId } });
  const data = { ...((row?.data as Record<string, unknown> | null) ?? {}) };
  if (record) data.sampleSet = record;
  else delete data.sampleSet;
  await tx.appConfig.upsert({
    where: { id: companyId },
    create: { id: companyId, companyId, data: data as Prisma.InputJsonValue },
    update: { data: data as Prisma.InputJsonValue },
  });
}

const TX_OPTIONS = { maxWait: 15_000, timeout: 60_000 };

/**
 * DRY RUN. Builds the plan a real install would insert and reports its counts.
 * Reads only; writes nothing.
 */
export async function planSampleSet(companyId: string, lang: SampleLang): Promise<PlanResult> {
  try {
    const db = unscopedPrisma();
    const existing = await readRecord(db, companyId);
    if (existing) {
      const st = statusOf(existing);
      if (st.installed) return { ok: true, status: "already", counts: st.counts, total: st.total, lang: st.lang };
    }
    const { plan } = await buildFor(db, companyId, lang);
    return { ok: true, status: "would-install", counts: moduleCounts(planIds(plan)), total: totalRows(plan), lang };
  } catch (e) {
    return failure("dry-run", companyId, e);
  }
}

/**
 * Install the sample set for one company. Safe to run twice, safe beside real
 * data, all or nothing, and it never throws: read the result.
 */
export async function installSampleSet(companyId: string, lang: SampleLang): Promise<InstallResult> {
  try {
    if (!companyId) throw new Error("No company.");
    if (!isSampleLang(lang)) throw new Error("The sample set comes in English or Spanish.");
    const db = unscopedPrisma();

    return await db.$transaction(async (tx): Promise<InstallResult> => {
      await lockCompany(tx, companyId);
      const existing = await readRecord(tx, companyId);
      if (existing) {
        const st = statusOf(existing);
        if (st.installed) return { ok: true, status: "already", counts: st.counts, total: st.total, lang: st.lang };
      }

      const { plan, token } = await buildFor(tx, companyId, lang);
      for (const model of SAMPLE_MODEL_ORDER) {
        const rows = plan[model] as unknown[];
        if (rows.length === 0) continue;
        try {
          const made = await delegate(tx, model).createMany({ data: rows });
          if (made.count !== rows.length) throw new Error(`created ${made.count} of ${rows.length} rows`);
        } catch (e) {
          // Rethrown so the transaction rolls back: no partial set, no record.
          throw new SampleStepError(model, e);
        }
      }

      const ids = planIds(plan);
      try {
        await writeRecord(tx, companyId, {
          version: SAMPLE_SET_VERSION,
          lang,
          createdAt: new Date().toISOString(),
          token,
          ids,
        });
      } catch (e) {
        throw new SampleStepError("appConfig", e);
      }
      return { ok: true, status: "installed", counts: moduleCounts(ids), total: totalRows(plan), lang };
    }, TX_OPTIONS);
  } catch (e) {
    return failure("install", companyId, e);
  }
}

/** Tenant models that point at a project by a plain `projectId` column. */
const PROJECT_LINKED: string[] = [
  "task", "purchaseOrder", "materialSelection", "designDeliverable", "serviceProposal",
  "buildingPermit", "generalDocument", "invoice", "creditNote", "timeEntry", "expense",
  "caReport", "changeOrder", "rfiLog", "siteInstruction", "submittalLog", "delayNotice",
  "progressCertification", "punchListItem", "constructionContract", "drawing", "meetingMinute",
  "costEstimate", "projectSchedule",
];
/** Tenant models that point at a client by a plain `clientId` column. */
const CLIENT_LINKED: string[] = [
  "project", "proposal", "order", "costEstimate", "serviceProposal", "buildingPermit",
  "generalDocument", "invoice", "creditNote",
];

type Counter = { count(args: { where: Record<string, unknown> }): Promise<number> };
const counter = (tx: Tx, model: string): Counter => (tx as unknown as Record<string, Counter>)[model];

/**
 * How many of the company's OWN records (rows the sample did not create) point
 * at this sample record through `field`.
 */
async function ownLinks(
  tx: Tx,
  companyId: string,
  models: string[],
  field: string,
  value: string,
  tracked: Set<string>,
): Promise<number> {
  let n = 0;
  for (const model of models) {
    n += await counter(tx, model).count({
      where: { companyId, [field]: value, id: { notIn: [...tracked] } },
    });
  }
  return n;
}

/**
 * Remove the sample set: delete exactly the rows the install recorded.
 *
 * A sample record the practice has EDITED is still deleted, with its edits:
 * the record is the sample's, whatever is typed into it. That is said on the
 * Settings card.
 *
 * A sample record that the practice's OWN records are linked to is KEPT, and
 * reported: a real project filed under the sample client, a real invoice or
 * drawing on the sample project, a credit note against the sample invoice.
 * Deleting it would either fail on a foreign key or leave the practice's own
 * record pointing at nothing, so it stays and becomes theirs.
 */
export async function removeSampleSet(companyId: string): Promise<RemoveResult> {
  try {
    if (!companyId) throw new Error("No company.");
    const db = unscopedPrisma();

    return await db.$transaction(async (tx): Promise<RemoveResult> => {
      await lockCompany(tx, companyId);
      const record = await readRecord(tx, companyId);
      if (!record) return { ok: true, status: "none" };

      const ids = record.ids;
      const tracked = new Set<string>(SAMPLE_MODEL_ORDER.flatMap((m) => ids[m] ?? []));
      const keep = new Map<SampleModel, Set<string>>();
      const kept: KeptRecord[] = [];
      const keepRow = (model: SampleModel, id: string, reason: string) => {
        if (!keep.has(model)) keep.set(model, new Set());
        if (keep.get(model)!.has(id)) return;
        keep.get(model)!.add(id);
        kept.push({ model, id, reason });
      };

      try {
        // The sample invoice: a credit note, or time and expenses billed on it.
        for (const id of ids.invoice ?? []) {
          const n =
            (await tx.creditNote.count({ where: { companyId, invoiceId: id } })) +
            (await tx.timeEntry.count({ where: { companyId, invoiceId: id, id: { notIn: [...tracked] } } })) +
            (await tx.expense.count({ where: { companyId, invoiceId: id, id: { notIn: [...tracked] } } }));
          if (n > 0) keepRow("invoice", id, `${n} of your own finance records are linked to it`);
        }
        // The sample purchase order: material selections of your own placed on it.
        for (const id of ids.purchaseOrder ?? []) {
          const n = await tx.materialSelection.count({ where: { companyId, purchaseOrderId: id, id: { notIn: [...tracked] } } });
          if (n > 0) keepRow("purchaseOrder", id, `${n} of your own material selections are on it`);
        }
        // The sample proposal: an invoice of your own raised from it, or a file attached to it.
        for (const id of ids.serviceProposal ?? []) {
          const n =
            (await tx.invoice.count({ where: { companyId, serviceProposalId: id, id: { notIn: [...tracked] } } })) +
            (await tx.attachment.count({ where: { serviceProposalId: id } })) +
            (keep.get("invoice")?.size ?? 0);
          if (n > 0) keepRow("serviceProposal", id, `${n} of your own records are linked to it`);
        }
        // The sample meeting: a file attached to it.
        for (const id of ids.meetingMinute ?? []) {
          const n = await tx.attachment.count({ where: { meetingId: id } });
          if (n > 0) keepRow("meetingMinute", id, `${n} files are attached to it`);
        }
        // The sample project: anything of your own filed under it.
        for (const id of ids.project ?? []) {
          const stillThere = (["invoice", "purchaseOrder", "serviceProposal", "meetingMinute"] as SampleModel[])
            .reduce((n, m) => n + (keep.get(m)?.size ?? 0), 0);
          const n =
            (await ownLinks(tx, companyId, PROJECT_LINKED, "projectId", id, tracked)) +
            (await tx.attachment.count({ where: { projectId: id } })) +
            (await tx.order.count({ where: { companyId, project: { id } } })) +
            stillThere;
          if (n > 0) keepRow("project", id, `${n} of your own records are filed under it`);
        }
        // The sample client: a kept project, or anything of your own for this client.
        for (const id of ids.client ?? []) {
          const n =
            (await ownLinks(tx, companyId, CLIENT_LINKED, "clientId", id, tracked)) +
            (keep.get("project")?.size ?? 0) +
            (keep.get("invoice")?.size ?? 0) +
            (keep.get("serviceProposal")?.size ?? 0);
          if (n > 0) keepRow("client", id, `${n} of your own records belong to it`);
        }
      } catch (e) {
        throw new SampleStepError("links", e);
      }

      const going = (model: SampleModel) => (ids[model] ?? []).filter((id) => !keep.get(model)?.has(id));
      const projects = going("project");
      const clients = going("client");
      const meetings = going("meetingMinute");
      const keptProjects = [...(keep.get("project") ?? [])];
      const keptClients = [...(keep.get("client") ?? [])];
      const keptMeetings = [...(keep.get("meetingMinute") ?? [])];

      let removed = 0;
      for (const model of [...SAMPLE_MODEL_ORDER].reverse()) {
        try {
          const list = going(model);
          // A kept parent keeps the children it cannot stand without.
          if (model === "projectPhase" || model === "phaseDependency" || model === "phaseAssignment") {
            if (keptProjects.length > 0) continue;
          }
          if (model === "clientAddress" && keptClients.length > 0) continue;
          if (model === "actionItem" && keptMeetings.length > 0) continue;
          if (model === "costEstimate" || model === "projectSchedule") {
            // Both are the project's own sheet; they stay with a kept project.
            if (keptProjects.length > 0) continue;
          }
          if ((model === "estimateCategory" || model === "estimateItem" || model === "scheduleTask") && keptProjects.length > 0) continue;

          // Rows the practice added under a sample parent that has no cascade of
          // its own. They exist only as part of the sample record, and go with it.
          if (model === "actionItem" && meetings.length > 0) {
            removed += (await tx.actionItem.deleteMany({ where: { meetingId: { in: meetings } } })).count;
            continue;
          }
          if (model === "clientAddress" && clients.length > 0) {
            removed += (await tx.clientAddress.deleteMany({ where: { clientId: { in: clients } } })).count;
            continue;
          }
          if (model === "phaseDependency" && projects.length > 0) {
            removed += (await tx.phaseDependency.deleteMany({
              where: { OR: [{ dependent: { projectId: { in: projects } } }, { required: { projectId: { in: projects } } }] },
            })).count;
            continue;
          }
          if (model === "phaseAssignment" && projects.length > 0) {
            removed += (await tx.phaseAssignment.deleteMany({ where: { phase: { projectId: { in: projects } } } })).count;
            continue;
          }
          if (model === "projectPhase" && projects.length > 0) {
            // Sub-phases point at their parent phase; clear that first.
            await tx.projectPhase.updateMany({ where: { projectId: { in: projects } }, data: { parentId: null } });
            removed += (await tx.projectPhase.deleteMany({ where: { projectId: { in: projects } } })).count;
            continue;
          }
          if (model === "project" && projects.length > 0) {
            // The activity feed keeps its lines; they just stop pointing at a deleted project.
            await tx.activityLog.updateMany({ where: { companyId, projectId: { in: projects } }, data: { projectId: null } });
          }
          if (model === "client" && clients.length > 0) {
            await tx.activityLog.updateMany({ where: { companyId, clientId: { in: clients } }, data: { clientId: null } });
          }

          if (list.length === 0) continue;
          // A child of a parent that is kept stays with it.
          if (model === "invoiceLine" || model === "invoicePayment") {
            const keptInvoices = [...(keep.get("invoice") ?? [])];
            if (keptInvoices.length > 0) continue;
          }
          if (model.startsWith("serviceProposal") && model !== "serviceProposal" && (keep.get("serviceProposal")?.size ?? 0) > 0) continue;
          if ((model === "timeEntry" || model === "expense") && (keep.get("invoice")?.size ?? 0) > 0) {
            // Billed on an invoice that stays: the stamp must keep pointing at something.
            continue;
          }

          const where: Record<string, unknown> = SAMPLE_CHILD_MODELS.has(model)
            ? { id: { in: list } }
            : { id: { in: list }, companyId };
          removed += (await delegate(tx, model).deleteMany({ where })).count;
        } catch (e) {
          throw new SampleStepError(model, e);
        }
      }

      try {
        await writeRecord(tx, companyId, null);
      } catch (e) {
        throw new SampleStepError("appConfig", e);
      }
      return { ok: true, status: "removed", removed, kept };
    }, TX_OPTIONS);
  } catch (e) {
    return failure("remove", companyId, e);
  }
}
