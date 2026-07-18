/**
 * Design deliverables / drawing register data-access. SERVER-ONLY.
 *
 * Additive and self-contained — never touches the protected Estimates or
 * Schedule systems. DesignDeliverable is tenant-scoped by the Prisma extension
 * in lib/db.ts, so every function here operates within the current company.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type {
  DesignDeliverableDTO,
  DesignDeliverableInput,
  DesignDiscipline,
  DeliverableStatus,
} from "@/lib/design/types";

type Row = Awaited<ReturnType<typeof prisma.designDeliverable.findFirstOrThrow>>;

/** Thrown when a deliverable number already exists in the company. */
export class DuplicateNumberError extends Error {
  constructor(number: string) {
    super(`Deliverable number "${number}" already exists.`);
    this.name = "DuplicateNumberError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDto(r: Row): DesignDeliverableDTO {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    discipline: r.discipline,
    type: r.type,
    revision: r.revision,
    status: r.status,
    projectId: r.projectId,
    projectName: r.projectName,
    scale: r.scale,
    sheetSize: r.sheetSize,
    issuedTo: r.issuedTo,
    issuedDate: ymd(r.issuedDate),
    dueDate: ymd(r.dueDate),
    fileLink: r.fileLink,
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listDeliverables(
  filter: { discipline?: DesignDiscipline; projectId?: string } = {},
): Promise<DesignDeliverableDTO[]> {
  const rows = await prisma.designDeliverable.findMany({
    where: {
      ...(filter.discipline ? { discipline: filter.discipline } : {}),
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
    },
    orderBy: [{ number: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toDto);
}

export async function getDeliverable(id: string): Promise<DesignDeliverableDTO | null> {
  const row = await prisma.designDeliverable.findFirst({ where: { OR: [{ id }, { number: id }] } });
  return row ? toDto(row) : null;
}

function normalize(input: DesignDeliverableInput) {
  return {
    number: input.number.trim(),
    title: input.title.trim(),
    discipline: input.discipline,
    type: input.type ?? "DRAWING",
    revision: (input.revision ?? "-").trim() || "-",
    status: input.status ?? "DRAFT",
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    scale: input.scale ?? null,
    sheetSize: input.sheetSize ?? null,
    issuedTo: input.issuedTo ?? null,
    issuedDate: toDate(input.issuedDate),
    dueDate: toDate(input.dueDate),
    fileLink: input.fileLink ?? null,
    notes: input.notes ?? null,
  };
}

export async function createDeliverable(
  input: DesignDeliverableInput,
): Promise<DesignDeliverableDTO> {
  const session = await getServerSession(authOptions);
  try {
    const row = await prisma.designDeliverable.create({
      data: {
        ...normalize(input),
        createdById: session?.user?.id ?? null,
        createdByName: session?.user?.name ?? null,
      },
    });
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateNumberError(input.number.trim());
    throw err;
  }
}

export async function updateDeliverable(
  id: string,
  input: DesignDeliverableInput,
): Promise<DesignDeliverableDTO> {
  try {
    const row = await prisma.designDeliverable.update({ where: { id }, data: normalize(input) });
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateNumberError(input.number.trim());
    throw err;
  }
}

export async function deleteDeliverable(id: string): Promise<void> {
  await prisma.designDeliverable.deleteMany({ where: { id } });
}

export interface DisciplineStat {
  discipline: DesignDiscipline;
  total: number;
  issued: number;
  draft: number;
}

export interface DesignSummary {
  total: number;
  issued: number;
  inReview: number;
  byStatus: Record<DeliverableStatus, number>;
  byDiscipline: DisciplineStat[];
}

export async function designSummary(): Promise<DesignSummary> {
  const items = await listDeliverables();
  const byStatus = {
    DRAFT: 0,
    IN_REVIEW: 0,
    ISSUED: 0,
    SUPERSEDED: 0,
    APPROVED: 0,
  } as Record<DeliverableStatus, number>;
  const disc = new Map<DesignDiscipline, DisciplineStat>();
  for (const d of items) {
    byStatus[d.status] += 1;
    const s =
      disc.get(d.discipline) ?? { discipline: d.discipline, total: 0, issued: 0, draft: 0 };
    s.total += 1;
    if (d.status === "ISSUED" || d.status === "APPROVED") s.issued += 1;
    if (d.status === "DRAFT") s.draft += 1;
    disc.set(d.discipline, s);
  }
  return {
    total: items.length,
    issued: byStatus.ISSUED + byStatus.APPROVED,
    inReview: byStatus.IN_REVIEW,
    byStatus,
    byDiscipline: Array.from(disc.values()),
  };
}
