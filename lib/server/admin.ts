/**
 * Founder super-admin data. Cross-company reads — Company and User are NOT tenant
 * models, so the query extension doesn't scope them and the founder sees everyone.
 * Every function is founder-gated. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { isCurrentUserFounder } from "@/lib/server/founder";

export type AdminCompanyRow = {
  id: string;
  name: string;
  plan: string;
  seatLimit: number;
  expiresAt: string | null;
  modules: string[];
  isFounder: boolean;
  userCount: number;
  createdAt: string;
};

export async function listCompaniesForAdmin(): Promise<AdminCompanyRow[]> {
  if (!(await isCurrentUserFounder())) return [];
  const [companies, counts] = await Promise.all([
    prisma.company.findMany({ orderBy: [{ isFounder: "desc" }, { createdAt: "asc" }] }),
    prisma.user.groupBy({ by: ["companyId"], _count: { _all: true } }),
  ]);
  const byCompany = new Map<string, number>();
  for (const c of counts) if (c.companyId) byCompany.set(c.companyId, c._count._all);

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    plan: c.plan,
    seatLimit: c.seatLimit,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : null,
    modules: c.modules,
    isFounder: c.isFounder,
    userCount: byCompany.get(c.id) ?? 0,
    createdAt: c.createdAt.toISOString().slice(0, 10),
  }));
}
