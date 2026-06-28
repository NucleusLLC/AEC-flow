/** Punch List repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_PUNCH_ITEMS } from "@/lib/ca/seed-data";
import type { PunchListItem, PunchPriority, PunchStatus } from "@/lib/ca/types";

export type PunchInput = {
  projectId: string;
  projectName?: string | null;
  description: string;
  location?: string | null;
  trade?: string | null;
  responsibleParty?: string | null;
  priority?: PunchPriority;
  status?: PunchStatus;
  dueDate?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.punchListItem.findFirstOrThrow>>;

function toDto(r: Row): PunchListItem {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    itemNumber: r.itemNumber,
    location: r.location,
    description: r.description,
    trade: r.trade,
    responsibleParty: r.responsibleParty,
    priority: r.priority,
    status: r.status,
    dateIdentified: ymd(r.dateIdentified),
    dueDate: ymd(r.dueDate),
    dateCompleted: ymd(r.dateCompleted),
    verifiedBy: r.verifiedBy,
    notes: r.notes,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listPunchItems(projectId?: string): Promise<PunchListItem[]> {
  return caRead(
    async () => {
      const rows = await prisma.punchListItem.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_PUNCH_ITEMS.filter((p) => !projectId || p.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getPunchItem(id: string): Promise<PunchListItem | null> {
  return caRead(
    async () => {
      const row = await prisma.punchListItem.findFirst({
        where: { OR: [{ id }, { itemNumber: id }] },
      });
      return row ? toDto(row) : null;
    },
    () => SEED_PUNCH_ITEMS.find((p) => p.id === id || p.itemNumber === id) ?? null,
  );
}

export async function createPunchItem(input: PunchInput): Promise<PunchListItem> {
  const existing = await listPunchItems(input.projectId);
  const row = await prisma.punchListItem.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      itemNumber: nextPunchNumber(input.projectId, existing.map((p) => p.itemNumber)),
      description: input.description,
      location: input.location ?? null,
      trade: input.trade ?? null,
      responsibleParty: input.responsibleParty ?? null,
      priority: input.priority ?? "MEDIUM",
      status: input.status ?? "OPEN",
      dateIdentified: new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      verifiedBy: input.verifiedBy ?? null,
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

export async function updatePunchItem(id: string, input: Partial<PunchInput>): Promise<PunchListItem> {
  const current = await prisma.punchListItem.findUniqueOrThrow({ where: { id } });
  const nextStatus = input.status ?? current.status;
  // Stamp completion when an item first reaches a closed-out state.
  const closing =
    (nextStatus === "COMPLETED" || nextStatus === "VERIFIED") &&
    current.status !== "COMPLETED" &&
    current.status !== "VERIFIED";
  const reopening = nextStatus === "OPEN" || nextStatus === "IN_PROGRESS";
  const row = await prisma.punchListItem.update({
    where: { id },
    data: {
      description: input.description ?? current.description,
      location: input.location ?? current.location,
      trade: input.trade ?? current.trade,
      responsibleParty: input.responsibleParty ?? current.responsibleParty,
      priority: input.priority ?? current.priority,
      status: nextStatus,
      dueDate: input.dueDate ? new Date(input.dueDate) : current.dueDate,
      dateCompleted: closing ? new Date() : reopening ? null : current.dateCompleted,
      verifiedBy:
        nextStatus === "VERIFIED" ? input.verifiedBy ?? current.verifiedBy : current.verifiedBy,
      notes: input.notes ?? current.notes,
    },
  });
  return toDto(row);
}

export function nextPunchNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `PL-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
