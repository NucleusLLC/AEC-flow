/** Submittal Logs repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_SUBMITTALS } from "@/lib/ca/seed-data";
import type { Submittal, CaDiscipline, SubmittalStatus } from "@/lib/ca/types";

export type SubmittalInput = {
  projectId: string;
  projectName?: string | null;
  title: string;
  description?: string | null;
  submittedBy?: string | null;
  reviewedBy?: string | null;
  discipline?: CaDiscipline;
  status?: SubmittalStatus;
  dateRequired?: string | null;
  reviewerComments?: string | null;
};

const REVIEWED_STATUSES: SubmittalStatus[] = ["REVIEWED", "APPROVED", "APPROVED_AS_NOTED", "REVISE_AND_RESUBMIT", "REJECTED"];

type Row = Awaited<ReturnType<typeof prisma.submittalLog.findFirstOrThrow>>;

function toDto(r: Row): Submittal {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    submittalNumber: r.submittalNumber,
    title: r.title,
    description: r.description,
    submittedBy: r.submittedBy,
    reviewedBy: r.reviewedBy,
    discipline: r.discipline,
    status: r.status,
    dateRequired: ymd(r.dateRequired),
    dateSubmitted: ymd(r.dateSubmitted),
    dateReviewed: ymd(r.dateReviewed),
    reviewerComments: r.reviewerComments,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listSubmittals(projectId?: string): Promise<Submittal[]> {
  return caRead(
    async () => {
      const rows = await prisma.submittalLog.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_SUBMITTALS.filter((s) => !projectId || s.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getSubmittal(id: string): Promise<Submittal | null> {
  return caRead(
    async () => {
      const row = await prisma.submittalLog.findFirst({ where: { OR: [{ id }, { submittalNumber: id }] } });
      return row ? toDto(row) : null;
    },
    () => SEED_SUBMITTALS.find((s) => s.id === id || s.submittalNumber === id) ?? null,
  );
}

export async function createSubmittal(input: SubmittalInput): Promise<Submittal> {
  const existing = await listSubmittals(input.projectId);
  const status = input.status ?? "REQUIRED";
  const row = await prisma.submittalLog.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      submittalNumber: nextSubmittalNumber(input.projectId, existing.map((s) => s.submittalNumber)),
      title: input.title,
      description: input.description ?? null,
      submittedBy: input.submittedBy ?? null,
      reviewedBy: input.reviewedBy ?? null,
      discipline: input.discipline ?? "OTHER",
      status,
      dateRequired: input.dateRequired ? new Date(input.dateRequired) : null,
      dateSubmitted: status !== "REQUIRED" ? new Date() : null,
      reviewerComments: input.reviewerComments ?? null,
    },
  });
  return toDto(row);
}

export async function updateSubmittal(id: string, input: Partial<SubmittalInput>): Promise<Submittal> {
  const current = await prisma.submittalLog.findUniqueOrThrow({ where: { id } });
  const nowSubmitted = input.status && input.status !== "REQUIRED" && current.status === "REQUIRED" && !current.dateSubmitted;
  const nowReviewed =
    input.status && REVIEWED_STATUSES.includes(input.status) && !REVIEWED_STATUSES.includes(current.status as SubmittalStatus);
  const row = await prisma.submittalLog.update({
    where: { id },
    data: {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      submittedBy: input.submittedBy ?? current.submittedBy,
      reviewedBy: input.reviewedBy ?? current.reviewedBy,
      discipline: input.discipline ?? current.discipline,
      status: input.status ?? current.status,
      dateRequired: input.dateRequired ? new Date(input.dateRequired) : current.dateRequired,
      dateSubmitted: nowSubmitted ? new Date() : current.dateSubmitted,
      dateReviewed: nowReviewed ? new Date() : current.dateReviewed,
      reviewerComments: input.reviewerComments ?? current.reviewerComments,
    },
  });
  return toDto(row);
}

export function nextSubmittalNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `SUB-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
