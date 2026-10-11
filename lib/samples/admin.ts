/**
 * The founder's view of every company's sample set: who has one, which
 * version and language, and how much of its own data each company holds, so a
 * company whose signup seeding failed (clients but no projects, or nothing at
 * all) is obvious in the list.
 *
 * Founder-gated, like lib/server/admin.ts. Cross-company by design: it reads
 * through the unscoped client and groups by company. SERVER-ONLY.
 */
import { isCurrentUserFounder } from "@/lib/server/founder";
import { unscopedPrisma } from "./unscoped-db";
import { getSampleSetStatuses, type SampleSetStatus } from "./install";

export type SampleCompanyRow = {
  id: string;
  name: string;
  plan: string;
  isFounder: boolean;
  createdAt: string;
  users: number;
  /** The company's own records, sample or not: what its lists show today. */
  clients: number;
  projects: number;
  sample: SampleSetStatus;
};

export async function listSampleSetCompanies(): Promise<SampleCompanyRow[]> {
  if (!(await isCurrentUserFounder())) return [];
  const db = unscopedPrisma();
  const [companies, users, clients, projects] = await Promise.all([
    db.company.findMany({
      orderBy: [{ isFounder: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, plan: true, isFounder: true, createdAt: true },
    }),
    db.user.groupBy({ by: ["companyId"], _count: { _all: true } }),
    db.client.groupBy({ by: ["companyId"], _count: { _all: true } }),
    db.project.groupBy({ by: ["companyId"], _count: { _all: true } }),
  ]);
  const tally = (rows: { companyId: string | null; _count: { _all: number } }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.companyId) m.set(r.companyId, r._count._all);
    return m;
  };
  const [u, c, p] = [tally(users), tally(clients), tally(projects)];
  const statuses = await getSampleSetStatuses(companies.map((x) => x.id));

  return companies.map((x) => ({
    id: x.id,
    name: x.name,
    plan: x.plan,
    isFounder: x.isFounder,
    createdAt: x.createdAt.toISOString().slice(0, 10),
    users: u.get(x.id) ?? 0,
    clients: c.get(x.id) ?? 0,
    projects: p.get(x.id) ?? 0,
    sample: statuses.get(x.id) ?? { installed: false },
  }));
}

/** Whether a company is the founder's own: the push never touches it unless asked to. */
export async function isFounderCompany(companyId: string): Promise<boolean | null> {
  const row = await unscopedPrisma().company.findUnique({ where: { id: companyId }, select: { isFounder: true } });
  return row ? row.isFounder : null;
}
