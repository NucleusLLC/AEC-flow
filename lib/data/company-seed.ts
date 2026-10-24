/**
 * Seeds a company with a little sample data so its modules aren't empty on first
 * login — clients, projects, proposals, a schedule, an estimate, and tasks. Every
 * row carries the company's id explicitly (the tenant extension only auto-fills
 * companyId when it's omitted, and seeding runs pre-session at signup).
 *
 * WHY IT NEVER RE-READS WHAT IT JUST WROTE. Signup calls this inside a request
 * that has no session yet. There, `currentCompanyId()` is `null` (not
 * `undefined`), and the tenant extension in lib/db.ts scopes every READ of a
 * company-owned model to `companyId: null`: a read finds nothing, whatever the
 * `where` says. This file used to create three clients with `createMany` and
 * then `findMany` them back to learn their ids. At signup that read came back
 * empty, so there was no client to hang a project or a proposal on, and every
 * new company got three clients, four tasks and nothing else, without an error
 * anywhere. Each client is now created with `create`, which returns the row, so
 * nothing depends on a read. (Writes are safe: `create` keeps a companyId that is
 * given explicitly, whatever the scope.)
 *
 * Idempotent: each entity type is skipped if the company already has some, so it
 * can safely enrich a company that was previously seeded with only clients/tasks.
 * Those "already has some" reads are scoped the same way, so at signup they see
 * an empty company, which a company created a moment ago is.
 *
 * Each entity is its own step: one failing does not drop the ones after it, and
 * every failure is one `[aecflow-error]` line (docs/ERRORS.md) naming the step.
 * Best-effort — never throws (never blocks signup). SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { ERROR_LOG_TAG, redactText } from "@/lib/observability/error-record";
import { APP_VERSION, appBuildId } from "@/lib/version";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

/** What a run created, and which steps failed. Signup ignores it; the tests read it. */
export type SeedReport = {
  clients: number;
  projects: number;
  schedules: number;
  estimates: number;
  proposals: number;
  tasks: number;
  failures: string[];
};

/** One line in the function logs, so a company that came up short can be explained. */
function logSeedFailure(companyId: string, step: string, error: unknown): void {
  try {
    const text = error instanceof Error ? error.message : String(error);
    // Prisma's messages run to many lines of source context; the last one is the sentence.
    const detail = text.trim().split("\n").filter(Boolean).pop()?.trim() ?? "";
    const record = {
      kind: "server",
      at: new Date().toISOString(),
      name: "CompanySeed",
      message: redactText(`seeding ${step} failed for company ${companyId}: ${detail}`).slice(0, 500),
      step,
      companyId,
      version: APP_VERSION,
      build: appBuildId() || "dev",
    };
    console.error(`${ERROR_LOG_TAG} ${JSON.stringify(record)}`);
  } catch {
    // Never let error reporting become the error.
  }
}

export async function seedCompany(companyId: string): Promise<SeedReport> {
  const report: SeedReport = { clients: 0, projects: 0, schedules: 0, estimates: 0, proposals: 0, tasks: 0, failures: [] };

  /** Runs one entity's seeding. A failure is logged and recorded; the next step still runs. */
  async function step<T>(name: string, run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (e) {
      report.failures.push(name);
      logSeedFailure(companyId, name, e);
      return undefined;
    }
  }

  const suffix = companyId.slice(-5).toUpperCase();
  // `User` is not a tenant model, so this read is never scoped.
  const owner = await step("owner", () =>
    prisma.user.findFirst({ where: { companyId }, select: { id: true, name: true } }),
  );
  if (!owner && !report.failures.includes("owner")) {
    report.failures.push("owner");
    logSeedFailure(companyId, "owner", new Error("the company has no user, so no project or proposal can be seeded"));
  }

  // 1) Clients — reuse if already seeded, else create three.
  const clients =
    (await step("clients", async () => {
      const existing = await prisma.client.findMany({ where: { companyId }, select: { id: true, name: true }, take: 3 });
      if (existing.length > 0) return existing;
      // `create`, not `createMany` + a read: see the file header.
      const created: { id: string; name: string }[] = [];
      for (const data of [
        { companyId, name: "Acme Development", companyName: "Acme Development LLC", type: "DEVELOPER", status: "ACTIVE", contactPerson: "Sample Contact", email: "contact@acme.example" },
        { companyId, name: "City Housing Authority", companyName: "City Housing Authority", type: "GOVERNMENT", status: "ACTIVE" },
        { companyId, name: "Riverside Villa", type: "PRIVATE", status: "PROSPECT" },
      ] as const) {
        created.push(await prisma.client.create({ data, select: { id: true, name: true } }));
        report.clients++;
      }
      return created;
    })) ?? [];
  const clientA = clients[0];
  const clientB = clients[1] ?? clients[0];

  // 2) Projects (need a client + a manager). Skip if any exist.
  const now = new Date();
  const projA = await step("projects", async () => {
    if (!owner || !clientA) return undefined;
    if ((await prisma.project.count({ where: { companyId } })) > 0) return undefined;
    const a = await prisma.project.create({
      data: {
        companyId,
        projectNumber: `SMP-${suffix}-01`,
        name: "Acme HQ Renovation",
        clientId: clientA.id,
        managerId: owner.id,
        status: "ACTIVE",
        priority: "HIGH",
        siteAddress: "12 Business Bay",
        disciplines: ["ARCHITECTURE"],
        progressPct: 35,
        startDate: addDays(now, -30),
        targetEndDate: addDays(now, 120),
      },
    });
    report.projects++;
    await prisma.project.create({
      data: {
        companyId,
        projectNumber: `SMP-${suffix}-02`,
        name: "Riverside Villa Design",
        clientId: clientB.id,
        managerId: owner.id,
        status: "ACTIVE",
        priority: "MEDIUM",
        siteAddress: "Riverside Plot 7",
        disciplines: ["ARCHITECTURE"],
        progressPct: 10,
        startDate: addDays(now, -10),
        targetEndDate: addDays(now, 200),
      },
    });
    report.projects++;
    return a;
  });

  // 3) A schedule for project A (phase tasks).
  if (projA && owner && clientA) {
    await step("schedule", async () => {
      await prisma.projectSchedule.create({
        data: {
          companyId,
          projectId: projA.id,
          projectNumber: projA.projectNumber,
          projectName: projA.name,
          client: clientA.name,
          manager: owner.name,
          tasks: {
            create: [
              { taskKey: "t1", name: "Concept Design", discipline: "Architecture", status: "in_progress", start: iso(addDays(now, -20)), end: iso(addDays(now, 10)), progressPct: 60, dependsOn: [] },
              { taskKey: "t2", name: "Schematic Design", discipline: "Architecture", status: "not_started", start: iso(addDays(now, 11)), end: iso(addDays(now, 45)), progressPct: 0, dependsOn: ["t1"] },
              { taskKey: "t3", name: "Detailed Design", discipline: "Architecture", status: "not_started", start: iso(addDays(now, 46)), end: iso(addDays(now, 90)), progressPct: 0, dependsOn: ["t2"] },
              { taskKey: "t4", name: "Tender Documentation", discipline: "Architecture", status: "not_started", start: iso(addDays(now, 91)), end: iso(addDays(now, 120)), progressPct: 0, dependsOn: ["t3"] },
            ],
          },
        },
      });
      report.schedules++;
    });

    // 4) An estimate for project A (one section + a couple lines).
    await step("estimate", async () => {
      await prisma.costEstimate.create({
        data: {
          // A project's estimate is keyed by the project's own id: that is how the
          // project page and the estimates adapter find it (lib/data/estimates.ts).
          id: projA.id,
          companyId,
          projectId: projA.id,
          projectNumber: projA.projectNumber,
          projectName: projA.name,
          client: clientA.name,
          location: "12 Business Bay",
          version: "V1.0",
          date: now,
          status: "DRAFT",
          avgLaborRate: 45,
          profitPct: 24,
          bboPct: 7,
          amount: 0,
          categories: {
            create: [
              {
                name: "Section 1 — Preliminaries",
                code: "1",
                sortOrder: 0,
                items: {
                  create: [
                    { task: "Site setup & mobilisation", qty: 1, unit: "LS", laborNorm: 0, materialUnitCost: 5000, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, sortOrder: 0 },
                    { task: "Demolition & strip-out", qty: 250, unit: "m²", laborNorm: 0.5, materialUnitCost: 0, equipmentUnitCost: 8, subcontractUnitCost: 0, poc: 0, sortOrder: 1 },
                  ],
                },
              },
            ],
          },
        },
      });
      report.estimates++;
    });
  }

  // 5) Proposals (need a client + owner). Skip if any exist.
  await step("proposals", async () => {
    if (!owner || !clientA) return;
    if ((await prisma.proposal.count({ where: { companyId } })) > 0) return;
    await prisma.proposal.create({
      data: {
        companyId,
        refNumber: `PRP-${suffix}-01`,
        title: "Acme HQ — Full Design Services",
        clientId: clientA.id,
        ownerId: owner.id,
        status: "DRAFT",
        totalFee: 85000,
        scopeSummary: "Concept through construction documentation for the HQ renovation.",
      },
    });
    report.proposals++;
    await prisma.proposal.create({
      data: {
        companyId,
        refNumber: `PRP-${suffix}-02`,
        title: "Riverside Villa — Concept Proposal",
        clientId: clientB.id,
        ownerId: owner.id,
        status: "SENT",
        totalFee: 42000,
        scopeSummary: "Concept design package for the Riverside villa.",
        sentAt: new Date(),
      },
    });
    report.proposals++;
  });

  // 6) Tasks — skip if any exist.
  await step("tasks", async () => {
    if ((await prisma.task.count({ where: { companyId } })) > 0) return;
    const made = await prisma.task.createMany({
      data: [
        { companyId, title: "Welcome — this is your company workspace", status: "TODO", priority: "MEDIUM" },
        { companyId, title: "Add your first real client", status: "TODO", priority: "HIGH" },
        { companyId, title: "Review the sample estimate", status: "IN_PROGRESS", priority: "MEDIUM" },
        { companyId, title: "Explore the Schedule Gantt", status: "TODO", priority: "LOW" },
      ],
    });
    report.tasks += made.count;
  });

  return report;
}
