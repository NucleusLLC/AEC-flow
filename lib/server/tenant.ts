/**
 * Tenant resolution. Every company-scoped query filters by the signed-in user's
 * companyId (carried on the session — see lib/auth.ts). This is the single place
 * that resolves "which company am I?", so the data layer just calls it.
 *
 * SERVER-ONLY (session + Prisma).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFounderEmail } from "@/lib/server/founder";

/** The signed-in user's companyId; falls back to the founder company so legacy /
 * unauthenticated server contexts still resolve to a real tenant. */
export async function getCurrentCompanyId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.companyId) return session.user.companyId;
  const founder = await prisma.company.findFirst({
    where: { isFounder: true },
    select: { id: true },
  });
  return founder?.id ?? null;
}

export type CurrentTenant = {
  companyId: string | null;
  /** True when the signed-in user is the platform founder (super-admin). */
  isFounder: boolean;
};

export async function getCurrentTenant(): Promise<CurrentTenant> {
  const session = await getServerSession(authOptions);
  const isFounder = isFounderEmail(session?.user?.email);
  const companyId = session?.user?.companyId ?? (await getCurrentCompanyId());
  return { companyId, isFounder };
}
