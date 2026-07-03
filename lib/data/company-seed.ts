/**
 * Seeds a company with a little sample data so its modules aren't empty on first
 * login — clients, projects, proposals, a schedule, an estimate, and tasks. Every
 * row carries the company's id explicitly (the tenant extension only auto-fills
 * companyId when it's omitted, and seeding runs pre-session at signup).
 *
 * Idempotent: each entity type is skipped if the company already has some, so it
 * can safely enrich a company that was previously seeded with only clients/tasks.
 * Best-effort — never throws (never blocks signup). SERVER-ONLY.
 */
import { prisma } from "@/lib/db";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

export async function seedCompany(companyId: string): Promise<void> {
  try {
    const suffix = companyId.slice(-5).toUpperCase();
    const owner = await prisma.user.findFirst({ where: { companyId }, select: { id: true, name: true } });

    // 1) Clients — reuse if already seeded, else create three.
    let clients = await prisma.client.findMany({ where: { companyId }, select: { id: true, name: true }, take: 3 });
    if (clients.length === 0) {
      await prisma.client.createMany({
        data: [
          { companyId, name: "Acme Development", companyName: "Acme Development LLC", type: "DEVELOPER", status: "ACTIVE", contactPerson: "Sample Contact", email: "contact@acme.example" },
          { companyId, name: "City Housing Authority", companyName: "City Housing Authority", type: "GOVERNMENT", status: "ACTIVE" },
          { companyId, name: "Riverside Villa", type: "PRIVATE", status: "PROSPECT" },
        ],
      });
      clients = await prisma.client.findMany({ where: { companyId }, select: { id: true, name: true }, take: 3 });
    }
    const clientA = clients[0];
    const clientB = clients[1] ?? clients[0];

    // 2) Projects (need a client + a manager). Skip if any exist.
    const projectCount = await prisma.project.count({ where: { companyId } });
    if (owner && clientA && projectCount === 0) {
      const now = new Date();
      const projA = await prisma.project.create({
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
      const projB = await prisma.project.create({
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

      // 3) A schedule for project A (phase tasks).
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

      // 4) An estimate for project A (one section + a couple lines).
      await prisma.costEstimate.create({
        data: {
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
      void projB;
    }

    // 5) Proposals (need a client + owner). Skip if any exist.
    const proposalCount = await prisma.proposal.count({ where: { companyId } });
    if (owner && clientA && proposalCount === 0) {
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
    }

    // 6) Tasks — skip if any exist.
    const taskCount = await prisma.task.count({ where: { companyId } });
    if (taskCount === 0) {
      await prisma.task.createMany({
        data: [
          { companyId, title: "Welcome — this is your company workspace", status: "TODO", priority: "MEDIUM" },
          { companyId, title: "Add your first real client", status: "TODO", priority: "HIGH" },
          { companyId, title: "Review the sample estimate", status: "IN_PROGRESS", priority: "MEDIUM" },
          { companyId, title: "Explore the Schedule Gantt", status: "TODO", priority: "LOW" },
        ],
      });
    }
  } catch (e) {
    console.error("[company-seed] failed for", companyId, e);
  }
}
