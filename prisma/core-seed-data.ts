/**
 * Static core seed data for the AEC suite practice-management tables.
 *
 * WHY THIS EXISTS: the core data layers (lib/data/{team,clients,proposals,
 * orders,projects,leave}.ts) were converted to read FROM the database, so the
 * old approach — seeding by reading those getters — became circular (read empty
 * DB → write nothing). This module is the single static source the seed upserts
 * from. Shapes carry only the fields prisma/seed.ts consumes.
 *
 * Referential integrity (all wired by business key, mirrored in seed.ts):
 *   - proposal.owner / project.manager / project.team[].name  → a USERS .name
 *   - proposal.clientId / project.clientId                    → a CLIENTS .id
 *   - order.clientName                                        → a CLIENTS .name
 *   - order.proposalRef                                       → a PROPOSALS .refNumber
 *   - order.projectId                                         → a PROJECTS .projectNumber
 *   - leave.userId                                            → a USERS .id
 *   - every project includes a phase with id "concept" (team is assigned to it)
 */

import type { $Enums } from "@prisma/client";

export type SeedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: $Enums.UserRole;
  discipline: $Enums.Discipline | null;
  department: $Enums.Department | null;
  status: $Enums.UserStatus;
  capacity: number;
  utilisation: number;
  bio: string | null;
  skills: string[];
  annualLeaveTotal: number;
  annualLeaveTaken: number;
  officeLocation: string | null;
  joiningDate: string | null;
};

export type SeedAddress = {
  label: string;
  line1: string;
  city?: string;
  emirate?: string;
  country: string;
  isPrimary?: boolean;
};

export type SeedClient = {
  id: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  type: $Enums.ClientType;
  status: $Enums.ClientStatus;
  notes: string | null;
  tags: string[];
  createdAt: string;
  addresses: SeedAddress[];
};

export type SeedLineItem = {
  id: string;
  description: string;
  discipline: $Enums.Discipline | null;
  amount: number;
  isOptional: boolean;
  sortOrder: number;
};

export type SeedMilestone = { id: string; name: string; percentage: number; dueWeek: number | null };

export type SeedProposal = {
  refNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  owner: string;
  status: $Enums.ProposalStatus;
  revision: number;
  currency: string;
  totalFee: number;
  scopeSummary: string | null;
  exclusions: string | null;
  assumptions: string | null;
  terms: string | null;
  estimatedDuration: number | null;
  sentAt: string | null;
  approvedAt: string | null;
  followUpDate: string | null;
  lastContactDate: string | null;
  followUpNotes: string | null;
  nextAction: string | null;
  validUntil: string | null;
  createdAt: string;
  lineItems: SeedLineItem[];
  milestones: SeedMilestone[];
};

export type SeedOrder = {
  orderNumber: string;
  clientName: string;
  proposalRef: string | null;
  projectId: string | null;
  title: string;
  serviceType: string;
  status: $Enums.OrderStatus;
  fee: number;
  currency: string;
  scopeSummary: string | null;
  siteAddress: string | null;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type SeedPhase = {
  id: string;
  name: string;
  discipline: $Enums.Discipline | null;
  status: $Enums.PhaseStatus;
  progressPct: number;
};

export type SeedProjectTeam = { name: string; role: string };

export type SeedProject = {
  projectNumber: string;
  name: string;
  clientId: string;
  manager: string;
  status: $Enums.ProjectStatus;
  priority: $Enums.Priority;
  description: string | null;
  siteAddress: string | null;
  disciplines: $Enums.Discipline[];
  startDate: string | null;
  targetEndDate: string | null;
  completedAt: string | null;
  progressPct: number;
  value: number;
  currency: string;
  phases: SeedPhase[];
  team: SeedProjectTeam[];
};

export type SeedLeave = {
  id: string;
  userId: string;
  type: $Enums.LeaveType;
  status: $Enums.LeaveStatus;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  approvedBy: string | null;
};

/* ─────────────────────────── Users ─────────────────────────── */

export const USERS: SeedUser[] = [
  { id: "greg", name: "Greg Lacle", email: "greg@zenarch.net", phone: "+971 50 123 4567", role: "DIRECTOR", discipline: "ARCHITECTURE", department: "MANAGEMENT", status: "ACTIVE", capacity: 100, utilisation: 70, bio: "Founding principal. Leads design direction and client relationships.", skills: ["Concept design", "Masterplanning", "Business development"], annualLeaveTotal: 25, annualLeaveTaken: 6, officeLocation: "Dubai", joiningDate: "2019-01-15" },
  { id: "sara", name: "Sara Khan", email: "sara@zenarch.net", phone: "+971 50 222 8842", role: "MANAGER", discipline: "STRUCTURAL", department: "ENGINEERING", status: "ACTIVE", capacity: 100, utilisation: 85, bio: "Structural lead. Reinforced concrete and high-rise experience.", skills: ["RC design", "Seismic", "ETABS"], annualLeaveTotal: 22, annualLeaveTaken: 4, officeLocation: "Dubai", joiningDate: "2020-03-02" },
  { id: "omar", name: "Omar Haddad", email: "omar@zenarch.net", phone: "+971 55 901 7733", role: "STAFF", discipline: "ARCHITECTURE", department: "DESIGN", status: "ACTIVE", capacity: 100, utilisation: 90, bio: "Project architect focused on documentation and authority submissions.", skills: ["Revit", "Authority approvals", "Detailing"], annualLeaveTotal: 22, annualLeaveTaken: 9, officeLocation: "Dubai", joiningDate: "2021-06-20" },
  { id: "lina", name: "Lina Verhoeven", email: "lina@zenarch.net", phone: "+971 52 440 1290", role: "MANAGER", discipline: "INTERIOR", department: "DESIGN", status: "ACTIVE", capacity: 100, utilisation: 60, bio: "Interior design lead for hospitality and residential fit-out.", skills: ["FF&E", "Hospitality", "Material boards"], annualLeaveTotal: 22, annualLeaveTaken: 2, officeLocation: "Dubai", joiningDate: "2021-09-01" },
  { id: "raj", name: "Raj Patel", email: "raj@zenarch.net", phone: "+971 56 778 3321", role: "STAFF", discipline: "MEP", department: "ENGINEERING", status: "ACTIVE", capacity: 100, utilisation: 75, bio: "MEP coordinator. HVAC and electrical load design.", skills: ["HVAC", "Electrical loads", "MEP coordination"], annualLeaveTotal: 22, annualLeaveTaken: 0, officeLocation: "Dubai", joiningDate: "2022-02-14" },
  { id: "maya", name: "Maya Santos", email: "maya@zenarch.net", phone: "+971 54 660 5598", role: "STAFF", discipline: "PROJECT_MANAGEMENT", department: "MANAGEMENT", status: "ON_LEAVE", capacity: 100, utilisation: 40, bio: "Project coordinator. Programme tracking and client reporting.", skills: ["Scheduling", "Cost reporting", "Coordination"], annualLeaveTotal: 22, annualLeaveTaken: 12, officeLocation: "Dubai", joiningDate: "2022-11-07" },
];

/* ─────────────────────────── Clients ─────────────────────────── */

export const CLIENTS: SeedClient[] = [
  { id: "emaar", name: "Emaar Properties", companyName: "Emaar Properties PJSC", contactPerson: "Haitham Al Mansoori", email: "projects@emaar.ae", phone: "+971 4 366 1688", website: "emaar.com", taxNumber: "100211223300003", type: "DEVELOPER", status: "ACTIVE", notes: "Key account — multiple towers in pipeline.", tags: ["key-account", "high-rise"], createdAt: "2024-02-10", addresses: [{ label: "Head Office", line1: "Emaar Square, Building 1", city: "Dubai", emirate: "Dubai", country: "UAE", isPrimary: true }] },
  { id: "aldar", name: "Aldar Properties", companyName: "Aldar Properties PJSC", contactPerson: "Noura Al Hashimi", email: "dev@aldar.com", phone: "+971 2 810 5555", website: "aldar.com", taxNumber: "100299887700001", type: "DEVELOPER", status: "ACTIVE", notes: "Abu Dhabi master developer.", tags: ["master-developer"], createdAt: "2024-05-22", addresses: [{ label: "HQ", line1: "Aldar HQ, Al Raha Beach", city: "Abu Dhabi", emirate: "Abu Dhabi", country: "UAE", isPrimary: true }] },
  { id: "dm", name: "Dubai Municipality", companyName: "Government of Dubai", contactPerson: "Eng. Khalid Bin Saeed", email: "buildings@dm.gov.ae", phone: "+971 800 900", website: "dm.gov.ae", taxNumber: null, type: "GOVERNMENT", status: "ACTIVE", notes: "Public community facilities.", tags: ["government", "public"], createdAt: "2024-08-01", addresses: [{ label: "Buildings Dept", line1: "Baniyas Road, Deira", city: "Dubai", emirate: "Dubai", country: "UAE", isPrimary: true }] },
  { id: "meraas", name: "Meraas Holding", companyName: "Meraas Holding LLC", contactPerson: "Yusuf Karim", email: "design@meraas.ae", phone: "+971 4 317 3999", website: "meraas.com", taxNumber: "100255443300002", type: "DEVELOPER", status: "ACTIVE", notes: "Lifestyle & retail destinations.", tags: ["retail", "lifestyle"], createdAt: "2025-01-18", addresses: [{ label: "Office", line1: "City Walk, Al Wasl", city: "Dubai", emirate: "Dubai", country: "UAE", isPrimary: true }] },
  { id: "khoury", name: "Khoury Family Office", companyName: null, contactPerson: "Samir Khoury", email: "samir@khoury.ae", phone: "+971 50 700 1122", website: null, taxNumber: null, type: "PRIVATE", status: "PROSPECT", notes: "Private villa enquiry — Emirates Hills.", tags: ["villa", "prospect"], createdAt: "2026-04-30", addresses: [{ label: "Residence", line1: "Emirates Hills, Sector W", city: "Dubai", emirate: "Dubai", country: "UAE", isPrimary: true }] },
];

/* ─────────────────────────── Proposals ─────────────────────────── */

export const PROPOSALS: SeedProposal[] = [
  {
    refNumber: "PRO-2026-031", title: "Marina Heights Tower — Full Design Services", clientId: "emaar", clientName: "Emaar Properties", owner: "Greg Lacle",
    status: "APPROVED", revision: 2, currency: "AWG", totalFee: 4200000,
    scopeSummary: "Architecture, structural and MEP design for a 42-storey residential tower.", exclusions: "Specialist façade engineering, LEED certification.", assumptions: "Single mobilisation; client provides topographic survey.", terms: "Payment against milestones, net 30.", estimatedDuration: 64,
    sentAt: "2026-02-12", approvedAt: "2026-03-01", followUpDate: null, lastContactDate: "2026-03-01", followUpNotes: null, nextAction: null, validUntil: "2026-05-12", createdAt: "2026-02-10",
    lineItems: [
      { id: "li1", description: "Architecture — concept to construction", discipline: "ARCHITECTURE", amount: 2100000, isOptional: false, sortOrder: 0 },
      { id: "li2", description: "Structural engineering", discipline: "STRUCTURAL", amount: 1200000, isOptional: false, sortOrder: 1 },
      { id: "li3", description: "MEP engineering", discipline: "MEP", amount: 900000, isOptional: false, sortOrder: 2 },
      { id: "li4", description: "Interior design (lobbies & amenities)", discipline: "INTERIOR", amount: 350000, isOptional: true, sortOrder: 3 },
    ],
    milestones: [
      { id: "m1", name: "Concept design", percentage: 20, dueWeek: 8 },
      { id: "m2", name: "Schematic & authority submission", percentage: 30, dueWeek: 20 },
      { id: "m3", name: "Detailed design & tender", percentage: 30, dueWeek: 40 },
      { id: "m4", name: "Construction support", percentage: 20, dueWeek: 64 },
    ],
  },
  {
    refNumber: "PRO-2026-038", title: "Yas Bay Mixed-Use — Concept & Schematic", clientId: "aldar", clientName: "Aldar Properties", owner: "Sara Khan",
    status: "SENT", revision: 1, currency: "AWG", totalFee: 1850000,
    scopeSummary: "Concept and schematic design for a mixed-use waterfront block.", exclusions: "Detailed design, site supervision.", assumptions: "Massing brief provided by client.", terms: "50% on appointment, 50% on schematic.", estimatedDuration: 24,
    sentAt: "2026-05-28", approvedAt: null, followUpDate: "2026-06-25", lastContactDate: "2026-05-28", followUpNotes: "Awaiting board review.", nextAction: "Call procurement lead", validUntil: "2026-07-28", createdAt: "2026-05-26",
    lineItems: [
      { id: "li1", description: "Concept design", discipline: "ARCHITECTURE", amount: 950000, isOptional: false, sortOrder: 0 },
      { id: "li2", description: "Schematic design", discipline: "ARCHITECTURE", amount: 900000, isOptional: false, sortOrder: 1 },
    ],
    milestones: [
      { id: "m1", name: "Concept", percentage: 50, dueWeek: 10 },
      { id: "m2", name: "Schematic", percentage: 50, dueWeek: 24 },
    ],
  },
  {
    refNumber: "PRO-2026-042", title: "Al Quoz Community Centre", clientId: "dm", clientName: "Dubai Municipality", owner: "Maya Santos",
    status: "PENDING", revision: 1, currency: "AWG", totalFee: 980000,
    scopeSummary: "Full design services for a public community centre.", exclusions: "Landscape of adjacent park.", assumptions: "Government standard specifications apply.", terms: "Per government payment schedule.", estimatedDuration: 36,
    sentAt: "2026-06-05", approvedAt: null, followUpDate: "2026-06-22", lastContactDate: "2026-06-10", followUpNotes: "Tender clarification submitted.", nextAction: "Submit clarification responses", validUntil: "2026-08-05", createdAt: "2026-06-03",
    lineItems: [
      { id: "li1", description: "Architecture", discipline: "ARCHITECTURE", amount: 520000, isOptional: false, sortOrder: 0 },
      { id: "li2", description: "Structural", discipline: "STRUCTURAL", amount: 260000, isOptional: false, sortOrder: 1 },
      { id: "li3", description: "MEP", discipline: "MEP", amount: 200000, isOptional: false, sortOrder: 2 },
    ],
    milestones: [
      { id: "m1", name: "Concept & approval", percentage: 40, dueWeek: 12 },
      { id: "m2", name: "Detailed design", percentage: 40, dueWeek: 28 },
      { id: "m3", name: "Tender support", percentage: 20, dueWeek: 36 },
    ],
  },
  {
    refNumber: "PRO-2026-047", title: "Emirates Hills Private Villa", clientId: "khoury", clientName: "Khoury Family Office", owner: "Lina Verhoeven",
    status: "DRAFT", revision: 1, currency: "AWG", totalFee: 640000,
    scopeSummary: "Architecture and interior design for a private villa.", exclusions: "Landscape, pool engineering.", assumptions: "Client provides plot survey and brief.", terms: "Stage payments.", estimatedDuration: 30,
    sentAt: null, approvedAt: null, followUpDate: "2026-06-28", lastContactDate: "2026-06-12", followUpNotes: "Brief workshop scheduled.", nextAction: "Confirm fee scope", validUntil: null, createdAt: "2026-06-12",
    lineItems: [
      { id: "li1", description: "Architecture", discipline: "ARCHITECTURE", amount: 380000, isOptional: false, sortOrder: 0 },
      { id: "li2", description: "Interior design", discipline: "INTERIOR", amount: 260000, isOptional: false, sortOrder: 1 },
    ],
    milestones: [
      { id: "m1", name: "Concept", percentage: 40, dueWeek: 8 },
      { id: "m2", name: "Detailed & FF&E", percentage: 60, dueWeek: 30 },
    ],
  },
];

/* ─────────────────────────── Orders ─────────────────────────── */

export const ORDERS: SeedOrder[] = [
  { orderNumber: "ORD-2026-014", clientName: "Emaar Properties", proposalRef: "PRO-2026-031", projectId: "ZA-2026-014", title: "Marina Heights Tower — Design Services", serviceType: "Full Design Services", status: "IN_PROGRESS", fee: 4200000, currency: "AWG", scopeSummary: "Confirmed order for full multidisciplinary design.", siteAddress: "Dubai Marina, Plot D-17", expectedStartDate: "2026-03-15", expectedEndDate: "2027-06-30", notes: "Mobilised; concept underway.", createdAt: "2026-03-05" },
  { orderNumber: "ORD-2026-022", clientName: "Meraas Holding", proposalRef: null, projectId: "ZA-2026-022", title: "City Walk Retail Refresh", serviceType: "Architecture + Interior", status: "CONFIRMED", fee: 1350000, currency: "AWG", scopeSummary: "Retail frontage and interior refresh across two blocks.", siteAddress: "City Walk, Al Wasl, Dubai", expectedStartDate: "2026-07-01", expectedEndDate: "2026-12-15", notes: "Awaiting kickoff.", createdAt: "2026-06-08" },
  { orderNumber: "ORD-2026-009", clientName: "Aldar Properties", proposalRef: null, projectId: "ZA-2026-009", title: "Yas Bay Plot 4 — Schematic", serviceType: "Concept + Schematic", status: "COMPLETED", fee: 820000, currency: "AWG", scopeSummary: "Completed schematic package handed to client.", siteAddress: "Yas Bay, Abu Dhabi", expectedStartDate: "2025-11-01", expectedEndDate: "2026-04-30", notes: "Closed out.", createdAt: "2025-10-20" },
];

/* ─────────────────────────── Projects ─────────────────────────── */

const PHASES = (over: Partial<Record<string, Partial<SeedPhase>>> = {}): SeedPhase[] => {
  const base: SeedPhase[] = [
    { id: "concept", name: "Concept Design", discipline: "ARCHITECTURE", status: "COMPLETED", progressPct: 100 },
    { id: "schematic", name: "Schematic Design", discipline: "ARCHITECTURE", status: "IN_PROGRESS", progressPct: 60 },
    { id: "detailed", name: "Detailed Design", discipline: "STRUCTURAL", status: "NOT_STARTED", progressPct: 0 },
    { id: "tender", name: "Tender Documentation", discipline: null, status: "NOT_STARTED", progressPct: 0 },
    { id: "construction", name: "Construction Support", discipline: "PROJECT_MANAGEMENT", status: "NOT_STARTED", progressPct: 0 },
    { id: "handover", name: "Handover", discipline: null, status: "NOT_STARTED", progressPct: 0 },
  ];
  return base.map((p) => ({ ...p, ...(over[p.id] ?? {}) }));
};

export const PROJECTS: SeedProject[] = [
  {
    projectNumber: "ZA-2026-014", name: "Marina Heights Tower", clientId: "emaar", manager: "Greg Lacle", status: "ACTIVE", priority: "HIGH",
    description: "42-storey residential tower with amenity podium.", siteAddress: "Dubai Marina, Plot D-17", disciplines: ["ARCHITECTURE", "STRUCTURAL", "MEP", "INTERIOR"],
    startDate: "2026-03-15", targetEndDate: "2027-06-30", completedAt: null, progressPct: 35, value: 4200000, currency: "AWG",
    phases: PHASES(), team: [{ name: "Greg Lacle", role: "Project Director" }, { name: "Sara Khan", role: "Structural Lead" }, { name: "Omar Haddad", role: "Project Architect" }, { name: "Raj Patel", role: "MEP" }],
  },
  {
    projectNumber: "ZA-2026-022", name: "City Walk Retail Refresh", clientId: "meraas", manager: "Lina Verhoeven", status: "ACTIVE", priority: "MEDIUM",
    description: "Retail frontage and interior refresh across two blocks.", siteAddress: "City Walk, Al Wasl, Dubai", disciplines: ["ARCHITECTURE", "INTERIOR"],
    startDate: "2026-07-01", targetEndDate: "2026-12-15", completedAt: null, progressPct: 10, value: 1350000, currency: "AWG",
    phases: PHASES({ schematic: { status: "NOT_STARTED", progressPct: 0 } }), team: [{ name: "Lina Verhoeven", role: "Design Lead" }, { name: "Omar Haddad", role: "Architect" }],
  },
  {
    projectNumber: "ZA-2026-009", name: "Yas Bay Plot 4", clientId: "aldar", manager: "Sara Khan", status: "COMPLETED", priority: "MEDIUM",
    description: "Schematic design package for a mixed-use waterfront plot.", siteAddress: "Yas Bay, Abu Dhabi", disciplines: ["ARCHITECTURE", "STRUCTURAL"],
    startDate: "2025-11-01", targetEndDate: "2026-04-30", completedAt: "2026-04-28", progressPct: 100, value: 820000, currency: "AWG",
    phases: PHASES({ schematic: { status: "COMPLETED", progressPct: 100 }, detailed: { status: "COMPLETED", progressPct: 100 }, tender: { status: "COMPLETED", progressPct: 100 }, construction: { status: "COMPLETED", progressPct: 100 }, handover: { status: "COMPLETED", progressPct: 100 } }),
    team: [{ name: "Sara Khan", role: "Project Lead" }, { name: "Omar Haddad", role: "Architect" }],
  },
  {
    projectNumber: "ZA-2026-031", name: "Al Quoz Community Centre", clientId: "dm", manager: "Maya Santos", status: "ON_HOLD", priority: "LOW",
    description: "Public community centre — awaiting tender award.", siteAddress: "Al Quoz 3, Dubai", disciplines: ["ARCHITECTURE", "STRUCTURAL", "MEP"],
    startDate: null, targetEndDate: null, completedAt: null, progressPct: 5, value: 980000, currency: "AWG",
    phases: PHASES({ concept: { status: "IN_PROGRESS", progressPct: 40 }, schematic: { status: "NOT_STARTED", progressPct: 0 } }),
    team: [{ name: "Maya Santos", role: "Coordinator" }, { name: "Greg Lacle", role: "Design Director" }],
  },
  {
    projectNumber: "ZA-2025-118", name: "Jumeirah Beach Villa", clientId: "khoury", manager: "Lina Verhoeven", status: "ACTIVE", priority: "MEDIUM",
    description: "Private beachfront villa, architecture and interiors.", siteAddress: "Jumeirah 1, Dubai", disciplines: ["ARCHITECTURE", "INTERIOR"],
    startDate: "2025-09-10", targetEndDate: "2026-09-30", completedAt: null, progressPct: 55, value: 1100000, currency: "AWG",
    phases: PHASES({ detailed: { status: "IN_PROGRESS", progressPct: 50 } }),
    team: [{ name: "Lina Verhoeven", role: "Design Lead" }, { name: "Greg Lacle", role: "Principal" }],
  },
];

/* ─────────────────────────── Leave ─────────────────────────── */

export const LEAVE: SeedLeave[] = [
  { id: "lr1", userId: "maya", type: "ANNUAL", status: "APPROVED", startDate: "2026-06-15", endDate: "2026-06-26", days: 10, reason: "Family holiday", approvedBy: "Greg Lacle" },
  { id: "lr2", userId: "omar", type: "SICK", status: "APPROVED", startDate: "2026-06-08", endDate: "2026-06-09", days: 2, reason: "Flu", approvedBy: "Sara Khan" },
  { id: "lr3", userId: "raj", type: "ANNUAL", status: "PENDING", startDate: "2026-07-13", endDate: "2026-07-17", days: 5, reason: "Personal", approvedBy: null },
  { id: "lr4", userId: "sara", type: "ANNUAL", status: "APPROVED", startDate: "2026-05-04", endDate: "2026-05-08", days: 5, reason: "Eid break", approvedBy: "Greg Lacle" },
  { id: "lr5", userId: "lina", type: "UNPAID", status: "REJECTED", startDate: "2026-08-03", endDate: "2026-08-14", days: 10, reason: "Extended travel", approvedBy: "Greg Lacle" },
];
