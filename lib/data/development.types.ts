/**
 * Land Development / Parceling Plan — data-access types & client-safe helpers.
 *
 * Client-safe sibling (like projects.types.ts): ONLY type declarations, enum
 * string-unions, label maps and pure transforms. It MUST NOT import `@/lib/db`,
 * so `"use client"` tables/forms can import these without dragging Postgres into
 * the browser bundle. The calculation engine lives in `@/lib/development/calc`.
 */

/* ── enums (mirror the Prisma enums one-to-one) ──────────────────────────── */

export type DevProjectStatus =
  | "PLANNING"
  | "ACQUISITION"
  | "PERMITTING"
  | "INFRASTRUCTURE"
  | "SALES"
  | "CLOSEOUT"
  | "COMPLETED"
  | "ON_HOLD"
  | "ARCHIVED";

export type PropertyType = "PROPERTY_LAND" | "LONG_LEASE" | "MIXED";
export type DevProjectType = "PARCEL_ONLY" | "HOUSE_AND_PARCEL" | "APARTMENT" | "MIXED_USE";

export type LotType = "RESIDENTIAL" | "COMMERCIAL" | "CORNER" | "PREMIUM" | "GREEN" | "UTILITY" | "OTHER";
export type LotStatus = "DRAFT" | "RESERVED" | "OPTIONED" | "SOLD" | "CLOSED";
export type PaymentStatus = "NONE" | "DEPOSIT_PAID" | "PARTIAL" | "PAID_IN_FULL" | "OVERDUE";

export type PermitTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "BLOCKED" | "DONE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type BudgetStatus = "BUDGETED" | "COMMITTED" | "IN_PROGRESS" | "INVOICED" | "PAID" | "OVER_BUDGET";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "RESERVED" | "NEGOTIATION" | "WON" | "LOST";
export type FinancingStatus = "CASH" | "PRE_APPROVED" | "PENDING" | "DECLINED" | "UNKNOWN";

export type ScenarioKind = "BASE" | "CONSERVATIVE" | "OPTIMISTIC" | "CUSTOM";

export type DevContractStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "TERMINATED";
export type DevInvoiceStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "DISPUTED";
export type DevReservationStatus = "ACTIVE" | "CONVERTED" | "EXPIRED" | "CANCELLED";
export type DevSalesContractStatus = "DRAFT" | "SIGNED" | "CLOSED" | "CANCELLED";

export type DevDocumentKind =
  | "PARCEL_DEED" | "LEASE" | "SURVEY" | "TOPOGRAPHIC_PLAN" | "PARCELING_PLAN"
  | "DOW_DIP_SUBMISSION" | "APPROVAL" | "UTILITY_LETTER" | "BUYER_CONTRACT"
  | "INVOICE" | "PAYMENT_RECEIPT" | "SALES_AGREEMENT" | "CLOSING_DOCUMENT" | "OTHER";

/* ── label maps ──────────────────────────────────────────────────────────── */

export const DEV_PROJECT_STATUS_LABEL: Record<DevProjectStatus, string> = {
  PLANNING: "Planning",
  ACQUISITION: "Acquisition",
  PERMITTING: "Permitting",
  INFRASTRUCTURE: "Infrastructure",
  SALES: "Sales",
  CLOSEOUT: "Close-out",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  ARCHIVED: "Archived",
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  PROPERTY_LAND: "Property land",
  LONG_LEASE: "Long lease",
  MIXED: "Mixed",
};

export const DEV_PROJECT_TYPE_LABEL: Record<DevProjectType, string> = {
  PARCEL_ONLY: "Parcel only",
  HOUSE_AND_PARCEL: "House + parcel",
  APARTMENT: "Apartment development",
  MIXED_USE: "Mixed-use development",
};

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  DRAFT: "Draft",
  RESERVED: "Reserved",
  OPTIONED: "Optioned",
  SOLD: "Sold",
  CLOSED: "Closed",
};

export const PERMIT_TASK_STATUS_LABEL: Record<PermitTaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  RESERVED: "Reserved",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const DEV_DOCUMENT_KIND_LABEL: Record<DevDocumentKind, string> = {
  PARCEL_DEED: "Parcel deed",
  LEASE: "Lease",
  SURVEY: "Survey",
  TOPOGRAPHIC_PLAN: "Topographic plan",
  PARCELING_PLAN: "Parceling plan",
  DOW_DIP_SUBMISSION: "DOW/DIP submission",
  APPROVAL: "Approval",
  UTILITY_LETTER: "Utility letter",
  BUYER_CONTRACT: "Buyer contract",
  INVOICE: "Invoice",
  PAYMENT_RECEIPT: "Payment receipt",
  SALES_AGREEMENT: "Sales agreement",
  CLOSING_DOCUMENT: "Closing document",
  OTHER: "Other",
};

export const SCENARIO_KIND_LABEL: Record<ScenarioKind, string> = {
  BASE: "Base case",
  CONSERVATIVE: "Conservative",
  OPTIMISTIC: "Optimistic",
  CUSTOM: "Custom",
};

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const LOT_STATUS_TONE: Record<LotStatus, Tone> = {
  DRAFT: "neutral",
  RESERVED: "amber",
  OPTIONED: "blue",
  SOLD: "violet",
  CLOSED: "green",
};

export const DEV_PROJECT_STATUS_TONE: Record<DevProjectStatus, Tone> = {
  PLANNING: "neutral",
  ACQUISITION: "blue",
  PERMITTING: "amber",
  INFRASTRUCTURE: "violet",
  SALES: "blue",
  CLOSEOUT: "amber",
  COMPLETED: "green",
  ON_HOLD: "slate",
  ARCHIVED: "slate",
};

export const PERMIT_TASK_STATUS_TONE: Record<PermitTaskStatus, Tone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "blue",
  SUBMITTED: "violet",
  APPROVED: "green",
  BLOCKED: "red",
  DONE: "green",
};

export const RISK_TONE: Record<RiskLevel, Tone> = { LOW: "green", MEDIUM: "amber", HIGH: "red" };

export const CONTRACT_STATUS_LABEL: Record<DevContractStatus, string> = { DRAFT: "Draft", ACTIVE: "Active", COMPLETED: "Completed", TERMINATED: "Terminated" };
export const CONTRACT_STATUS_TONE: Record<DevContractStatus, Tone> = { DRAFT: "neutral", ACTIVE: "blue", COMPLETED: "green", TERMINATED: "red" };
export const INVOICE_STATUS_LABEL: Record<DevInvoiceStatus, string> = { DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", PAID: "Paid", DISPUTED: "Disputed" };
export const INVOICE_STATUS_TONE: Record<DevInvoiceStatus, Tone> = { DRAFT: "neutral", SUBMITTED: "blue", APPROVED: "violet", PAID: "green", DISPUTED: "red" };
export const RESERVATION_STATUS_LABEL: Record<DevReservationStatus, string> = { ACTIVE: "Active", CONVERTED: "Converted", EXPIRED: "Expired", CANCELLED: "Cancelled" };
export const RESERVATION_STATUS_TONE: Record<DevReservationStatus, Tone> = { ACTIVE: "amber", CONVERTED: "green", EXPIRED: "slate", CANCELLED: "red" };
export const SALES_CONTRACT_STATUS_LABEL: Record<DevSalesContractStatus, string> = { DRAFT: "Draft", SIGNED: "Signed", CLOSED: "Closed", CANCELLED: "Cancelled" };
export const SALES_CONTRACT_STATUS_TONE: Record<DevSalesContractStatus, Tone> = { DRAFT: "neutral", SIGNED: "blue", CLOSED: "green", CANCELLED: "red" };

/* ── DTO entity types (serialisable: numbers + ISO date strings) ─────────── */

export type DevelopmentProject = {
  id: string;
  projectNumber: string;
  name: string;
  location: string | null;
  clientOwner: string | null;
  developer: string | null;
  status: DevProjectStatus;
  currency: string;
  totalParcelArea: number;
  zoningClassification: string | null;
  ropvArticleRef: string | null;
  propertyType: PropertyType;
  projectType: DevProjectType;
  startDate: string | null;
  targetPermitDate: string | null;
  targetInfraDate: string | null;
  targetSalesLaunchDate: string | null;
  targetCloseoutDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LandAcquisition = {
  id: string;
  projectId: string;
  parcelAcquisitionCost: number;
  transferTax: number;
  notaryCost: number;
  kadasterCost: number;
  brokerCommission: number;
  dueDiligence: number;
  appraisal: number;
  topographicSurvey: number;
  parcelingSurvey: number;
  meetbrieven: number;
  legalSetup: number;
  companySetup: number;
  taxAdvisor: number;
  financingSetup: number;
  bankGuarantee: number;
  contingencyPct: number;
};

export type LandUseAllocation = {
  id: string;
  projectId: string;
  grossParcelArea: number;
  roadArea: number;
  sidewalkArea: number;
  greenArea: number;
  utilityArea: number;
  drainageArea: number;
  commonArea: number;
  poolDeckArea: number;
  retainedOwnerArea: number;
  otherNonSellableArea: number;
  requiredGreenPct: number;
  requiredRoadPct: number;
};

export type LotInventory = {
  id: string;
  projectId: string;
  lotNumber: string;
  phase: string | null;
  block: string | null;
  lotType: LotType;
  areaM2: number;
  frontage: number | null;
  depth: number | null;
  cornerLot: boolean;
  viewPremium: boolean;
  baseLandPricePerM2: number;
  premiumAdjustmentPerM2: number;
  allocatedLandCost: number;
  allocatedInfraCost: number;
  allocatedSoftCost: number;
  status: LotStatus;
  buyerName: string | null;
  broker: string | null;
  reservationDate: string | null;
  agreementDate: string | null;
  closingDate: string | null;
  depositPct: number;
  paymentStatus: PaymentStatus;
  notes: string | null;
};

export type UnitCostComponent = {
  id: string;
  unitTypeId: string;
  name: string; // floorplan / balcony / garage / staircase / roof terrace / front yard
  area: number;
  constructionCostPerM2: number;
  salesPricePerM2: number;
  sortOrder: number;
};

export type UnitType = {
  id: string;
  projectId: string;
  name: string;
  quantity: number;
  components: UnitCostComponent[];
};

export type InfrastructureBudget = {
  id: string;
  projectId: string;
  costCode: number;
  category: string;
  item: string;
  quantity: number;
  unit: string | null;
  unitRate: number;
  budget: number;
  committed: number;
  actualPaid: number;
  vendor: string | null;
  contractRef: string | null;
  invoiceRef: string | null;
  status: BudgetStatus;
};

export type PermitTask = {
  id: string;
  projectId: string;
  name: string;
  responsible: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  status: PermitTaskStatus;
  dependency: string | null;
  riskLevel: RiskLevel;
  notes: string | null;
  sortOrder: number;
};

export type SalesLead = {
  id: string;
  projectId: string;
  name: string;
  contact: string | null;
  source: string | null;
  interestedLot: string | null;
  budget: number;
  financingStatus: FinancingStatus;
  status: LeadStatus;
  depositReceived: number;
  contractSigned: boolean;
  broker: string | null;
  commissionPct: number;
  followUpDate: string | null;
  notes: string | null;
};

export type CashFlowMonth = {
  id: string;
  projectId: string;
  month: string; // "YYYY-MM"
  acquisitionCost: number;
  consultantCost: number;
  permitCost: number;
  infrastructureCost: number;
  constructionCost: number;
  marketingCost: number;
  financingCost: number;
  salesIncome: number;
  depositIncome: number;
  loanDraw: number;
  loanRepayment: number;
  equityInvested: number;
};

export type Scenario = {
  id: string;
  projectId: string;
  name: string;
  kind: ScenarioKind;
  landPurchasePrice: number;
  salesPricePerM2: number;
  constructionCostPerM2: number;
  infrastructureCost: number;
  softCostPct: number;
  financingRatePct: number;
  absorptionRate: number;
  contingencyPct: number;
  developerProfitTargetPct: number;
  salesDelayMonths: number;
};

export type DevDocument = {
  id: string;
  projectId: string;
  kind: DevDocumentKind;
  name: string;
  url: string | null;
  uploadedAt: string;
};

export type Vendor = {
  id: string;
  projectId: string;
  name: string;
  trade: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type DevContract = {
  id: string;
  projectId: string;
  contractRef: string;
  title: string;
  vendorName: string | null;
  costCode: number | null;
  value: number;
  retentionPct: number;
  status: DevContractStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export type DevInvoice = {
  id: string;
  projectId: string;
  invoiceNumber: string;
  contractRef: string | null;
  vendorName: string | null;
  costCode: number | null;
  amount: number;
  status: DevInvoiceStatus;
  dateIssued: string | null;
  dateDue: string | null;
};

export type DevPayment = {
  id: string;
  projectId: string;
  invoiceNumber: string | null;
  vendorName: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  datePaid: string | null;
};

export type BuyerReservation = {
  id: string;
  projectId: string;
  lotNumber: string;
  buyerName: string;
  contact: string | null;
  broker: string | null;
  depositAmount: number;
  status: DevReservationStatus;
  reservationDate: string | null;
  expiryDate: string | null;
  notes: string | null;
};

export type SalesContract = {
  id: string;
  projectId: string;
  contractNumber: string;
  lotNumber: string;
  buyerName: string;
  salePrice: number;
  depositPaid: number;
  status: DevSalesContractStatus;
  signedDate: string | null;
  closingDate: string | null;
  notes: string | null;
};

/* ── lean list rows + summaries ──────────────────────────────────────────── */

export type DevelopmentProjectListItem = {
  id: string;
  projectNumber: string;
  name: string;
  location: string | null;
  status: DevProjectStatus;
  projectType: DevProjectType;
  currency: string;
  totalParcelArea: number;
  netSellableLand: number;
  totalLots: number;
  totalProjectCost: number;
  totalRevenue: number;
  totalProfit: number;
  roiPct: number;
};

/** Everything the workspace/dashboard composes from. */
export type DevelopmentProjectFull = DevelopmentProject & {
  acquisition: LandAcquisition | null;
  landUse: LandUseAllocation | null;
  lots: LotInventory[];
  unitTypes: UnitType[];
  budget: InfrastructureBudget[];
  permits: PermitTask[];
  leads: SalesLead[];
  cashFlow: CashFlowMonth[];
  scenarios: Scenario[];
  documents: DevDocument[];
  vendors: Vendor[];
  contracts: DevContract[];
  invoices: DevInvoice[];
  payments: DevPayment[];
  reservations: BuyerReservation[];
  salesContracts: SalesContract[];
};

/* ── pure formatting transforms (client-safe) ────────────────────────────── */

export function formatM2(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} m²`;
}
