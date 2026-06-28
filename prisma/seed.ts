/**
 * Database seed — core business tables + Construction-Admin module.
 *
 * Seeds the CORE practice-management tables from the static dataset in
 * ./core-seed-data.ts (the data layers now READ from the DB, so seeding from
 * them would be circular). Ids are stable, human-readable PRIMARY KEYS so other
 * code can map/query against them:
 *   User.id      = team slug          (e.g. "greg")
 *   Client.id    = client slug        (e.g. "emaar")
 *   Proposal.id  = refNumber          (e.g. "PRO-2026-031")
 *   Order.id     = orderNumber        (e.g. "ORD-2026-031")
 *   Project.id   = projectNumber      (e.g. "ZA-2026-014")
 * Child rows whose placeholder ids repeat across parents are prefixed with the
 * parent id to stay globally unique:
 *   ClientAddress.id    = `${clientId}-addr-${i}`
 *   ProposalLineItem.id = `${proposalId}-${liId}`   (e.g. "PRO-2026-031-li1")
 *   ProposalMilestone.id= `${proposalId}-${mId}`    (e.g. "PRO-2026-031-m1")
 *   ProjectPhase.id     = `${projectNumber}-${phaseId}` (e.g. "ZA-2026-014-concept")
 *   PhaseAssignment      keyed on @@unique([phaseId, userId])
 *
 * Everything is idempotent (upserts keyed on the id / business key), so the seed
 * is safe to re-run. FK-safe order is preserved. The original Construction-Admin
 * seed (from lib/ca/seed-data.ts) is kept and appended after the core seed.
 *
 * Run: npm run db:seed   (ts-node + tsconfig-paths via prisma.config.ts)
 */
import { prisma } from "@/lib/db";
import { USERS, CLIENTS, PROPOSALS, ORDERS, PROJECTS, LEAVE } from "./core-seed-data";
import {
  SEED_CHANGE_ORDERS,
  SEED_RFIS,
  SEED_REPORTS,
  SEED_CERTIFICATIONS,
  SEED_PUNCH_ITEMS,
  SEED_SITE_INSTRUCTIONS,
  SEED_SUBMITTALS,
  SEED_DELAY_NOTICES,
} from "@/lib/ca/seed-data";
import { SEED_DEVELOPMENT } from "@/lib/development/seed-data";
import { SEED_ESTIMATES } from "@/lib/estimates/seed-data";
import { STATUS_TO_DB } from "@/lib/data/estimates";
import { ALL_MATERIALS, EQUIPMENT_PRICES } from "@/lib/data/price-lists.types";
import { NORM_SET_SEEDED, ESTIMATE_TEMPLATES } from "@/lib/data/estimate-presets";
import { WIKI } from "@/lib/data/estimating-wiki";
import { GENERAL_CONDITIONS_SEED } from "@/lib/data/general-conditions";

/** Parse an optional ISO date string → Date | null. */
const d = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);
/** Parse a required ISO date string → Date. */
const dReq = (s: string): Date => new Date(s);

/**
 * Public holidays — replicated inline because lib/data/leave.ts only exposes a
 * date-filtered getter (getUpcomingHolidays), but the seed needs the full set.
 * Values mirror the HOLIDAYS array in lib/data/leave.ts exactly.
 */
const HOLIDAYS = [
  { id: "h1", name: "Islamic New Year", date: "2026-06-17", isCompany: false },
  { id: "h2", name: "Prophet's Birthday", date: "2026-08-25", isCompany: false },
  { id: "h3", name: "ZenArch Founders Day", date: "2026-09-15", isCompany: true },
  { id: "h4", name: "Commemoration Day", date: "2026-12-01", isCompany: false },
  { id: "h5", name: "UAE National Day", date: "2026-12-02", isCompany: false },
  { id: "h6", name: "UAE National Day (Holiday)", date: "2026-12-03", isCompany: false },
];

async function main() {
  // ── 1. Users (id = team slug) ────────────────────────────────────────────
  const team = USERS;
  const NAME_TO_USER_ID: Record<string, string> = {};
  for (const base of team) {
    NAME_TO_USER_ID[base.name] = base.id;
    const m = base;
    const data = {
      email: m.email,
      passwordHash: null,
      name: m.name,
      phone: m.phone ?? null,
      role: m.role,
      discipline: m.discipline ?? null,
      department: m.department,
      status: m.status,
      capacity: m.capacity,
      utilisation: m.utilisation,
      bio: m.bio ?? null,
      skills: m.skills ?? [],
      annualLeaveTotal: m.annualLeaveTotal ?? 22,
      annualLeaveTaken: m.annualLeaveTaken ?? 0,
      officeLocation: m.officeLocation ?? null,
      joiningDate: d(m.joiningDate),
    };
    await prisma.user.upsert({
      where: { id: m.id },
      // On re-seed, leave passwordHash untouched (undefined = "don't change") so
      // dev login passwords set out-of-band survive a re-seed; create still sets it.
      update: { ...data, passwordHash: undefined },
      create: { id: m.id, ...data },
    });
  }

  // ── 2. Clients (id = client slug) + 3. ClientAddresses ───────────────────
  const clientList = CLIENTS;
  const NAME_TO_CLIENT_ID: Record<string, string> = {};
  for (const lite of clientList) {
    const c = lite;
    NAME_TO_CLIENT_ID[c.name] = c.id;
    const data = {
      name: c.name,
      companyName: c.companyName ?? null,
      contactPerson: c.contactPerson ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      website: c.website ?? null,
      taxNumber: c.taxNumber ?? null,
      type: c.type,
      status: c.status,
      notes: c.notes ?? null,
      tags: c.tags ?? [],
      createdAt: d(c.createdAt) ?? undefined,
    };
    await prisma.client.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } });

    for (let i = 0; i < c.addresses.length; i++) {
      const a = c.addresses[i];
      const addrId = `${c.id}-addr-${i}`;
      const adata = {
        clientId: c.id,
        label: a.label,
        line1: a.line1,
        city: a.city ?? null,
        emirate: a.emirate ?? null,
        country: a.country ?? "UAE",
        isPrimary: a.isPrimary ?? false,
      };
      await prisma.clientAddress.upsert({ where: { id: addrId }, update: adata, create: { id: addrId, ...adata } });
    }
  }

  // ── 4. Proposals (id = refNumber) + 5. line items + 6. milestones ────────
  const proposals = PROPOSALS;
  const proposalIds = new Set<string>();
  for (const p of proposals) {
    proposalIds.add(p.refNumber);
    const ownerId = NAME_TO_USER_ID[p.owner];
    const data = {
      refNumber: p.refNumber,
      title: p.title,
      clientId: p.clientId || NAME_TO_CLIENT_ID[p.clientName],
      ownerId,
      status: p.status,
      revision: p.revision,
      currency: p.currency,
      totalFee: p.totalFee,
      scopeSummary: p.scopeSummary ?? null,
      exclusions: p.exclusions ?? null,
      assumptions: p.assumptions ?? null,
      terms: p.terms ?? null,
      estimatedDuration: p.estimatedDuration ?? null,
      sentAt: d(p.sentAt),
      approvedAt: d(p.approvedAt),
      followUpDate: d(p.followUpDate),
      lastContactDate: d(p.lastContactDate),
      followUpNotes: p.followUpNotes ?? null,
      nextAction: p.nextAction ?? null,
      validUntil: d(p.validUntil),
      createdAt: d(p.createdAt) ?? undefined,
    };
    await prisma.proposal.upsert({ where: { id: p.refNumber }, update: data, create: { id: p.refNumber, ...data } });

    for (const li of p.lineItems) {
      const liId = `${p.refNumber}-${li.id}`;
      const lidata = {
        proposalId: p.refNumber,
        description: li.description,
        discipline: li.discipline ?? null,
        amount: li.amount,
        isOptional: li.isOptional,
        sortOrder: li.sortOrder,
      };
      await prisma.proposalLineItem.upsert({ where: { id: liId }, update: lidata, create: { id: liId, ...lidata } });
    }

    for (const ms of p.milestones) {
      const msId = `${p.refNumber}-${ms.id}`;
      const msdata = {
        proposalId: p.refNumber,
        name: ms.name,
        percentage: ms.percentage,
        dueWeek: ms.dueWeek ?? null,
      };
      await prisma.proposalMilestone.upsert({ where: { id: msId }, update: msdata, create: { id: msId, ...msdata } });
    }
  }

  // ── 7. Orders (id = orderNumber) ─────────────────────────────────────────
  const orderList = ORDERS;
  const projectToOrder: Record<string, string> = {}; // projectNumber → orderNumber
  for (const lite of orderList) {
    const o = lite;
    if (o.projectId) projectToOrder[o.projectId] = o.orderNumber;
    // Only link a proposal that actually exists as a row (FK + @unique safe).
    const proposalId = o.proposalRef && proposalIds.has(o.proposalRef) ? o.proposalRef : null;
    const data = {
      orderNumber: o.orderNumber,
      clientId: NAME_TO_CLIENT_ID[o.clientName],
      proposalId,
      title: o.title,
      serviceType: o.serviceType,
      status: o.status,
      fee: o.fee,
      currency: o.currency,
      scopeSummary: o.scopeSummary ?? null,
      siteAddress: o.siteAddress ?? null,
      expectedStartDate: d(o.expectedStartDate),
      expectedEndDate: d(o.expectedEndDate),
      notes: o.notes ?? null,
      createdAt: d(o.createdAt) ?? undefined,
    };
    await prisma.order.upsert({ where: { id: o.orderNumber }, update: data, create: { id: o.orderNumber, ...data } });
  }

  // ── 8. Projects (id = projectNumber) + 9. phases + 10. phase assignments ─
  const projectList = PROJECTS;
  for (const lite of projectList) {
    const p = lite;
    const orderId = projectToOrder[p.projectNumber] ?? null;
    const data = {
      projectNumber: p.projectNumber,
      name: p.name,
      clientId: p.clientId,
      orderId,
      managerId: NAME_TO_USER_ID[p.manager],
      status: p.status,
      priority: p.priority,
      description: p.description ?? null,
      siteAddress: p.siteAddress ?? null,
      disciplines: p.disciplines,
      startDate: d(p.startDate),
      targetEndDate: d(p.targetEndDate),
      completedAt: d(p.completedAt),
      progressPct: p.progressPct,
      contractValue: p.value,
      currency: p.currency,
    };
    await prisma.project.upsert({ where: { id: p.projectNumber }, update: data, create: { id: p.projectNumber, ...data } });

    // 6 phases, id = `${projectNumber}-${phaseId}`, sortOrder = array index.
    for (let i = 0; i < p.phases.length; i++) {
      const ph = p.phases[i];
      const phaseId = `${p.projectNumber}-${ph.id}`;
      const phdata = {
        projectId: p.projectNumber,
        name: ph.name,
        discipline: ph.discipline ?? null,
        status: ph.status,
        progressPct: ph.progressPct,
        sortOrder: i,
      };
      await prisma.projectPhase.upsert({ where: { id: phaseId }, update: phdata, create: { id: phaseId, ...phdata } });
    }

    // Assign each team member to the project's FIRST (concept) phase.
    const conceptPhaseId = `${p.projectNumber}-concept`;
    for (const member of p.team) {
      const userId = NAME_TO_USER_ID[member.name];
      if (!userId) continue;
      await prisma.phaseAssignment.upsert({
        where: { phaseId_userId: { phaseId: conceptPhaseId, userId } },
        update: { roleName: member.role },
        create: { phaseId: conceptPhaseId, userId, roleName: member.role },
      });
    }
  }

  // ── 11. Leave requests (id = source lr id) ───────────────────────────────
  const leave = LEAVE;
  for (const lr of leave) {
    const data = {
      userId: lr.userId,
      type: lr.type,
      status: lr.status,
      startDate: dReq(lr.startDate),
      endDate: dReq(lr.endDate),
      days: lr.days,
      reason: lr.reason ?? null,
      approvedBy: lr.approvedBy ?? null,
    };
    await prisma.leaveRequest.upsert({ where: { id: lr.id }, update: data, create: { id: lr.id, ...data } });
  }

  // ── 12. Public holidays (id = source holiday id) ─────────────────────────
  for (const h of HOLIDAYS) {
    const data = { name: h.name, date: dReq(h.date), country: "UAE", isCompany: h.isCompany };
    await prisma.publicHoliday.upsert({ where: { id: h.id }, update: data, create: { id: h.id, ...data } });
  }

  // ── 13. Notifications (topbar feed for the director) ─────────────────────
  const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);
  const NOTIFICATIONS = [
    { id: "ntf-seed-1", userId: "greg", title: "Proposal approved", body: "DCT Abu Dhabi approved PRO-2026-031 · Marina Heights Tower — Phase 2.", link: "/proposals/PRO-2026-031", isRead: false, createdAt: minsAgo(25) },
    { id: "ntf-seed-2", userId: "greg", title: "Follow-up due", body: "Call Nakheel about PRO-2026-041 · Palm Beach Towers — Amenity Deck.", link: "/proposals", isRead: false, createdAt: minsAgo(120) },
    { id: "ntf-seed-3", userId: "greg", title: "Phase completed", body: "Schematic Design completed on Marina Heights Tower — Phase 2.", link: "/projects/ZA-2026-014", isRead: false, createdAt: minsAgo(300) },
    { id: "ntf-seed-4", userId: "greg", title: "Leave request", body: "Sara Khan requested 6 days annual leave (5–12 Jul).", link: "/leave", isRead: true, createdAt: minsAgo(1440) },
    { id: "ntf-seed-5", userId: "greg", title: "Order confirmed", body: "Order ORD-2026-031 confirmed for delivery.", link: "/orders/ORD-2026-031", isRead: true, createdAt: minsAgo(2880) },
  ];
  for (const n of NOTIFICATIONS) {
    const { id, ...data } = n;
    await prisma.notification.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ── 14. Meeting Minutes + Action Items ───────────────────────────────────
  const dDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const MEETINGS = [
    {
      id: "mtg-1",
      projectId: "ZA-2026-014",
      authorId: "greg",
      title: "Marina Heights Tower — Client Review #3",
      type: "CLIENT" as const,
      meetingDate: dDate("2026-06-10"),
      location: "Client offices, Dubai Marina",
      participants: ["Greg Lacle", "Sara Khan", "Client — Nakheel rep"],
      summary: "Reviewed Phase 2 schematic package and confirmed façade direction.",
      discussion:
        "Walked the client through the revised massing and façade options. Client preferred Option B with the unitised glazing system. Discussed lift-lobby finishes and amenity-deck programme.",
      decisions: "Proceed with façade Option B. Amenity deck to include pool and gym.",
      followUpDate: dDate("2026-06-24"),
      actions: [
        { id: "ai-1", assigneeId: "sara", description: "Issue revised façade drawings (Option B)", dueDate: dDate("2026-06-18"), status: "IN_PROGRESS" as const },
        { id: "ai-2", assigneeId: "lina", description: "Cost the unitised glazing system", dueDate: dDate("2026-06-20"), status: "OPEN" as const },
      ],
    },
    {
      id: "mtg-2",
      projectId: "ZA-2026-031",
      authorId: "omar",
      title: "Al Quoz Community Centre — Authority Coordination",
      type: "AUTHORITY" as const,
      meetingDate: dDate("2026-06-05"),
      location: "Dubai Municipality",
      participants: ["Omar Haddad", "Raj Patel", "DM plan-check officer"],
      summary: "Pre-submission coordination on accessibility and fire strategy.",
      discussion:
        "Authority confirmed the accessible-route strategy is acceptable. Fire-engineer report required before formal submission. Parking ratio queried.",
      decisions: "Submit fire strategy report with the building permit application.",
      followUpDate: dDate("2026-06-19"),
      actions: [
        { id: "ai-3", assigneeId: "raj", description: "Commission fire-engineering report", dueDate: dDate("2026-06-15"), status: "DONE" as const },
        { id: "ai-4", assigneeId: "omar", description: "Resolve parking-ratio query with DM", dueDate: dDate("2026-06-22"), status: "OPEN" as const },
      ],
    },
    {
      id: "mtg-3",
      projectId: "ZA-2026-009",
      authorId: "lina",
      title: "Yas Bay Plot 4 — Internal Design Coordination",
      type: "INTERNAL" as const,
      meetingDate: dDate("2026-06-12"),
      location: "ZenArch studio",
      participants: ["Lina Verhoeven", "Maya Santos", "Greg Lacle"],
      summary: "Internal coordination across architecture, structure, and MEP.",
      discussion:
        "Reviewed clashes from the latest federated model. Structural transfer beam conflicts with MEP riser on level 3. Agreed a coordination workshop next week.",
      decisions: "Relocate MEP riser; structure to hold the transfer beam.",
      followUpDate: dDate("2026-06-26"),
      actions: [
        { id: "ai-5", assigneeId: "maya", description: "Reroute level-3 MEP riser and reissue", dueDate: dDate("2026-06-23"), status: "IN_PROGRESS" as const },
      ],
    },
  ];
  for (const m of MEETINGS) {
    const { id, actions, ...data } = m;
    await prisma.meetingMinute.upsert({ where: { id }, update: data, create: { id, ...data } });
    for (const a of actions) {
      const { id: aid, ...adata } = a;
      const aFull = { ...adata, meetingId: id };
      await prisma.actionItem.upsert({ where: { id: aid }, update: aFull, create: { id: aid, ...aFull } });
    }
  }

  // ── 15. Activity Log (practice-wide feed) ────────────────────────────────
  const ACTIVITY: {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    clientId?: string;
    meta?: object;
  }[] = [
    { id: "act-1", userId: "greg", action: "approved", entityType: "proposal", entityId: "PRO-2026-031", clientId: "emaar", meta: { label: "Marina Heights Tower — Phase 2" } },
    { id: "act-2", userId: "sara", action: "updated", entityType: "proposal", entityId: "PRO-2026-031", clientId: "emaar", meta: { label: "Marina Heights Tower — Phase 2" } },
    { id: "act-3", userId: "lina", action: "created", entityType: "project", entityId: "ZA-2026-014", projectId: "ZA-2026-014" },
    { id: "act-4", userId: "omar", action: "updated", entityType: "project", entityId: "ZA-2026-014", projectId: "ZA-2026-014" },
    { id: "act-5", userId: "raj", action: "created", entityType: "meeting", entityId: "mtg-1", projectId: "ZA-2026-014", meta: { label: "Marina Heights Tower — Phase 2 Design Review" } },
    { id: "act-6", userId: "maya", action: "updated", entityType: "client", entityId: "emaar", clientId: "emaar" },
    { id: "act-7", userId: "greg", action: "confirmed", entityType: "order", entityId: "ORD-2026-031", meta: { label: "ORD-2026-031" } },
    { id: "act-8", userId: "sara", action: "created", entityType: "proposal", entityId: "PRO-2026-031", clientId: "emaar", meta: { label: "Marina Heights Tower — Phase 2" } },
  ];
  for (let i = 0; i < ACTIVITY.length; i++) {
    const { id, meta, ...rest } = ACTIVITY[i];
    const data = {
      ...rest,
      meta: meta == null ? undefined : (meta as object),
      createdAt: new Date(Date.now() - (i + 1) * 60_000),
    };
    await prisma.activityLog.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  console.log("Core business seed complete.");

  // ───────────────────────────────────────────────────────────────────────
  // Construction Administration module seed (preserved from the original seed)
  // ───────────────────────────────────────────────────────────────────────
  for (const c of SEED_CHANGE_ORDERS) {
    await prisma.changeOrder.upsert({
      where: { changeOrderNumber: c.changeOrderNumber },
      update: {},
      create: {
        projectId: c.projectId,
        projectName: c.projectName,
        changeOrderNumber: c.changeOrderNumber,
        version: c.version,
        title: c.title,
        description: c.description,
        reason: c.reason,
        requestedBy: c.requestedBy,
        contractorId: c.contractor,
        architectId: c.architect,
        engineerId: c.engineer,
        ownerId: c.owner,
        status: c.status,
        currency: c.currency,
        costLabor: c.costLabor,
        costMaterial: c.costMaterial,
        costEquipment: c.costEquipment,
        costSubcontractor: c.costSubcontractor,
        overheadPercentage: c.overheadPercentage,
        profitPercentage: c.profitPercentage,
        contingencyPercentage: c.contingencyPercentage,
        vatPercentage: c.vatPercentage,
        totalCost: c.totalCost,
        scheduleImpactDays: c.scheduleImpactDays,
        originalContractValue: c.originalContractValue,
        approvedChangeOrdersToDate: c.approvedChangeOrdersToDate,
        revisedContractValue: c.revisedContractValue,
        estimateLineItemId: c.estimateLineItemId,
        dateRequested: d(c.dateRequested),
        dateSubmitted: d(c.dateSubmitted),
        dateApproved: d(c.dateApproved),
        notes: c.notes,
      },
    });
  }

  for (const r of SEED_RFIS) {
    await prisma.rfiLog.upsert({
      where: { rfiNumber: r.rfiNumber },
      update: {},
      create: {
        projectId: r.projectId,
        projectName: r.projectName,
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
        dateSubmitted: d(r.dateSubmitted),
        dateRequired: d(r.dateRequired),
        dateResponded: d(r.dateResponded),
        linkedChangeOrderId: r.linkedChangeOrderId,
      },
    });
  }

  for (const r of SEED_REPORTS) {
    await prisma.caReport.upsert({
      where: { reportNumber: r.reportNumber },
      update: {},
      create: {
        projectId: r.projectId,
        projectName: r.projectName,
        reportType: r.reportType,
        reportNumber: r.reportNumber,
        version: r.version,
        reportingPeriodStart: d(r.reportingPeriodStart),
        reportingPeriodEnd: d(r.reportingPeriodEnd),
        preparedBy: r.preparedBy,
        reviewedBy: r.reviewedBy,
        approvedBy: r.approvedBy,
        status: r.status,
        weatherSummary: r.weatherSummary,
        siteConditions: r.siteConditions,
        workCompleted: r.workCompleted,
        workPlannedNextPeriod: r.workPlannedNextPeriod,
        manpowerSummary: r.manpowerSummary,
        materialDeliveries: r.materialDeliveries,
        safetyIncidents: r.safetyIncidents,
        qualityIssues: r.qualityIssues,
        delays: r.delays,
        risks: r.risks,
        notes: r.notes,
      },
    });
  }

  for (const c of SEED_CERTIFICATIONS) {
    await prisma.progressCertification.upsert({
      where: { certificationNumber: c.certificationNumber },
      update: {},
      create: {
        projectId: c.projectId,
        projectName: c.projectName,
        certificationNumber: c.certificationNumber,
        version: c.version,
        inspectionDate: d(c.inspectionDate),
        certifiedBy: c.certifiedBy,
        lenderName: c.lenderName,
        contractorName: c.contractorName,
        contractValue: c.contractValue,
        currency: c.currency,
        previousPercentComplete: c.previousPercentComplete,
        currentPercentComplete: c.currentPercentComplete,
        workCompletedValue: c.workCompletedValue,
        retentionPercentage: c.retentionPercentage,
        retentionAmount: c.retentionAmount,
        previousPaymentsValue: c.previousPaymentsValue,
        amountRecommendedForPayment: c.amountRecommendedForPayment,
        deficiencies: c.deficiencies,
        recommendation: c.recommendation,
        status: c.status,
      },
    });
  }

  for (const p of SEED_PUNCH_ITEMS) {
    await prisma.punchListItem.upsert({
      where: { itemNumber: p.itemNumber },
      update: {},
      create: {
        projectId: p.projectId,
        projectName: p.projectName,
        itemNumber: p.itemNumber,
        location: p.location,
        description: p.description,
        trade: p.trade,
        responsibleParty: p.responsibleParty,
        priority: p.priority,
        status: p.status,
        dateIdentified: d(p.dateIdentified),
        dueDate: d(p.dueDate),
        dateCompleted: d(p.dateCompleted),
        verifiedBy: p.verifiedBy,
        notes: p.notes,
      },
    });
  }

  for (const s of SEED_SITE_INSTRUCTIONS) {
    await prisma.siteInstruction.upsert({
      where: { instructionNumber: s.instructionNumber },
      update: {},
      create: {
        projectId: s.projectId,
        projectName: s.projectName,
        instructionNumber: s.instructionNumber,
        title: s.title,
        description: s.description,
        issuedBy: s.issuedBy,
        issuedTo: s.issuedTo,
        discipline: s.discipline,
        costImpact: s.costImpact,
        scheduleImpact: s.scheduleImpact,
        linkedChangeOrderId: s.linkedChangeOrderId,
        status: s.status,
        dateIssued: d(s.dateIssued),
      },
    });
  }

  for (const s of SEED_SUBMITTALS) {
    await prisma.submittalLog.upsert({
      where: { submittalNumber: s.submittalNumber },
      update: {},
      create: {
        projectId: s.projectId,
        projectName: s.projectName,
        submittalNumber: s.submittalNumber,
        title: s.title,
        description: s.description,
        submittedBy: s.submittedBy,
        reviewedBy: s.reviewedBy,
        discipline: s.discipline,
        status: s.status,
        dateRequired: d(s.dateRequired),
        dateSubmitted: d(s.dateSubmitted),
        dateReviewed: d(s.dateReviewed),
        reviewerComments: s.reviewerComments,
      },
    });
  }

  for (const dn of SEED_DELAY_NOTICES) {
    await prisma.delayNotice.upsert({
      where: { delayNoticeNumber: dn.delayNoticeNumber },
      update: {},
      create: {
        projectId: dn.projectId,
        projectName: dn.projectName,
        delayNoticeNumber: dn.delayNoticeNumber,
        title: dn.title,
        description: dn.description,
        cause: dn.cause,
        responsibleParty: dn.responsibleParty,
        claimedDays: dn.claimedDays,
        approvedDays: dn.approvedDays,
        costImpact: dn.costImpact,
        status: dn.status,
        dateStarted: d(dn.dateStarted),
        dateResolved: d(dn.dateResolved),
      },
    });
  }

  console.log("Construction Admin seed complete.");

  // ── Land Development / Parceling (Morgenster demo) ───────────────────────
  const dev = SEED_DEVELOPMENT;
  {
    const p = dev.project;
    const pdata = {
      projectNumber: p.projectNumber, name: p.name, location: p.location, clientOwner: p.clientOwner,
      developer: p.developer, status: p.status, currency: p.currency, totalParcelArea: p.totalParcelArea,
      zoningClassification: p.zoningClassification, ropvArticleRef: p.ropvArticleRef, propertyType: p.propertyType,
      projectType: p.projectType, startDate: d(p.startDate), targetPermitDate: d(p.targetPermitDate),
      targetInfraDate: d(p.targetInfraDate), targetSalesLaunchDate: d(p.targetSalesLaunchDate),
      targetCloseoutDate: d(p.targetCloseoutDate),
    };
    await prisma.developmentProject.upsert({ where: { id: p.id }, update: pdata, create: { id: p.id, ...pdata } });

    const { id: acqId, ...acq } = dev.acquisition;
    await prisma.landAcquisition.upsert({ where: { projectId: acq.projectId }, update: acq, create: { id: acqId, ...acq } });

    const { id: landId, ...land } = dev.landUse;
    await prisma.landUseAllocation.upsert({ where: { projectId: land.projectId }, update: land, create: { id: landId, ...land } });

    for (const l of dev.lots) {
      const { id, reservationDate, agreementDate, closingDate, ...rest } = l;
      const data = { ...rest, reservationDate: d(reservationDate), agreementDate: d(agreementDate), closingDate: d(closingDate) };
      await prisma.lotInventory.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const ut of dev.unitTypes) {
      await prisma.unitType.upsert({
        where: { id: ut.id },
        update: { projectId: ut.projectId, name: ut.name, quantity: ut.quantity },
        create: { id: ut.id, projectId: ut.projectId, name: ut.name, quantity: ut.quantity },
      });
      for (const c of ut.components) {
        const { id, ...cdata } = c;
        await prisma.unitCostComponent.upsert({ where: { id }, update: cdata, create: { id, ...cdata } });
      }
    }

    for (const b of dev.budget) {
      const { id, ...data } = b;
      await prisma.infrastructureBudget.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const t of dev.permits) {
      const { id, startDate, dueDate, completedDate, ...rest } = t;
      const data = { ...rest, startDate: d(startDate), dueDate: d(dueDate), completedDate: d(completedDate) };
      await prisma.permitTask.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const ld of dev.leads) {
      const { id, followUpDate, ...rest } = ld;
      const data = { ...rest, followUpDate: d(followUpDate) };
      await prisma.salesLead.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const cf of dev.cashFlow) {
      const { id, ...data } = cf;
      await prisma.cashFlowMonth.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const sc of dev.scenarios) {
      const { id, ...data } = sc;
      await prisma.devScenario.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    for (const doc of dev.documents) {
      const { id, uploadedAt, ...rest } = doc;
      const data = { ...rest, uploadedAt: dReq(uploadedAt) };
      await prisma.devDocument.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const v of dev.vendors) {
      const { id, ...data } = v;
      await prisma.vendor.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const c of dev.contracts) {
      const { id, startDate, endDate, ...rest } = c;
      const data = { ...rest, startDate: d(startDate), endDate: d(endDate) };
      await prisma.devContract.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const iv of dev.invoices) {
      const { id, dateIssued, dateDue, ...rest } = iv;
      const data = { ...rest, dateIssued: d(dateIssued), dateDue: d(dateDue) };
      await prisma.devInvoice.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const p of dev.payments) {
      const { id, datePaid, ...rest } = p;
      const data = { ...rest, datePaid: d(datePaid) };
      await prisma.devPayment.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const r of dev.reservations) {
      const { id, reservationDate, expiryDate, ...rest } = r;
      const data = { ...rest, reservationDate: d(reservationDate), expiryDate: d(expiryDate) };
      await prisma.buyerReservation.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
    for (const c of dev.salesContracts) {
      const { id, signedDate, closingDate, ...rest } = c;
      const data = { ...rest, signedDate: d(signedDate), closingDate: d(closingDate) };
      await prisma.salesContract.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }
  console.log("Land Development seed complete.");

  // ───────────────────────────────────────────────────────────────────────
  // Cost-Estimation seed (BOQ estimates). Idempotent: `update: {}` so re-runs
  // don't duplicate the nested categories/items.
  // ───────────────────────────────────────────────────────────────────────
  for (const e of SEED_ESTIMATES) {
    await prisma.costEstimate.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        projectId: e.projectId,
        projectNumber: e.projectNumber ?? null,
        projectName: e.projectName,
        client: e.client ?? null,
        location: e.location || null,
        version: e.version,
        date: e.date ? dReq(e.date) : null,
        currency: e.currency,
        avgLaborRate: e.avgLaborRate,
        profitPct: e.profitPct,
        bboPct: e.bboPct,
        gfa: e.gfa ?? null,
        status: STATUS_TO_DB[e.status ?? "draft"],
        amount: e.amount,
        categories: {
          create: e.categories.map((c, ci) => ({
            name: c.name,
            code: c.code ?? null,
            sortOrder: ci,
            items: {
              create: c.items.map((it, ii) => ({
                task: it.task,
                qty: it.qty,
                unit: it.unit,
                laborNorm: it.laborNorm,
                materialUnitCost: it.materialUnitCost,
                equipmentUnitCost: it.equipmentUnitCost,
                subcontractUnitCost: it.subcontractUnitCost,
                poc: it.poc,
                code: it.code ?? null,
                sortOrder: ii,
              })),
            },
          })),
        },
      },
    });
  }
  // Price book (firm-wide reference). Upsert by id so re-runs don't clobber edits.
  const priceRows = [
    ...ALL_MATERIALS.map((m, i) => ({ item: m, kind: "MATERIAL" as const, sortOrder: i })),
    ...EQUIPMENT_PRICES.map((e, i) => ({ item: e, kind: "EQUIPMENT" as const, sortOrder: i })),
  ];
  for (const { item, kind, sortOrder } of priceRows) {
    const data = {
      kind,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      unitPrice: item.unitPrice,
      supplier: item.supplier ?? null,
      note: item.note ?? null,
      region: item.region ?? null,
      currency: item.currency ?? null,
      sortOrder,
    };
    await prisma.priceItem.upsert({ where: { id: item.id }, update: {}, create: { id: item.id, ...data } });
  }
  // Norm Set (firm-wide standard-task library). Upsert by id, idempotent.
  for (let i = 0; i < NORM_SET_SEEDED.length; i++) {
    const n = NORM_SET_SEEDED[i];
    const data = {
      trade: n.trade,
      task: n.task,
      unit: n.unit,
      laborNorm: n.laborNorm,
      materialUnitCost: n.materialUnitCost ?? null,
      equipmentUnitCost: n.equipmentUnitCost ?? null,
      subcontractUnitCost: n.subcontractUnitCost ?? null,
      code: n.code ?? null,
      sortOrder: i,
    };
    await prisma.normSetTask.upsert({ where: { id: n.id }, update: {}, create: { id: n.id, ...data } });
  }
  // General Conditions (firm-wide preliminaries template). Upsert by id, idempotent.
  for (let i = 0; i < GENERAL_CONDITIONS_SEED.length; i++) {
    const g = GENERAL_CONDITIONS_SEED[i];
    const data = { name: g.name, unit: g.unit, qty: g.qty, unitCost: g.unitCost, note: g.note ?? null, enabled: g.enabled, sortOrder: i };
    await prisma.generalConditionItem.upsert({ where: { id: g.id }, update: {}, create: { id: g.id, ...data } });
  }
  // Estimate templates (firm library). Upsert by dotted-handle id, idempotent.
  for (let i = 0; i < ESTIMATE_TEMPLATES.length; i++) {
    const t = ESTIMATE_TEMPLATES[i];
    await prisma.estimateTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: { id: t.id, name: t.name, description: t.description, categories: t.categories as object, sortOrder: i },
    });
  }
  // Estimating Wiki (knowledge base). Upsert by id, idempotent.
  for (let i = 0; i < WIKI.length; i++) {
    const w = WIKI[i];
    await prisma.wikiArticle.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id, title: w.title, category: w.category, tags: w.tags, summary: w.summary,
        facts: w.facts as object, body: w.body ?? null, illoKey: w.illoKey ?? null, image: w.image ?? null, sortOrder: i,
      },
    });
  }
  console.log("Cost-Estimation seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
