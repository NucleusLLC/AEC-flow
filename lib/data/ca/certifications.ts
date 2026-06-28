/** Progress Certifications / Bank Draw repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, num, ymd, ymdReq } from "@/lib/data/ca/repo";
import { progressPayment } from "@/lib/ca/calc";
import { SEED_CERTIFICATIONS } from "@/lib/ca/seed-data";
import type { ProgressCertification, CertificationStatus } from "@/lib/ca/types";

export type CertificationInput = {
  projectId: string;
  projectName?: string | null;
  inspectionDate?: string | null;
  certifiedBy?: string | null;
  lenderName?: string | null;
  contractorName?: string | null;
  contractValue?: number;
  currency?: string;
  previousPercentComplete?: number;
  currentPercentComplete?: number;
  retentionPercentage?: number;
  previousPaymentsValue?: number;
  deficiencies?: string | null;
  recommendation?: string | null;
  status?: CertificationStatus;
};

type Row = Awaited<ReturnType<typeof prisma.progressCertification.findFirstOrThrow>>;

function toDto(r: Row): ProgressCertification {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    certificationNumber: r.certificationNumber,
    version: r.version,
    inspectionDate: ymd(r.inspectionDate),
    certifiedBy: r.certifiedBy,
    lenderName: r.lenderName,
    contractorName: r.contractorName,
    contractValue: num(r.contractValue),
    currency: r.currency,
    previousPercentComplete: num(r.previousPercentComplete),
    currentPercentComplete: num(r.currentPercentComplete),
    workCompletedValue: num(r.workCompletedValue),
    retentionPercentage: num(r.retentionPercentage),
    retentionAmount: num(r.retentionAmount),
    previousPaymentsValue: num(r.previousPaymentsValue),
    amountRecommendedForPayment: num(r.amountRecommendedForPayment),
    deficiencies: r.deficiencies,
    recommendation: r.recommendation,
    status: r.status,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listCertifications(projectId?: string): Promise<ProgressCertification[]> {
  return caRead(
    async () => {
      const rows = await prisma.progressCertification.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_CERTIFICATIONS.filter((c) => !projectId || c.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getCertification(id: string): Promise<ProgressCertification | null> {
  return caRead(
    async () => {
      const row = await prisma.progressCertification.findFirst({
        where: { OR: [{ id }, { certificationNumber: id }] },
      });
      return row ? toDto(row) : null;
    },
    () => SEED_CERTIFICATIONS.find((c) => c.id === id || c.certificationNumber === id) ?? null,
  );
}

export async function createCertification(input: CertificationInput): Promise<ProgressCertification> {
  const existing = await listCertifications(input.projectId);
  const calc = progressPayment({
    contractValue: input.contractValue ?? 0,
    currentPercentComplete: input.currentPercentComplete ?? 0,
    retentionPercentage: input.retentionPercentage ?? 0,
    previousPaymentsValue: input.previousPaymentsValue ?? 0,
  });
  const row = await prisma.progressCertification.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      certificationNumber: nextCertNumber(input.projectId, existing.map((c) => c.certificationNumber)),
      inspectionDate: input.inspectionDate ? new Date(input.inspectionDate) : null,
      certifiedBy: input.certifiedBy ?? null,
      lenderName: input.lenderName ?? null,
      contractorName: input.contractorName ?? null,
      contractValue: input.contractValue ?? 0,
      currency: input.currency ?? "USD",
      previousPercentComplete: input.previousPercentComplete ?? 0,
      currentPercentComplete: input.currentPercentComplete ?? 0,
      workCompletedValue: calc.workCompletedValue,
      retentionPercentage: input.retentionPercentage ?? 0,
      retentionAmount: calc.retentionAmount,
      previousPaymentsValue: input.previousPaymentsValue ?? 0,
      amountRecommendedForPayment: calc.amountRecommendedForPayment,
      deficiencies: input.deficiencies ?? null,
      recommendation: input.recommendation ?? null,
      status: input.status ?? "DRAFT",
    },
  });
  return toDto(row);
}

export async function updateCertification(id: string, input: CertificationInput): Promise<ProgressCertification> {
  const calc = progressPayment({
    contractValue: input.contractValue ?? 0,
    currentPercentComplete: input.currentPercentComplete ?? 0,
    retentionPercentage: input.retentionPercentage ?? 0,
    previousPaymentsValue: input.previousPaymentsValue ?? 0,
  });
  const row = await prisma.progressCertification.update({
    where: { id },
    data: {
      projectName: input.projectName ?? null,
      inspectionDate: input.inspectionDate ? new Date(input.inspectionDate) : null,
      certifiedBy: input.certifiedBy ?? null,
      lenderName: input.lenderName ?? null,
      contractorName: input.contractorName ?? null,
      contractValue: input.contractValue ?? 0,
      currency: input.currency ?? "USD",
      previousPercentComplete: input.previousPercentComplete ?? 0,
      currentPercentComplete: input.currentPercentComplete ?? 0,
      workCompletedValue: calc.workCompletedValue,
      retentionPercentage: input.retentionPercentage ?? 0,
      retentionAmount: calc.retentionAmount,
      previousPaymentsValue: input.previousPaymentsValue ?? 0,
      amountRecommendedForPayment: calc.amountRecommendedForPayment,
      deficiencies: input.deficiencies ?? null,
      recommendation: input.recommendation ?? null,
      ...(input.status ? { status: input.status } : {}),
      // certificationNumber is immutable once issued.
    },
  });
  return toDto(row);
}

export function nextCertNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `PC-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
