/**
 * Credit notes — data access. SERVER-ONLY.
 *
 * A credit note takes back some or all of what ONE issued invoice asked for.
 * It never edits the invoice; it reduces what the invoice still owes, through
 * `invoiceBalance` in lib/finance/calc.ts, and only once it is ISSUED.
 *
 * THE RULES, AND WHERE EACH ONE IS ENFORCED
 *   · Only an issued invoice (not a draft, not a void) can be credited.
 *   · Client, currency and tax are copied from the invoice when the credit
 *     note is raised — the same snapshot rule as an invoice. The form cannot
 *     send them; a credit note in another currency or at another tax rate from
 *     its invoice is impossible to construct here.
 *   · Every line credits a line of THAT invoice, for no more than that line
 *     has left after other issued credit notes.
 *   · The total can never exceed the invoice's outstanding balance AT ISSUE.
 *     Checked when a draft is saved (so the person hears early) and again at
 *     issue inside a transaction that locks the invoice row — two people
 *     issuing two credits against the same invoice at once cannot both pass.
 *   · DRAFT is editable and deletable; ISSUED changes only by being voided;
 *     a VOID credit note is ignored by every balance, so voiding restores it.
 *
 * WHO. Any active member of the practice (`requireActor`) may read, raise,
 * edit and delete a DRAFT. ISSUING and VOIDING — the two writes that move the
 * client's balance — are for an administrator, a director or the founder
 * (`canManagePasswords`), checked here as well as in the actions in front of
 * them, because an action is a public endpoint.
 *
 * Same conventions as lib/data/invoices.ts: findFirst (never findUnique) for
 * single rows, and child rows written TOP-LEVEL with the company stamped on —
 * a nested create lands with a NULL company.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  checkCreditNote,
  creditableByLine,
  invoiceBalance,
  invoiceTotals,
  nextCreditNoteNumber,
} from "@/lib/finance/calc";
import { fromMajor } from "@/lib/proposals/engine/money";
import type {
  CreditNoteDTO,
  CreditNoteInput,
  CreditNoteLineDTO,
  CreditNoteStatus,
  CreditNoteSummaryDTO,
  CreditableInvoice,
  InvoiceStatus,
  TaxMode,
} from "@/lib/finance/types";

export class CreditNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditNoteError";
  }
}

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function num(v: DecimalLike): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  const n = v.toNumber();
  return Number.isFinite(n) ? n : 0;
}

function ymd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// ── Rows and DTOs ──────────────────────────────────────────────────────────

type LineRow = {
  id: string;
  creditNoteId: string;
  invoiceLineId: string | null;
  description: string;
  amount: DecimalLike;
  taxable: boolean;
  sortOrder: number;
};

type CreditNoteRow = {
  id: string;
  number: string;
  status: CreditNoteStatus;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  clientId: string | null;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  billingAddress: string | null;
  projectId: string | null;
  projectName: string | null;
  date: Date;
  reason: string;
  taxName: string | null;
  taxPercent: DecimalLike;
  taxMode: TaxMode;
  subtotal: DecimalLike;
  taxableSubtotal: DecimalLike;
  taxTotal: DecimalLike;
  total: DecimalLike;
  notes: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  issuedAt: Date | null;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines?: LineRow[];
};

function lineDto(r: LineRow): CreditNoteLineDTO {
  return {
    id: r.id,
    creditNoteId: r.creditNoteId,
    invoiceLineId: r.invoiceLineId,
    description: r.description,
    amount: num(r.amount),
    taxable: r.taxable,
    sortOrder: r.sortOrder,
  };
}

export function creditNoteSummaryDto(r: CreditNoteRow): CreditNoteSummaryDTO {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    currency: r.currency,
    clientId: r.clientId,
    clientName: r.clientName,
    projectId: r.projectId,
    projectName: r.projectName,
    date: ymd(r.date)!,
    reason: r.reason,
    subtotal: num(r.subtotal),
    taxTotal: num(r.taxTotal),
    total: num(r.total),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function creditNoteDto(r: CreditNoteRow): CreditNoteDTO {
  return {
    ...creditNoteSummaryDto(r),
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    billingAddress: r.billingAddress,
    taxName: r.taxName,
    taxPercent: num(r.taxPercent),
    taxMode: r.taxMode,
    taxableSubtotal: num(r.taxableSubtotal),
    notes: r.notes,
    createdByName: r.createdByName,
    issuedByName: r.issuedByName,
    issuedAt: r.issuedAt ? r.issuedAt.toISOString() : null,
    voidReason: r.voidReason,
    voidedAt: ymd(r.voidedAt),
    createdAt: r.createdAt.toISOString(),
    lines: (r.lines ?? []).map(lineDto),
  };
}

const LINES = { lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } satisfies Prisma.CreditNoteInclude;

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listCreditNotes(
  filter: { invoiceId?: string; clientId?: string } = {},
): Promise<CreditNoteSummaryDTO[]> {
  await requireActor();
  const rows = await prisma.creditNote.findMany({
    where: {
      deletedAt: null,
      ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
    },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });
  return (rows as unknown as CreditNoteRow[]).map(creditNoteSummaryDto);
}

export async function getCreditNote(idOrNumber: string): Promise<CreditNoteDTO | null> {
  await requireActor();
  const row = await prisma.creditNote.findFirst({
    where: { deletedAt: null, OR: [{ id: idOrNumber }, { number: idOrNumber }] },
    include: LINES,
  });
  return row ? creditNoteDto(row as unknown as CreditNoteRow) : null;
}

/**
 * Every credit note in the books — issued and voided, never drafts — with its
 * lines, for the accounting export. Not capped, for the same reason as
 * `listInvoicesForExport`. Who may call it is decided by the export route.
 */
export async function listCreditNotesForExport(): Promise<CreditNoteDTO[]> {
  const rows = await prisma.creditNote.findMany({
    where: { deletedAt: null, status: { not: "DRAFT" } },
    include: LINES,
    orderBy: [{ date: "asc" }, { number: "asc" }],
  });
  return (rows as unknown as CreditNoteRow[]).map(creditNoteDto);
}

// ── The invoice being credited ─────────────────────────────────────────────

/** The prisma client or a transaction on it — both carry the tenant extension. */
type Db = Pick<typeof prisma, "invoice">;

/** The invoice, its lines and payments, and its OTHER live credit notes with their lines. */
async function loadInvoice(db: Db, invoiceId: string, exceptCreditNoteId?: string) {
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      payments: true,
      creditNotes: {
        where: {
          deletedAt: null,
          status: "ISSUED",
          ...(exceptCreditNoteId ? { NOT: { id: exceptCreditNoteId } } : {}),
        },
        include: { lines: true },
      },
    },
  });
  if (!inv) throw new CreditNoteError("That invoice could not be found.");
  return inv;
}

type LoadedInvoice = Awaited<ReturnType<typeof loadInvoice>>;

/**
 * What the credit-note form needs: the invoice's snapshot, each line with
 * what is left to credit on it, and the outstanding balance the whole credit
 * may not exceed — all with `exceptCreditNoteId` (the draft being edited)
 * left out. The form shows these as limits; the server re-checks them.
 */
export async function getCreditableInvoice(
  invoiceId: string,
  exceptCreditNoteId?: string,
): Promise<CreditableInvoice | null> {
  await requireActor();
  let inv: LoadedInvoice;
  try {
    inv = await loadInvoice(prisma, invoiceId, exceptCreditNoteId);
  } catch {
    return null;
  }
  const currency = inv.currency;
  const room = creditableByLine(
    inv.lines.map((l) => ({ id: l.id, amount: num(l.amount) })),
    inv.creditNotes.flatMap((c) =>
      c.lines.map((l) => ({ invoiceLineId: l.invoiceLineId, amount: num(l.amount) })),
    ),
    currency,
  );
  const balance = invoiceBalance({
    total: num(inv.total),
    currency,
    payments: inv.payments.map((p) => ({ amount: num(p.amount) })),
    credits: inv.creditNotes.map((c) => ({
      amount: num(c.total),
      status: c.status as CreditNoteStatus,
      currency: c.currency,
    })),
  });
  const stored = inv.status as InvoiceStatus;
  return {
    id: inv.id,
    number: inv.number,
    status: stored,
    currency,
    clientName: inv.clientName,
    projectName: inv.projectName,
    taxName: inv.taxName,
    taxPercent: num(inv.taxPercent),
    taxMode: inv.taxMode as TaxMode,
    total: num(inv.total),
    paid: balance.paid,
    credited: balance.credited,
    available: stored === "DRAFT" || stored === "VOID" ? 0 : balance.outstanding,
    lines: inv.lines.map((l) => ({
      id: l.id,
      description: l.description,
      amount: num(l.amount),
      taxable: l.taxable,
      creditable: room.get(l.id) ?? 0,
    })),
  };
}

/**
 * The lines and totals a credit note would have against this invoice, with
 * every rule checked. Throws a CreditNoteError a person can act on.
 */
function buildCredit(inv: LoadedInvoice, input: CreditNoteInput) {
  const currency = inv.currency;
  const stored = inv.status as InvoiceStatus;
  if (stored === "DRAFT" || stored === "VOID") {
    throw new CreditNoteError("Only an issued invoice can be credited.");
  }

  const room = creditableByLine(
    inv.lines.map((l) => ({ id: l.id, amount: num(l.amount) })),
    inv.creditNotes.flatMap((c) =>
      c.lines.map((l) => ({ invoiceLineId: l.invoiceLineId, amount: num(l.amount) })),
    ),
    currency,
  );

  const seen = new Set<string>();
  const lines = input.lines.map((l, i) => {
    const source = inv.lines.find((x) => x.id === l.invoiceLineId);
    if (!source) throw new CreditNoteError("A credited line is not on this invoice.");
    if (seen.has(source.id)) throw new CreditNoteError("The same invoice line is credited twice.");
    seen.add(source.id);
    const left = room.get(source.id) ?? 0;
    if (fromMajor(l.amount, currency).minor > fromMajor(left, currency).minor) {
      throw new CreditNoteError(
        `“${source.description}” has ${left.toFixed(2)} ${currency} left to credit; ${l.amount.toFixed(2)} was asked for.`,
      );
    }
    return {
      invoiceLineId: source.id,
      description: source.description,
      amount: l.amount,
      taxable: source.taxable,
      sortOrder: i,
    };
  });

  const totals = invoiceTotals(
    lines,
    { percent: num(inv.taxPercent), mode: inv.taxMode as TaxMode },
    currency,
  );

  const check = checkCreditNote(
    {
      status: stored,
      total: num(inv.total),
      currency,
      payments: inv.payments.map((p) => ({ amount: num(p.amount) })),
      credits: inv.creditNotes.map((c) => ({
        amount: num(c.total),
        status: c.status as CreditNoteStatus,
        currency: c.currency,
      })),
    },
    { amount: totals.total, currency },
  );
  if (!check.ok) {
    throw new CreditNoteError(
      check.available > 0
        ? `${check.error} ${check.available.toFixed(2)} ${currency} is outstanding; this credit note is ${totals.total.toFixed(2)}.`
        : check.error,
    );
  }

  return { lines, totals };
}

function headerFrom(inv: LoadedInvoice, input: CreditNoteInput, totals: ReturnType<typeof invoiceTotals>) {
  return {
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    // The snapshot: everything the client sees about who and what, copied from
    // the invoice, never from the form.
    currency: inv.currency,
    clientId: inv.clientId,
    clientName: inv.clientName,
    contactName: inv.contactName,
    contactEmail: inv.contactEmail,
    billingAddress: inv.billingAddress,
    projectId: inv.projectId,
    projectName: inv.projectName,
    taxName: inv.taxName,
    taxPercent: inv.taxPercent,
    taxMode: inv.taxMode,
    date: toDate(input.date),
    reason: input.reason.trim(),
    notes: input.notes ?? null,
    subtotal: totals.subtotal,
    taxableSubtotal: totals.taxableSubtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
  };
}

/** Issue and void move money: Admin / Director / founder only. */
async function requireCreditManager() {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) {
    throw new CreditNoteError("Only an administrator or director can issue or void a credit note.");
  }
  return actor;
}

async function requireCreditNote(id: string) {
  const row = await prisma.creditNote.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, invoiceId: true },
  });
  if (!row) throw new CreditNoteError("That credit note could not be found.");
  return row as { id: string; status: CreditNoteStatus; invoiceId: string };
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** Raise a DRAFT credit note against an issued invoice. */
export async function createCreditNote(input: CreditNoteInput): Promise<CreditNoteDTO> {
  const actor = await requireActor();
  const inv = await loadInvoice(prisma, input.invoiceId);
  const { lines, totals } = buildCredit(inv, input);

  // The number is taken the way an invoice's is; a clash with a colleague
  // raising one at the same moment is retried rather than reported.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await prisma.creditNote.findMany({ select: { number: true } });
    const number = nextCreditNoteNumber(existing.map((e) => e.number), new Date().getFullYear());
    try {
      const id = await prisma.$transaction(async (tx) => {
        const created = await tx.creditNote.create({
          data: {
            ...headerFrom(inv, input, totals),
            number,
            status: "DRAFT",
            createdById: actor.id,
            createdByName: actor.name,
          },
        });
        await tx.creditNoteLine.createMany({
          data: lines.map((l) => ({ ...l, creditNoteId: created.id, companyId: actor.companyId })),
        });
        return created.id;
      });
      const full = await getCreditNote(id);
      if (!full) throw new CreditNoteError("That credit note could not be found.");
      return full;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 2) continue;
      throw e;
    }
  }
  throw new CreditNoteError("Could not number the credit note. Try again.");
}

/** Replace a DRAFT's date, reason, notes and lines. The invoice cannot change. */
export async function updateCreditNote(id: string, input: CreditNoteInput): Promise<CreditNoteDTO> {
  const actor = await requireActor();
  const current = await requireCreditNote(id);
  if (current.status !== "DRAFT") {
    throw new CreditNoteError("This credit note has been issued, so it cannot be edited.");
  }
  if (input.invoiceId !== current.invoiceId) {
    throw new CreditNoteError("A credit note cannot be moved to a different invoice.");
  }
  const inv = await loadInvoice(prisma, current.invoiceId, id);
  const { lines, totals } = buildCredit(inv, input);

  await prisma.$transaction(async (tx) => {
    await tx.creditNote.update({
      where: { id },
      data: { ...headerFrom(inv, input, totals), updatedById: actor.id },
    });
    await tx.creditNoteLine.deleteMany({ where: { creditNoteId: id } });
    await tx.creditNoteLine.createMany({
      data: lines.map((l) => ({ ...l, creditNoteId: id, companyId: actor.companyId })),
    });
  });
  const full = await getCreditNote(id);
  if (!full) throw new CreditNoteError("That credit note could not be found.");
  return full;
}

/**
 * Issue it. Re-checked against the invoice INSIDE a transaction that holds a
 * row lock on the invoice, so the balance it is checked against cannot move
 * under it: a payment recorded or a second credit issued a second earlier is
 * already in what it reads.
 */
export async function issueCreditNote(id: string): Promise<CreditNoteDTO> {
  const actor = await requireCreditManager();
  const current = await requireCreditNote(id);
  if (current.status !== "DRAFT") {
    throw new CreditNoteError("This credit note has already been issued.");
  }

  await prisma.$transaction(async (tx) => {
    // Serialise every issue against this invoice. The invoice was found
    // through the tenant-scoped client above, so this id is the caller's own.
    await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${current.invoiceId} FOR UPDATE`;

    const note = await tx.creditNote.findFirst({
      where: { id, deletedAt: null, status: "DRAFT" },
      include: { lines: true },
    });
    if (!note) throw new CreditNoteError("This credit note has already been issued.");

    const inv = await loadInvoice(tx, note.invoiceId, id);
    // The draft's own lines, re-validated against the invoice as it is NOW.
    buildCredit(inv, {
      invoiceId: note.invoiceId,
      date: ymd(note.date)!,
      reason: note.reason,
      notes: note.notes,
      lines: note.lines
        .filter((l) => l.invoiceLineId)
        .map((l) => ({ invoiceLineId: l.invoiceLineId!, amount: num(l.amount) })),
    });

    const done = await tx.creditNote.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "ISSUED", issuedAt: new Date(), issuedByName: actor.name, updatedById: actor.id },
    });
    if (done.count !== 1) throw new CreditNoteError("This credit note has already been issued.");
  });

  const full = await getCreditNote(id);
  if (!full) throw new CreditNoteError("That credit note could not be found.");
  return full;
}

/** Void it, with a reason. The balance it took off the invoice comes back. */
export async function voidCreditNote(id: string, reason: string): Promise<CreditNoteDTO> {
  const actor = await requireCreditManager();
  const current = await requireCreditNote(id);
  if (current.status === "VOID") throw new CreditNoteError("This credit note is already void.");
  if (current.status === "DRAFT") {
    throw new CreditNoteError("A draft credit note is deleted, not voided.");
  }
  const why = reason.trim();
  if (!why) throw new CreditNoteError("Say why the credit note is being voided.");
  await prisma.creditNote.update({
    where: { id },
    data: { status: "VOID", voidReason: why, voidedAt: new Date(), updatedById: actor.id },
  });
  const full = await getCreditNote(id);
  if (!full) throw new CreditNoteError("That credit note could not be found.");
  return full;
}

/** Soft delete, drafts only. An issued credit note is a record and stays. */
export async function deleteCreditNote(id: string): Promise<{ invoiceId: string }> {
  await requireActor();
  const current = await requireCreditNote(id);
  if (current.status !== "DRAFT") {
    throw new CreditNoteError("This credit note has been issued, so it cannot be deleted.");
  }
  const affected = await prisma.creditNote.updateMany({
    where: { id, deletedAt: null, status: "DRAFT" },
    data: { deletedAt: new Date() },
  });
  if (affected.count === 0) throw new CreditNoteError("That credit note could not be found.");
  return { invoiceId: current.invoiceId };
}
