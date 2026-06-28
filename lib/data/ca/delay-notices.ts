/** Delay Notices repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, num, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_DELAY_NOTICES } from "@/lib/ca/seed-data";
import type { DelayNotice, DelayStatus } from "@/lib/ca/types";

/** delay_notices has no currency column — the module presents amounts in AED. */
const DELAY_CURRENCY = "AED";

export type DelayNoticeInput = {
  projectId: string;
  projectName?: string | null;
  title: string;
  description?: string | null;
  cause?: string | null;
  responsibleParty?: string | null;
  claimedDays?: number;
  approvedDays?: number;
  costImpact?: number;
  status?: DelayStatus;
  dateStarted?: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.delayNotice.findFirstOrThrow>>;

function toDto(r: Row): DelayNotice {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    delayNoticeNumber: r.delayNoticeNumber,
    title: r.title,
    description: r.description,
    cause: r.cause,
    responsibleParty: r.responsibleParty,
    claimedDays: r.claimedDays,
    approvedDays: r.approvedDays,
    costImpact: num(r.costImpact),
    currency: DELAY_CURRENCY,
    status: r.status,
    dateStarted: ymd(r.dateStarted),
    dateResolved: ymd(r.dateResolved),
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listDelayNotices(projectId?: string): Promise<DelayNotice[]> {
  return caRead(
    async () => {
      const rows = await prisma.delayNotice.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_DELAY_NOTICES.filter((d) => !projectId || d.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getDelayNotice(id: string): Promise<DelayNotice | null> {
  return caRead(
    async () => {
      const row = await prisma.delayNotice.findFirst({ where: { OR: [{ id }, { delayNoticeNumber: id }] } });
      return row ? toDto(row) : null;
    },
    () => SEED_DELAY_NOTICES.find((d) => d.id === id || d.delayNoticeNumber === id) ?? null,
  );
}

export async function createDelayNotice(input: DelayNoticeInput): Promise<DelayNotice> {
  const existing = await listDelayNotices(input.projectId);
  const row = await prisma.delayNotice.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      delayNoticeNumber: nextDelayNoticeNumber(input.projectId, existing.map((d) => d.delayNoticeNumber)),
      title: input.title,
      description: input.description ?? null,
      cause: input.cause ?? null,
      responsibleParty: input.responsibleParty ?? null,
      claimedDays: input.claimedDays ?? 0,
      approvedDays: input.approvedDays ?? 0,
      costImpact: input.costImpact ?? 0,
      status: input.status ?? "SUBMITTED",
      dateStarted: input.dateStarted ? new Date(input.dateStarted) : null,
    },
  });
  return toDto(row);
}

export async function updateDelayNotice(id: string, input: Partial<DelayNoticeInput>): Promise<DelayNotice> {
  const current = await prisma.delayNotice.findUniqueOrThrow({ where: { id } });
  const resolving =
    (input.status === "ACCEPTED" || input.status === "REJECTED" || input.status === "CLOSED") &&
    current.status !== "ACCEPTED" &&
    current.status !== "REJECTED" &&
    current.status !== "CLOSED";
  const row = await prisma.delayNotice.update({
    where: { id },
    data: {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      cause: input.cause ?? current.cause,
      responsibleParty: input.responsibleParty ?? current.responsibleParty,
      claimedDays: input.claimedDays ?? current.claimedDays,
      approvedDays: input.approvedDays ?? current.approvedDays,
      costImpact: input.costImpact ?? current.costImpact,
      status: input.status ?? current.status,
      dateStarted: input.dateStarted ? new Date(input.dateStarted) : current.dateStarted,
      dateResolved: resolving ? new Date() : current.dateResolved,
    },
  });
  return toDto(row);
}

export function nextDelayNoticeNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `DN-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
