/**
 * Land Development — demo seed data: the Morgenster Parceling Plan (2023A-038).
 *
 * Two uses (same as the CA module): the offline/demo fallback for the data layer,
 * and the input to `prisma db seed`. Every derived figure ties out to the spec
 * §18 reference (net 4,404 m²; total project cost AWG 1,601,373.60; parcel profit
 * AWG 380,426.40; 13 homes × AWG 78,867 = 1,025,271; total AWG 1,405,697.40).
 */
import type {
  DevelopmentProject,
  LandAcquisition,
  LandUseAllocation,
  LotInventory,
  UnitType,
  InfrastructureBudget,
  PermitTask,
  SalesLead,
  CashFlowMonth,
  Scenario,
  DevDocument,
  Vendor,
  DevContract,
  DevInvoice,
  DevPayment,
  BuyerReservation,
  SalesContract,
} from "@/lib/data/development.types";

const PROJECT_ID = "DEV-2023A-038";

export const SEED_DEV_PROJECT: DevelopmentProject = {
  id: PROJECT_ID,
  projectNumber: "2023A-038",
  name: "Morgenster Parceling Plan",
  location: "Morgenster, Aruba",
  clientOwner: "Morgenster Land Holding NV",
  developer: "ZenArch Development",
  status: "INFRASTRUCTURE",
  currency: "AWG",
  totalParcelArea: 5844,
  zoningClassification: "Residential (Woongebied)",
  ropvArticleRef: "ROPV Art. 12",
  propertyType: "PROPERTY_LAND",
  projectType: "HOUSE_AND_PARCEL",
  startDate: "2023-03-01",
  targetPermitDate: "2023-11-30",
  targetInfraDate: "2024-08-31",
  targetSalesLaunchDate: "2024-03-01",
  targetCloseoutDate: "2025-12-31",
  createdAt: "2023-03-01",
  updatedAt: "2024-06-15",
};

export const SEED_DEV_ACQUISITION: LandAcquisition = {
  id: `${PROJECT_ID}-acq`,
  projectId: PROJECT_ID,
  parcelAcquisitionCost: 642_840, // → AWG 110 / gross m²
  transferTax: 0,
  notaryCost: 0,
  kadasterCost: 0,
  brokerCommission: 0,
  dueDiligence: 0,
  appraisal: 0,
  topographicSurvey: 0,
  parcelingSurvey: 0,
  meetbrieven: 0,
  legalSetup: 0,
  companySetup: 0,
  taxAdvisor: 0,
  financingSetup: 0,
  bankGuarantee: 0,
  contingencyPct: 0,
};

export const SEED_DEV_LAND_USE: LandUseAllocation = {
  id: `${PROJECT_ID}-land`,
  projectId: PROJECT_ID,
  grossParcelArea: 5844,
  roadArea: 1440,
  sidewalkArea: 0,
  greenArea: 0,
  utilityArea: 0,
  drainageArea: 0,
  commonArea: 0,
  poolDeckArea: 0,
  retainedOwnerArea: 0,
  otherNonSellableArea: 0,
  requiredGreenPct: 0,
  requiredRoadPct: 0,
};

/* 13 lots, areas summing to the 4,404 m² net sellable. Allocated cost is split
 * by the project rates (land 145.97 + infra 100.14 + soft 117.51 = 363.62 /m²),
 * so the per-lot allocations roll up to the AWG 1,601,373.60 project cost. */
const LOT_AREAS = [360, 350, 345, 340, 338, 335, 332, 330, 328, 325, 322, 320, 379]; // = 4,404
const LAND_RATE = 642_840 / 4404; // 145.9673
const INFRA_RATE = 441_000 / 4404; // 100.1362
const SOFT_RATE = 517_533.6 / 4404; // 117.5145

export const SEED_DEV_LOTS: LotInventory[] = LOT_AREAS.map((area, i) => {
  const n = i + 1;
  const sold = i < 4;
  const reserved = i >= 4 && i < 6;
  return {
    id: `${PROJECT_ID}-lot-${n}`,
    projectId: PROJECT_ID,
    lotNumber: `L-${String(n).padStart(2, "0")}`,
    phase: i < 7 ? "Phase 1" : "Phase 2",
    block: i < 7 ? "A" : "B",
    lotType: i === 12 ? "CORNER" : "RESIDENTIAL",
    areaM2: area,
    frontage: 18,
    depth: Math.round((area / 18) * 10) / 10,
    cornerLot: i === 12,
    viewPremium: false,
    baseLandPricePerM2: 450,
    premiumAdjustmentPerM2: 0,
    allocatedLandCost: Math.round(area * LAND_RATE * 100) / 100,
    allocatedInfraCost: Math.round(area * INFRA_RATE * 100) / 100,
    allocatedSoftCost: Math.round(area * SOFT_RATE * 100) / 100,
    status: sold ? "SOLD" : reserved ? "RESERVED" : "DRAFT",
    buyerName: sold ? `Buyer ${n}` : null,
    broker: sold || reserved ? "Caribbean Realty" : null,
    reservationDate: sold || reserved ? "2024-04-15" : null,
    agreementDate: sold ? "2024-05-10" : null,
    closingDate: null,
    depositPct: sold ? 20 : reserved ? 10 : 0,
    paymentStatus: sold ? "DEPOSIT_PAID" : "NONE",
    notes: null,
  };
});

export const SEED_DEV_UNIT_TYPES: UnitType[] = [
  {
    id: `${PROJECT_ID}-unit-casa`,
    projectId: PROJECT_ID,
    name: "Casa Morgenster (3BR)",
    quantity: 13,
    components: [
      {
        id: `${PROJECT_ID}-unit-casa-c1`,
        unitTypeId: `${PROJECT_ID}-unit-casa`,
        name: "Floorplan",
        area: 87.63,
        constructionCostPerM2: 1750, // → AWG 153,352.50 / unit
        salesPricePerM2: 2650, // → AWG 232,219.50 / unit
        sortOrder: 0,
      },
    ],
  },
];

/* Infrastructure / cost-code budget. Totals: 642,840 + 441,000 + 517,533.60. */
export const SEED_DEV_BUDGET: InfrastructureBudget[] = [
  { code: 1000, cat: "Land Acquisition", item: "Parcel acquisition", qty: 5844, unit: "m²", rate: 110, status: "PAID", paid: 642_840 },
  { code: 5000, cat: "Infrastructure / Civil Works", item: "Road construction", qty: 1440, unit: "m²", rate: 150, status: "IN_PROGRESS", paid: 150_000 },
  { code: 5000, cat: "Infrastructure / Civil Works", item: "Drainage", qty: 1, unit: "ls", rate: 60_000, status: "COMMITTED", paid: 0 },
  { code: 5000, cat: "Infrastructure / Civil Works", item: "Sewage system", qty: 1, unit: "ls", rate: 55_000, status: "COMMITTED", paid: 0 },
  { code: 6000, cat: "Utilities", item: "Water connection (WEB)", qty: 1, unit: "ls", rate: 40_000, status: "BUDGETED", paid: 0 },
  { code: 6000, cat: "Utilities", item: "Street lighting (ELMAR)", qty: 1, unit: "ls", rate: 25_000, status: "BUDGETED", paid: 0 },
  { code: 5000, cat: "Infrastructure / Civil Works", item: "Landscaping", qty: 1, unit: "ls", rate: 30_000, status: "BUDGETED", paid: 0 },
  { code: 5000, cat: "Infrastructure / Civil Works", item: "Exterior walls & gates", qty: 1, unit: "ls", rate: 15_000, status: "BUDGETED", paid: 0 },
  { code: 4000, cat: "Architecture / Engineering / Consultants", item: "Architecture & engineering", qty: 1, unit: "ls", rate: 250_000, status: "IN_PROGRESS", paid: 180_000 },
  { code: 3000, cat: "Surveys / Due Diligence", item: "Parceling survey (meetbrieven)", qty: 1, unit: "ls", rate: 80_000, status: "PAID", paid: 80_000 },
  { code: 3000, cat: "Surveys / Due Diligence", item: "Topographic survey", qty: 1, unit: "ls", rate: 35_000, status: "PAID", paid: 35_000 },
  { code: 4000, cat: "Architecture / Engineering / Consultants", item: "Civil engineering", qty: 1, unit: "ls", rate: 90_000, status: "COMMITTED", paid: 0 },
  { code: 4000, cat: "Architecture / Engineering / Consultants", item: "Project supervision", qty: 1, unit: "ls", rate: 62_533.6, status: "BUDGETED", paid: 0 },
].map((b, i) => ({
  id: `${PROJECT_ID}-bud-${i + 1}`,
  projectId: PROJECT_ID,
  costCode: b.code,
  category: b.cat,
  item: b.item,
  quantity: b.qty,
  unit: b.unit,
  unitRate: b.rate,
  budget: Math.round(b.qty * b.rate * 100) / 100,
  committed: b.status === "COMMITTED" || b.status === "IN_PROGRESS" ? Math.round(b.qty * b.rate * 100) / 100 : b.paid,
  actualPaid: b.paid,
  vendor: null,
  contractRef: null,
  invoiceRef: null,
  status: b.status as InfrastructureBudget["status"],
}));

const PERMIT_NAMES = [
  "ROPV zoning review", "Concept parceling layout", "Topographic survey",
  "Preliminary DOW/DIP consultation", "Civil engineer input", "Utility coordination",
  "Parceling plan drawings", "Road / infra plan", "Drainage plan",
  "Environmental / green-area review", "Submission to DOW", "Submission to DIP",
  "Corrections / comments", "Resubmission", "Approval", "Meetbrieven",
  "Kadaster registration", "Final sales-ready documentation",
];

export const SEED_DEV_PERMITS: PermitTask[] = PERMIT_NAMES.map((name, i) => ({
  id: `${PROJECT_ID}-permit-${i + 1}`,
  projectId: PROJECT_ID,
  name,
  responsible: i < 6 ? "Survey & Design Lead" : i < 12 ? "Civil Engineer" : "Project Manager",
  startDate: "2023-04-01",
  dueDate: "2023-11-30",
  completedDate: i < 11 ? "2023-10-15" : null,
  status: i < 11 ? "APPROVED" : i === 11 ? "IN_PROGRESS" : "NOT_STARTED",
  dependency: i > 0 ? PERMIT_NAMES[i - 1] : null,
  riskLevel: i === 11 ? "MEDIUM" : "LOW",
  notes: null,
  sortOrder: i,
}));

export const SEED_DEV_LEADS: SalesLead[] = [
  { id: `${PROJECT_ID}-lead-1`, projectId: PROJECT_ID, name: "Familia Croes", contact: "croes@example.aw", source: "Referral", interestedLot: "L-07", budget: 200_000, financingStatus: "PRE_APPROVED", status: "QUALIFIED", depositReceived: 0, contractSigned: false, broker: "Caribbean Realty", commissionPct: 3, followUpDate: "2024-07-01", notes: null },
  { id: `${PROJECT_ID}-lead-2`, projectId: PROJECT_ID, name: "R. Maduro", contact: "+297 560 1234", source: "Website", interestedLot: "L-08", budget: 180_000, financingStatus: "PENDING", status: "NEGOTIATION", depositReceived: 5_000, contractSigned: false, broker: "Caribbean Realty", commissionPct: 3, followUpDate: "2024-06-28", notes: "Awaiting bank pre-approval." },
  { id: `${PROJECT_ID}-lead-3`, projectId: PROJECT_ID, name: "Tromp Holding", contact: "info@tromp.aw", source: "Broker", interestedLot: "L-09", budget: 250_000, financingStatus: "CASH", status: "RESERVED", depositReceived: 15_000, contractSigned: false, broker: "Island Properties", commissionPct: 2.5, followUpDate: "2024-07-05", notes: null },
  { id: `${PROJECT_ID}-lead-4`, projectId: PROJECT_ID, name: "S. Wernet", contact: "wernet@example.aw", source: "Walk-in", interestedLot: null, budget: 160_000, financingStatus: "UNKNOWN", status: "NEW", depositReceived: 0, contractSigned: false, broker: null, commissionPct: 3, followUpDate: "2024-07-10", notes: null },
];

const CF_MONTHS: Array<Partial<CashFlowMonth> & { month: string }> = [
  { month: "2024-01", infrastructureCost: 80_000, consultantCost: 40_000, equityInvested: 200_000 },
  { month: "2024-02", infrastructureCost: 70_000, consultantCost: 35_000 },
  { month: "2024-03", infrastructureCost: 90_000, marketingCost: 20_000 },
  { month: "2024-04", infrastructureCost: 60_000, depositIncome: 90_000 },
  { month: "2024-05", infrastructureCost: 50_000, salesIncome: 360_000, depositIncome: 40_000 },
  { month: "2024-06", infrastructureCost: 41_000, salesIncome: 360_000 },
  { month: "2024-07", salesIncome: 450_000 },
  { month: "2024-08", salesIncome: 450_000 },
];

export const SEED_DEV_CASHFLOW: CashFlowMonth[] = CF_MONTHS.map((m, i) => ({
  id: `${PROJECT_ID}-cf-${i + 1}`,
  projectId: PROJECT_ID,
  month: m.month,
  acquisitionCost: m.acquisitionCost ?? 0,
  consultantCost: m.consultantCost ?? 0,
  permitCost: m.permitCost ?? 0,
  infrastructureCost: m.infrastructureCost ?? 0,
  constructionCost: m.constructionCost ?? 0,
  marketingCost: m.marketingCost ?? 0,
  financingCost: m.financingCost ?? 0,
  salesIncome: m.salesIncome ?? 0,
  depositIncome: m.depositIncome ?? 0,
  loanDraw: m.loanDraw ?? 0,
  loanRepayment: m.loanRepayment ?? 0,
  equityInvested: m.equityInvested ?? 0,
}));

export const SEED_DEV_SCENARIOS: Scenario[] = [
  { id: `${PROJECT_ID}-sc-base`, projectId: PROJECT_ID, name: "Base case", kind: "BASE", landPurchasePrice: 642_840, salesPricePerM2: 450, constructionCostPerM2: 1750, infrastructureCost: 441_000, softCostPct: 0, financingRatePct: 0, absorptionRate: 1.5, contingencyPct: 0, developerProfitTargetPct: 20, salesDelayMonths: 0 },
  { id: `${PROJECT_ID}-sc-cons`, projectId: PROJECT_ID, name: "Conservative", kind: "CONSERVATIVE", landPurchasePrice: 642_840, salesPricePerM2: 405, constructionCostPerM2: 1840, infrastructureCost: 485_000, softCostPct: 5, financingRatePct: 6, absorptionRate: 1, contingencyPct: 8, developerProfitTargetPct: 20, salesDelayMonths: 6 },
  { id: `${PROJECT_ID}-sc-opt`, projectId: PROJECT_ID, name: "Optimistic", kind: "OPTIMISTIC", landPurchasePrice: 642_840, salesPricePerM2: 495, constructionCostPerM2: 1660, infrastructureCost: 420_000, softCostPct: 0, financingRatePct: 0, absorptionRate: 2.5, contingencyPct: 0, developerProfitTargetPct: 20, salesDelayMonths: 0 },
];

export const SEED_DEV_DOCUMENTS: DevDocument[] = [
  { id: `${PROJECT_ID}-doc-1`, projectId: PROJECT_ID, kind: "PARCEL_DEED", name: "Parcel deed — Morgenster.pdf", url: null, uploadedAt: "2023-03-05" },
  { id: `${PROJECT_ID}-doc-2`, projectId: PROJECT_ID, kind: "TOPOGRAPHIC_PLAN", name: "Topographic survey.pdf", url: null, uploadedAt: "2023-05-20" },
  { id: `${PROJECT_ID}-doc-3`, projectId: PROJECT_ID, kind: "PARCELING_PLAN", name: "Parceling plan rev C.pdf", url: null, uploadedAt: "2023-09-12" },
  { id: `${PROJECT_ID}-doc-4`, projectId: PROJECT_ID, kind: "APPROVAL", name: "DOW approval letter.pdf", url: null, uploadedAt: "2023-11-02" },
];

export const SEED_DEV_VENDORS: Vendor[] = [
  { id: `${PROJECT_ID}-vnd-1`, projectId: PROJECT_ID, name: "Aruba Civil Works NV", trade: "Roads & drainage", contact: "J. Kock", email: "ops@arubacivil.aw", phone: "+297 583 0011", notes: null },
  { id: `${PROJECT_ID}-vnd-2`, projectId: PROJECT_ID, name: "WEB Aruba", trade: "Water connection", contact: "Connections desk", email: null, phone: "+297 525 4600", notes: "Utility authority" },
  { id: `${PROJECT_ID}-vnd-3`, projectId: PROJECT_ID, name: "ZenArch Consultants", trade: "Architecture & engineering", contact: "O. Farouk", email: "studio@zenarch.aw", phone: null, notes: null },
];

export const SEED_DEV_CONTRACTS: DevContract[] = [
  { id: `${PROJECT_ID}-ct-1`, projectId: PROJECT_ID, contractRef: "C-2023A-038-01", title: "Site infrastructure — roads, drainage, sewage", vendorName: "Aruba Civil Works NV", costCode: 5000, value: 331_000, retentionPct: 10, status: "ACTIVE", startDate: "2024-01-15", endDate: "2024-08-31", notes: null },
  { id: `${PROJECT_ID}-ct-2`, projectId: PROJECT_ID, contractRef: "C-2023A-038-02", title: "Water connection works", vendorName: "WEB Aruba", costCode: 6000, value: 40_000, retentionPct: 0, status: "DRAFT", startDate: null, endDate: null, notes: null },
  { id: `${PROJECT_ID}-ct-3`, projectId: PROJECT_ID, contractRef: "C-2023A-038-03", title: "Design & engineering services", vendorName: "ZenArch Consultants", costCode: 4000, value: 340_000, retentionPct: 0, status: "ACTIVE", startDate: "2023-04-01", endDate: "2024-12-31", notes: null },
];

export const SEED_DEV_INVOICES: DevInvoice[] = [
  { id: `${PROJECT_ID}-inv-1`, projectId: PROJECT_ID, invoiceNumber: "INV-ACW-101", contractRef: "C-2023A-038-01", vendorName: "Aruba Civil Works NV", costCode: 5000, amount: 150_000, status: "PAID", dateIssued: "2024-03-05", dateDue: "2024-04-05" },
  { id: `${PROJECT_ID}-inv-2`, projectId: PROJECT_ID, invoiceNumber: "INV-ACW-102", contractRef: "C-2023A-038-01", vendorName: "Aruba Civil Works NV", costCode: 5000, amount: 90_000, status: "APPROVED", dateIssued: "2024-05-10", dateDue: "2024-06-10" },
  { id: `${PROJECT_ID}-inv-3`, projectId: PROJECT_ID, invoiceNumber: "INV-ZA-044", contractRef: "C-2023A-038-03", vendorName: "ZenArch Consultants", costCode: 4000, amount: 180_000, status: "PAID", dateIssued: "2023-11-30", dateDue: "2023-12-30" },
  { id: `${PROJECT_ID}-inv-4`, projectId: PROJECT_ID, invoiceNumber: "INV-ZA-051", contractRef: "C-2023A-038-03", vendorName: "ZenArch Consultants", costCode: 4000, amount: 70_000, status: "SUBMITTED", dateIssued: "2024-06-01", dateDue: "2024-07-01" },
];

export const SEED_DEV_PAYMENTS: DevPayment[] = [
  { id: `${PROJECT_ID}-pay-1`, projectId: PROJECT_ID, invoiceNumber: "INV-ACW-101", vendorName: "Aruba Civil Works NV", amount: 150_000, method: "Bank transfer", reference: "FT24030512", datePaid: "2024-03-20" },
  { id: `${PROJECT_ID}-pay-2`, projectId: PROJECT_ID, invoiceNumber: "INV-ZA-044", vendorName: "ZenArch Consultants", amount: 180_000, method: "Bank transfer", reference: "FT23120104", datePaid: "2023-12-15" },
];

export const SEED_DEV_RESERVATIONS: BuyerReservation[] = [
  { id: `${PROJECT_ID}-res-1`, projectId: PROJECT_ID, lotNumber: "L-05", buyerName: "Familia Croes", contact: "croes@example.aw", broker: "Caribbean Realty", depositAmount: 15_300, status: "ACTIVE", reservationDate: "2024-04-15", expiryDate: "2024-07-15", notes: null },
  { id: `${PROJECT_ID}-res-2`, projectId: PROJECT_ID, lotNumber: "L-06", buyerName: "Tromp Holding", contact: "info@tromp.aw", broker: "Island Properties", depositAmount: 15_075, status: "ACTIVE", reservationDate: "2024-04-20", expiryDate: "2024-07-20", notes: null },
];

export const SEED_DEV_SALES_CONTRACTS: SalesContract[] = [
  { id: `${PROJECT_ID}-sc-1`, projectId: PROJECT_ID, contractNumber: "SC-2023A-038-01", lotNumber: "L-01", buyerName: "Buyer 1", salePrice: 162_000, depositPaid: 32_400, status: "SIGNED", signedDate: "2024-05-10", closingDate: null, notes: null },
  { id: `${PROJECT_ID}-sc-2`, projectId: PROJECT_ID, contractNumber: "SC-2023A-038-02", lotNumber: "L-02", buyerName: "Buyer 2", salePrice: 157_500, depositPaid: 31_500, status: "SIGNED", signedDate: "2024-05-12", closingDate: null, notes: null },
];

/** All Morgenster seed rows in one bundle (used by the data layer + prisma seed). */
export const SEED_DEVELOPMENT = {
  project: SEED_DEV_PROJECT,
  acquisition: SEED_DEV_ACQUISITION,
  landUse: SEED_DEV_LAND_USE,
  lots: SEED_DEV_LOTS,
  unitTypes: SEED_DEV_UNIT_TYPES,
  budget: SEED_DEV_BUDGET,
  permits: SEED_DEV_PERMITS,
  leads: SEED_DEV_LEADS,
  cashFlow: SEED_DEV_CASHFLOW,
  scenarios: SEED_DEV_SCENARIOS,
  documents: SEED_DEV_DOCUMENTS,
  vendors: SEED_DEV_VENDORS,
  contracts: SEED_DEV_CONTRACTS,
  invoices: SEED_DEV_INVOICES,
  payments: SEED_DEV_PAYMENTS,
  reservations: SEED_DEV_RESERVATIONS,
  salesContracts: SEED_DEV_SALES_CONTRACTS,
};
