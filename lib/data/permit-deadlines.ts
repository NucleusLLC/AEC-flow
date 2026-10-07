/**
 * Permit DEADLINES data-access. SERVER-ONLY.
 *
 * BuildingPermitDeadline is in TENANT_MODELS (lib/db.ts), so every read here is
 * scoped to the caller's company by the Prisma extension — including on the
 * public /officedash board, where the company comes from its companyOverride
 * rather than a session. Writes additionally resolve the actor from the
 * database (requireActor) and stamp its company explicitly.
 *
 * The rules (labels, colours, validation) live in
 * lib/building-permits/deadlines.ts; this file only moves rows.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import {
  sortDeadlines,
  type OpenPermitDeadline,
  type PermitDeadlineDTO,
  type PermitDeadlineInput,
} from "@/lib/building-permits/deadlines";

/** Raised when the permit or deadline is not this company's (or does not exist). */
export class PermitDeadlineNotFoundError extends Error {
  constructor() {
    super("That deadline could not be found.");
    this.name = "PermitDeadlineNotFoundError";
  }
}

type DeadlineRow = {
  id: string;
  permitId: string;
  kind: PermitDeadlineDTO["kind"];
  label: string | null;
  dueDate: Date;
  metAt: Date | null;
  createdByName: string | null;
  createdAt: Date;
};

/** A `@db.Date` column comes back as UTC midnight; its calendar day is the ISO date part. */
export function deadlineDto(r: DeadlineRow): PermitDeadlineDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    kind: r.kind,
    label: r.label,
    dueDate: r.dueDate.toISOString().slice(0, 10),
    metAt: r.metAt?.toISOString() ?? null,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Open (unmet) deadlines on one permit, soonest first. */
export async function listPermitDeadlines(permitId: string): Promise<PermitDeadlineDTO[]> {
  const rows = await prisma.buildingPermitDeadline.findMany({
    where: { permitId, metAt: null },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return sortDeadlines(rows.map(deadlineDto));
}

/**
 * Every open deadline in the company, on permits that are not deleted, soonest
 * first — what the Dashboard and the Office Dash show.
 */
export async function listOpenPermitDeadlines(): Promise<OpenPermitDeadline[]> {
  const rows = await prisma.buildingPermitDeadline.findMany({
    where: { metAt: null, permit: { deletedAt: null } },
    include: {
      permit: { select: { reference: true, permitNumber: true, title: true, authority: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return sortDeadlines(
    rows.map((r) => ({
      ...deadlineDto(r),
      reference: r.permit.reference,
      permitNumber: r.permit.permitNumber,
      title: r.permit.title,
      authority: r.permit.authority,
    })),
  );
}

/** Add a deadline to a permit. `input` must already have passed checkDeadlineInput. */
export async function createPermitDeadline(
  permitId: string,
  input: PermitDeadlineInput,
): Promise<PermitDeadlineDTO> {
  const actor = await requireActor();
  // findFirst, not findUnique: the extension puts the company in the WHERE, and
  // a narrow select would defeat findUnique's after-the-fact company check.
  const permit = await prisma.buildingPermit.findFirst({
    where: { id: permitId, deletedAt: null, companyId: actor.companyId },
    select: { id: true },
  });
  if (!permit) throw new PermitDeadlineNotFoundError();
  const row = await prisma.buildingPermitDeadline.create({
    data: {
      companyId: actor.companyId,
      permitId: permit.id,
      kind: input.kind,
      label: input.kind === "OTHER" ? input.label : null,
      dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
      createdById: actor.id,
      createdByName: actor.name,
    },
  });
  return deadlineDto(row);
}

/** Mark a deadline met: it leaves the boards, the row stays as the record. */
export async function markPermitDeadlineMet(id: string): Promise<void> {
  const actor = await requireActor();
  const res = await prisma.buildingPermitDeadline.updateMany({
    where: { id, companyId: actor.companyId, metAt: null },
    data: { metAt: new Date() },
  });
  if (res.count === 0) {
    // Already met is fine (a double click); anything else is not ours.
    const exists = await prisma.buildingPermitDeadline.findFirst({
      where: { id, companyId: actor.companyId },
      select: { id: true },
    });
    if (!exists) throw new PermitDeadlineNotFoundError();
  }
}

/** Remove a deadline entered by mistake. */
export async function deletePermitDeadline(id: string): Promise<void> {
  const actor = await requireActor();
  const res = await prisma.buildingPermitDeadline.deleteMany({
    where: { id, companyId: actor.companyId },
  });
  if (res.count === 0) throw new PermitDeadlineNotFoundError();
}
