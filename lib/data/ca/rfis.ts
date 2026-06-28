/** RFI Logs repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_RFIS } from "@/lib/ca/seed-data";
import type { Rfi, CaDiscipline, RfiPriority, RfiStatus } from "@/lib/ca/types";

export type RfiInput = {
  projectId: string;
  projectName?: string | null;
  subject: string;
  question?: string | null;
  submittedBy?: string | null;
  assignedTo?: string | null;
  discipline?: CaDiscipline;
  priority?: RfiPriority;
  status?: RfiStatus;
  response?: string | null;
  responseBy?: string | null;
  dateRequired?: string | null;
  linkedChangeOrderId?: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.rfiLog.findFirstOrThrow>>;

function toDto(r: Row): Rfi {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    rfiNumber: r.rfiNumber,
    subject: r.subject,
    question: r.question,
    submittedBy: r.submittedBy,
    assignedTo: r.assignedTo,
    discipline: r.discipline,
    priority: r.priority,
    status: r.status,
    response: r.response,
    responseBy: r.responseBy,
    dateSubmitted: ymd(r.dateSubmitted),
    dateRequired: ymd(r.dateRequired),
    dateResponded: ymd(r.dateResponded),
    linkedChangeOrderId: r.linkedChangeOrderId,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listRfis(projectId?: string): Promise<Rfi[]> {
  return caRead(
    async () => {
      const rows = await prisma.rfiLog.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_RFIS.filter((r) => !projectId || r.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getRfi(id: string): Promise<Rfi | null> {
  return caRead(
    async () => {
      const row = await prisma.rfiLog.findFirst({ where: { OR: [{ id }, { rfiNumber: id }] } });
      return row ? toDto(row) : null;
    },
    () => SEED_RFIS.find((r) => r.id === id || r.rfiNumber === id) ?? null,
  );
}

export async function createRfi(input: RfiInput): Promise<Rfi> {
  const existing = await listRfis(input.projectId);
  const row = await prisma.rfiLog.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      rfiNumber: nextRfiNumber(input.projectId, existing.map((r) => r.rfiNumber)),
      subject: input.subject,
      question: input.question ?? null,
      submittedBy: input.submittedBy ?? null,
      assignedTo: input.assignedTo ?? null,
      discipline: input.discipline ?? "OTHER",
      priority: input.priority ?? "NORMAL",
      status: input.status ?? "OPEN",
      response: input.response ?? null,
      responseBy: input.responseBy ?? null,
      dateSubmitted: new Date(),
      dateRequired: input.dateRequired ? new Date(input.dateRequired) : null,
      linkedChangeOrderId: input.linkedChangeOrderId ?? null,
    },
  });
  return toDto(row);
}

export async function updateRfi(id: string, input: Partial<RfiInput>): Promise<Rfi> {
  const current = await prisma.rfiLog.findUniqueOrThrow({ where: { id } });
  const answering =
    (input.status === "ANSWERED" || input.status === "CLOSED") &&
    current.status !== "ANSWERED" &&
    current.status !== "CLOSED";
  const row = await prisma.rfiLog.update({
    where: { id },
    data: {
      subject: input.subject ?? current.subject,
      question: input.question ?? current.question,
      assignedTo: input.assignedTo ?? current.assignedTo,
      discipline: input.discipline ?? current.discipline,
      priority: input.priority ?? current.priority,
      status: input.status ?? current.status,
      response: input.response ?? current.response,
      responseBy: input.responseBy ?? current.responseBy,
      dateRequired: input.dateRequired ? new Date(input.dateRequired) : current.dateRequired,
      dateResponded: answering ? new Date() : current.dateResponded,
      linkedChangeOrderId: input.linkedChangeOrderId ?? current.linkedChangeOrderId,
    },
  });
  return toDto(row);
}

export function nextRfiNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `RFI-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
