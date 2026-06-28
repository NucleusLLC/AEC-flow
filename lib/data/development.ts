/**
 * Land Development / Parceling — server data layer (Prisma-first, seed fallback).
 *
 * Reads go through Prisma; on ANY failure (e.g. paused Supabase, P1001) they
 * degrade to the Morgenster demo seed (lib/development/seed-data.ts) so the UI
 * works offline, exactly like the Construction-Admin module. This file is
 * server-only (imports `@/lib/db`); client components import the calc engine
 * (`@/lib/development/calc`) and types (`@/lib/data/development.types`) instead.
 */
import { prisma } from "@/lib/db";
import { SEED_DEVELOPMENT } from "@/lib/development/seed-data";
import { computeLandUse, computeFeasibility, rollupLots, sum } from "@/lib/development/calc";
import type {
  DevelopmentProject,
  DevelopmentProjectFull,
  DevelopmentProjectListItem,
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

/* ── helpers ─────────────────────────────────────────────────────────────── */

async function devRead<T>(query: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.warn("[development] DB read failed — serving seed data.", (err as Error)?.message);
    return fallback();
  }
}

const num = (v: unknown): number => (v == null ? 0 : typeof v === "number" ? v : Number((v as { toString(): string }).toString()));
const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const ymdReq = (d: Date): string => d.toISOString().slice(0, 10);

/** The per-net-m² project cost that drives lot cost allocation. */
export function projectCostPerNetM2(full: DevelopmentProjectFull): number {
  const netSellable = full.landUse
    ? computeLandUse({ ...full.landUse }).netSellableLand
    : 0;
  const totalCost = sum(full.budget.map((b) => b.budget));
  return netSellable ? totalCost / netSellable : 0;
}

/* ── row → DTO mappers ───────────────────────────────────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */

function projectDto(r: any): DevelopmentProject {
  return {
    id: r.id,
    projectNumber: r.projectNumber,
    name: r.name,
    location: r.location,
    clientOwner: r.clientOwner,
    developer: r.developer,
    status: r.status,
    currency: r.currency,
    totalParcelArea: r.totalParcelArea,
    zoningClassification: r.zoningClassification,
    ropvArticleRef: r.ropvArticleRef,
    propertyType: r.propertyType,
    projectType: r.projectType,
    startDate: ymd(r.startDate),
    targetPermitDate: ymd(r.targetPermitDate),
    targetInfraDate: ymd(r.targetInfraDate),
    targetSalesLaunchDate: ymd(r.targetSalesLaunchDate),
    targetCloseoutDate: ymd(r.targetCloseoutDate),
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

function acquisitionDto(r: any): LandAcquisition {
  return {
    id: r.id, projectId: r.projectId,
    parcelAcquisitionCost: num(r.parcelAcquisitionCost), transferTax: num(r.transferTax),
    notaryCost: num(r.notaryCost), kadasterCost: num(r.kadasterCost), brokerCommission: num(r.brokerCommission),
    dueDiligence: num(r.dueDiligence), appraisal: num(r.appraisal), topographicSurvey: num(r.topographicSurvey),
    parcelingSurvey: num(r.parcelingSurvey), meetbrieven: num(r.meetbrieven), legalSetup: num(r.legalSetup),
    companySetup: num(r.companySetup), taxAdvisor: num(r.taxAdvisor), financingSetup: num(r.financingSetup),
    bankGuarantee: num(r.bankGuarantee), contingencyPct: r.contingencyPct,
  };
}

function landUseDto(r: any): LandUseAllocation {
  return {
    id: r.id, projectId: r.projectId, grossParcelArea: r.grossParcelArea, roadArea: r.roadArea,
    sidewalkArea: r.sidewalkArea, greenArea: r.greenArea, utilityArea: r.utilityArea, drainageArea: r.drainageArea,
    commonArea: r.commonArea, poolDeckArea: r.poolDeckArea, retainedOwnerArea: r.retainedOwnerArea,
    otherNonSellableArea: r.otherNonSellableArea, requiredGreenPct: r.requiredGreenPct, requiredRoadPct: r.requiredRoadPct,
  };
}

function lotDto(r: any): LotInventory {
  return {
    id: r.id, projectId: r.projectId, lotNumber: r.lotNumber, phase: r.phase, block: r.block,
    lotType: r.lotType, areaM2: r.areaM2, frontage: r.frontage, depth: r.depth, cornerLot: r.cornerLot,
    viewPremium: r.viewPremium, baseLandPricePerM2: num(r.baseLandPricePerM2),
    premiumAdjustmentPerM2: num(r.premiumAdjustmentPerM2), allocatedLandCost: num(r.allocatedLandCost),
    allocatedInfraCost: num(r.allocatedInfraCost), allocatedSoftCost: num(r.allocatedSoftCost), status: r.status,
    buyerName: r.buyerName, broker: r.broker, reservationDate: ymd(r.reservationDate),
    agreementDate: ymd(r.agreementDate), closingDate: ymd(r.closingDate), depositPct: r.depositPct,
    paymentStatus: r.paymentStatus, notes: r.notes,
  };
}

function unitTypeDto(r: any): UnitType {
  return {
    id: r.id, projectId: r.projectId, name: r.name, quantity: r.quantity,
    components: (r.components ?? []).map((c: any) => ({
      id: c.id, unitTypeId: c.unitTypeId, name: c.name, area: c.area,
      constructionCostPerM2: num(c.constructionCostPerM2), salesPricePerM2: num(c.salesPricePerM2), sortOrder: c.sortOrder,
    })),
  };
}

function budgetDto(r: any): InfrastructureBudget {
  return {
    id: r.id, projectId: r.projectId, costCode: r.costCode, category: r.category, item: r.item,
    quantity: r.quantity, unit: r.unit, unitRate: num(r.unitRate), budget: num(r.budget),
    committed: num(r.committed), actualPaid: num(r.actualPaid), vendor: r.vendor,
    contractRef: r.contractRef, invoiceRef: r.invoiceRef, status: r.status,
  };
}

function permitDto(r: any): PermitTask {
  return {
    id: r.id, projectId: r.projectId, name: r.name, responsible: r.responsible, startDate: ymd(r.startDate),
    dueDate: ymd(r.dueDate), completedDate: ymd(r.completedDate), status: r.status, dependency: r.dependency,
    riskLevel: r.riskLevel, notes: r.notes, sortOrder: r.sortOrder,
  };
}

function leadDto(r: any): SalesLead {
  return {
    id: r.id, projectId: r.projectId, name: r.name, contact: r.contact, source: r.source,
    interestedLot: r.interestedLot, budget: num(r.budget), financingStatus: r.financingStatus, status: r.status,
    depositReceived: num(r.depositReceived), contractSigned: r.contractSigned, broker: r.broker,
    commissionPct: r.commissionPct, followUpDate: ymd(r.followUpDate), notes: r.notes,
  };
}

function cashFlowDto(r: any): CashFlowMonth {
  return {
    id: r.id, projectId: r.projectId, month: r.month, acquisitionCost: num(r.acquisitionCost),
    consultantCost: num(r.consultantCost), permitCost: num(r.permitCost), infrastructureCost: num(r.infrastructureCost),
    constructionCost: num(r.constructionCost), marketingCost: num(r.marketingCost), financingCost: num(r.financingCost),
    salesIncome: num(r.salesIncome), depositIncome: num(r.depositIncome), loanDraw: num(r.loanDraw),
    loanRepayment: num(r.loanRepayment), equityInvested: num(r.equityInvested),
  };
}

function scenarioDto(r: any): Scenario {
  return {
    id: r.id, projectId: r.projectId, name: r.name, kind: r.kind, landPurchasePrice: num(r.landPurchasePrice),
    salesPricePerM2: num(r.salesPricePerM2), constructionCostPerM2: num(r.constructionCostPerM2),
    infrastructureCost: num(r.infrastructureCost), softCostPct: r.softCostPct, financingRatePct: r.financingRatePct,
    absorptionRate: r.absorptionRate, contingencyPct: r.contingencyPct,
    developerProfitTargetPct: r.developerProfitTargetPct, salesDelayMonths: r.salesDelayMonths,
  };
}

function documentDto(r: any): DevDocument {
  return { id: r.id, projectId: r.projectId, kind: r.kind, name: r.name, url: r.url, uploadedAt: ymdReq(r.uploadedAt) };
}

function vendorDto(r: any): Vendor {
  return { id: r.id, projectId: r.projectId, name: r.name, trade: r.trade, contact: r.contact, email: r.email, phone: r.phone, notes: r.notes };
}
function contractDto(r: any): DevContract {
  return { id: r.id, projectId: r.projectId, contractRef: r.contractRef, title: r.title, vendorName: r.vendorName, costCode: r.costCode, value: num(r.value), retentionPct: r.retentionPct, status: r.status, startDate: ymd(r.startDate), endDate: ymd(r.endDate), notes: r.notes };
}
function invoiceDto(r: any): DevInvoice {
  return { id: r.id, projectId: r.projectId, invoiceNumber: r.invoiceNumber, contractRef: r.contractRef, vendorName: r.vendorName, costCode: r.costCode, amount: num(r.amount), status: r.status, dateIssued: ymd(r.dateIssued), dateDue: ymd(r.dateDue) };
}
function paymentDto(r: any): DevPayment {
  return { id: r.id, projectId: r.projectId, invoiceNumber: r.invoiceNumber, vendorName: r.vendorName, amount: num(r.amount), method: r.method, reference: r.reference, datePaid: ymd(r.datePaid) };
}
function reservationDto(r: any): BuyerReservation {
  return { id: r.id, projectId: r.projectId, lotNumber: r.lotNumber, buyerName: r.buyerName, contact: r.contact, broker: r.broker, depositAmount: num(r.depositAmount), status: r.status, reservationDate: ymd(r.reservationDate), expiryDate: ymd(r.expiryDate), notes: r.notes };
}
function salesContractDto(r: any): SalesContract {
  return { id: r.id, projectId: r.projectId, contractNumber: r.contractNumber, lotNumber: r.lotNumber, buyerName: r.buyerName, salePrice: num(r.salePrice), depositPaid: num(r.depositPaid), status: r.status, signedDate: ymd(r.signedDate), closingDate: ymd(r.closingDate), notes: r.notes };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── derived list metrics (calc engine) ──────────────────────────────────── */

function toListItem(full: DevelopmentProjectFull): DevelopmentProjectListItem {
  const landUse = full.landUse;
  const netSellableLand = landUse
    ? computeLandUse({ ...landUse, lotCount: full.lots.length }).netSellableLand
    : 0;
  const totalProjectCost = sum(full.budget.map((b) => b.budget));
  const costPerM2 = netSellableLand ? totalProjectCost / netSellableLand : 0;
  const lots = rollupLots(
    full.lots.map((l) => ({
      areaM2: l.areaM2,
      baseLandPricePerM2: l.baseLandPricePerM2,
      premiumAdjustmentPerM2: l.premiumAdjustmentPerM2,
      allocatedCostPerM2: costPerM2,
    })),
  );
  const feas = computeFeasibility({ totalProjectCost, totalRevenue: lots.totalRevenue, netSellableLand });
  return {
    id: full.id,
    projectNumber: full.projectNumber,
    name: full.name,
    location: full.location,
    status: full.status,
    projectType: full.projectType,
    currency: full.currency,
    totalParcelArea: full.totalParcelArea,
    netSellableLand,
    totalLots: full.lots.length,
    totalProjectCost,
    totalRevenue: lots.totalRevenue,
    totalProfit: feas.grossProfit,
    roiPct: feas.roiPct,
  };
}

/* ── public reads ────────────────────────────────────────────────────────── */

/** The Morgenster seed assembled as a full DTO bundle (offline fallback). */
function seedFull(): DevelopmentProjectFull {
  const s = SEED_DEVELOPMENT;
  return {
    ...s.project,
    acquisition: s.acquisition,
    landUse: s.landUse,
    lots: s.lots,
    unitTypes: s.unitTypes,
    budget: s.budget,
    permits: s.permits,
    leads: s.leads,
    cashFlow: s.cashFlow,
    scenarios: s.scenarios,
    documents: s.documents,
    vendors: s.vendors,
    contracts: s.contracts,
    invoices: s.invoices,
    payments: s.payments,
    reservations: s.reservations,
    salesContracts: s.salesContracts,
  };
}

export async function getDevelopmentProject(id: string): Promise<DevelopmentProjectFull | null> {
  return devRead(
    async () => {
      const p = await prisma.developmentProject.findFirst({ where: { OR: [{ id }, { projectNumber: id }] } });
      if (!p) return null;
      const pid = p.id;
      const [acq, land, lots, unitTypes, budget, permits, leads, cashFlow, scenarios, documents, vendors, contracts, invoices, payments, reservations, salesContracts] = await Promise.all([
        prisma.landAcquisition.findUnique({ where: { projectId: pid } }),
        prisma.landUseAllocation.findUnique({ where: { projectId: pid } }),
        prisma.lotInventory.findMany({ where: { projectId: pid }, orderBy: { lotNumber: "asc" } }),
        prisma.unitType.findMany({ where: { projectId: pid }, include: { components: { orderBy: { sortOrder: "asc" } } } }),
        prisma.infrastructureBudget.findMany({ where: { projectId: pid }, orderBy: { costCode: "asc" } }),
        prisma.permitTask.findMany({ where: { projectId: pid }, orderBy: { sortOrder: "asc" } }),
        prisma.salesLead.findMany({ where: { projectId: pid } }),
        prisma.cashFlowMonth.findMany({ where: { projectId: pid }, orderBy: { month: "asc" } }),
        prisma.devScenario.findMany({ where: { projectId: pid } }),
        prisma.devDocument.findMany({ where: { projectId: pid }, orderBy: { uploadedAt: "desc" } }),
        prisma.vendor.findMany({ where: { projectId: pid }, orderBy: { name: "asc" } }),
        prisma.devContract.findMany({ where: { projectId: pid }, orderBy: { contractRef: "asc" } }),
        prisma.devInvoice.findMany({ where: { projectId: pid }, orderBy: { dateIssued: "asc" } }),
        prisma.devPayment.findMany({ where: { projectId: pid }, orderBy: { datePaid: "asc" } }),
        prisma.buyerReservation.findMany({ where: { projectId: pid }, orderBy: { reservationDate: "desc" } }),
        prisma.salesContract.findMany({ where: { projectId: pid }, orderBy: { contractNumber: "asc" } }),
      ]);
      return {
        ...projectDto(p),
        acquisition: acq ? acquisitionDto(acq) : null,
        landUse: land ? landUseDto(land) : null,
        lots: lots.map(lotDto),
        unitTypes: unitTypes.map(unitTypeDto),
        budget: budget.map(budgetDto),
        permits: permits.map(permitDto),
        leads: leads.map(leadDto),
        cashFlow: cashFlow.map(cashFlowDto),
        scenarios: scenarios.map(scenarioDto),
        documents: documents.map(documentDto),
        vendors: vendors.map(vendorDto),
        contracts: contracts.map(contractDto),
        invoices: invoices.map(invoiceDto),
        payments: payments.map(paymentDto),
        reservations: reservations.map(reservationDto),
        salesContracts: salesContracts.map(salesContractDto),
      } satisfies DevelopmentProjectFull;
    },
    () => {
      const full = seedFull();
      return full.id === id || full.projectNumber === id ? full : null;
    },
  );
}

export async function listDevelopmentProjects(): Promise<DevelopmentProjectListItem[]> {
  return devRead(
    async () => {
      const rows = await prisma.developmentProject.findMany({ orderBy: { createdAt: "desc" } });
      const full = await Promise.all(rows.map((r) => getDevelopmentProject(r.id)));
      return full.filter((f): f is DevelopmentProjectFull => f != null).map(toListItem);
    },
    () => [toListItem(seedFull())],
  );
}

/** Lightweight options for the project selector. */
export async function getDevelopmentProjectOptions(): Promise<Array<{ id: string; name: string; projectNumber: string }>> {
  const list = await listDevelopmentProjects();
  return list.map((p) => ({ id: p.id, name: p.name, projectNumber: p.projectNumber }));
}

/* ── writes ──────────────────────────────────────────────────────────────── *
 * No seed fallback: if the DB is unreachable the error propagates so the API
 * returns 503 (a write must never silently no-op). Editable tables save by full
 * replace inside a transaction; singletons (land use, acquisition) upsert.       */

const toDate = (s: string | null | undefined): Date | null => (s ? new Date(s) : null);

/** Resolve a route param (id OR projectNumber) to the real project id. */
async function resolveProjectId(idOrNumber: string): Promise<string | null> {
  const p = await prisma.developmentProject.findFirst({
    where: { OR: [{ id: idOrNumber }, { projectNumber: idOrNumber }] },
    select: { id: true },
  });
  return p?.id ?? null;
}

export async function updateDevProject(idOrNumber: string, patch: Partial<DevelopmentProject>): Promise<void> {
  const id = await resolveProjectId(idOrNumber);
  if (!id) throw new Error("Project not found");
  await prisma.developmentProject.update({
    where: { id },
    data: {
      name: patch.name, location: patch.location, clientOwner: patch.clientOwner, developer: patch.developer,
      status: patch.status, currency: patch.currency, totalParcelArea: patch.totalParcelArea,
      zoningClassification: patch.zoningClassification, ropvArticleRef: patch.ropvArticleRef,
      propertyType: patch.propertyType, projectType: patch.projectType,
      startDate: toDate(patch.startDate), targetPermitDate: toDate(patch.targetPermitDate),
      targetInfraDate: toDate(patch.targetInfraDate), targetSalesLaunchDate: toDate(patch.targetSalesLaunchDate),
      targetCloseoutDate: toDate(patch.targetCloseoutDate),
    },
  });
}

export async function saveLandAndAcquisition(idOrNumber: string, landUse: LandUseAllocation, acquisition: LandAcquisition): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  const landData = {
    grossParcelArea: landUse.grossParcelArea, roadArea: landUse.roadArea, sidewalkArea: landUse.sidewalkArea,
    greenArea: landUse.greenArea, utilityArea: landUse.utilityArea, drainageArea: landUse.drainageArea,
    commonArea: landUse.commonArea, poolDeckArea: landUse.poolDeckArea, retainedOwnerArea: landUse.retainedOwnerArea,
    otherNonSellableArea: landUse.otherNonSellableArea, requiredGreenPct: landUse.requiredGreenPct, requiredRoadPct: landUse.requiredRoadPct,
  };
  const acqData = {
    parcelAcquisitionCost: acquisition.parcelAcquisitionCost, transferTax: acquisition.transferTax, notaryCost: acquisition.notaryCost,
    kadasterCost: acquisition.kadasterCost, brokerCommission: acquisition.brokerCommission, dueDiligence: acquisition.dueDiligence,
    appraisal: acquisition.appraisal, topographicSurvey: acquisition.topographicSurvey, parcelingSurvey: acquisition.parcelingSurvey,
    meetbrieven: acquisition.meetbrieven, legalSetup: acquisition.legalSetup, companySetup: acquisition.companySetup,
    taxAdvisor: acquisition.taxAdvisor, financingSetup: acquisition.financingSetup, bankGuarantee: acquisition.bankGuarantee,
    contingencyPct: acquisition.contingencyPct,
  };
  await prisma.$transaction([
    prisma.landUseAllocation.upsert({ where: { projectId }, update: landData, create: { projectId, ...landData } }),
    prisma.landAcquisition.upsert({ where: { projectId }, update: acqData, create: { projectId, ...acqData } }),
  ]);
}

export async function saveLots(idOrNumber: string, lots: LotInventory[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.lotInventory.deleteMany({ where: { projectId } }),
    prisma.lotInventory.createMany({
      data: lots.map((l) => ({
        id: l.id, projectId, lotNumber: l.lotNumber, phase: l.phase, block: l.block, lotType: l.lotType,
        areaM2: l.areaM2, frontage: l.frontage, depth: l.depth, cornerLot: l.cornerLot, viewPremium: l.viewPremium,
        baseLandPricePerM2: l.baseLandPricePerM2, premiumAdjustmentPerM2: l.premiumAdjustmentPerM2,
        allocatedLandCost: l.allocatedLandCost, allocatedInfraCost: l.allocatedInfraCost, allocatedSoftCost: l.allocatedSoftCost,
        status: l.status, buyerName: l.buyerName, broker: l.broker, reservationDate: toDate(l.reservationDate),
        agreementDate: toDate(l.agreementDate), closingDate: toDate(l.closingDate), depositPct: l.depositPct,
        paymentStatus: l.paymentStatus, notes: l.notes,
      })),
    }),
  ]);
}

export async function saveBudget(idOrNumber: string, lines: InfrastructureBudget[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.infrastructureBudget.deleteMany({ where: { projectId } }),
    prisma.infrastructureBudget.createMany({
      data: lines.map((b) => ({
        id: b.id, projectId, costCode: b.costCode, category: b.category, item: b.item, quantity: b.quantity,
        unit: b.unit, unitRate: b.unitRate, budget: b.budget, committed: b.committed, actualPaid: b.actualPaid,
        vendor: b.vendor, contractRef: b.contractRef, invoiceRef: b.invoiceRef, status: b.status,
      })),
    }),
  ]);
}

export async function saveCashFlow(idOrNumber: string, months: CashFlowMonth[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.cashFlowMonth.deleteMany({ where: { projectId } }),
    prisma.cashFlowMonth.createMany({
      data: months.map((m) => ({
        id: m.id, projectId, month: m.month, acquisitionCost: m.acquisitionCost, consultantCost: m.consultantCost,
        permitCost: m.permitCost, infrastructureCost: m.infrastructureCost, constructionCost: m.constructionCost,
        marketingCost: m.marketingCost, financingCost: m.financingCost, salesIncome: m.salesIncome,
        depositIncome: m.depositIncome, loanDraw: m.loanDraw, loanRepayment: m.loanRepayment, equityInvested: m.equityInvested,
      })),
    }),
  ]);
}

export async function savePermits(idOrNumber: string, permits: PermitTask[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.permitTask.deleteMany({ where: { projectId } }),
    prisma.permitTask.createMany({
      data: permits.map((p) => ({
        id: p.id, projectId, name: p.name, responsible: p.responsible, startDate: toDate(p.startDate),
        dueDate: toDate(p.dueDate), completedDate: toDate(p.completedDate), status: p.status,
        dependency: p.dependency, riskLevel: p.riskLevel, notes: p.notes, sortOrder: p.sortOrder,
      })),
    }),
  ]);
}

export async function saveDocuments(idOrNumber: string, documents: DevDocument[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.devDocument.deleteMany({ where: { projectId } }),
    prisma.devDocument.createMany({
      data: documents.map((d) => ({
        id: d.id, projectId, kind: d.kind, name: d.name, url: d.url,
        uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date(),
      })),
    }),
  ]);
}

export async function saveVendors(idOrNumber: string, vendors: Vendor[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.vendor.deleteMany({ where: { projectId } }),
    prisma.vendor.createMany({ data: vendors.map((v) => ({ id: v.id, projectId, name: v.name, trade: v.trade, contact: v.contact, email: v.email, phone: v.phone, notes: v.notes })) }),
  ]);
}

export async function saveContracts(idOrNumber: string, contracts: DevContract[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.devContract.deleteMany({ where: { projectId } }),
    prisma.devContract.createMany({ data: contracts.map((c) => ({ id: c.id, projectId, contractRef: c.contractRef, title: c.title, vendorName: c.vendorName, costCode: c.costCode, value: c.value, retentionPct: c.retentionPct, status: c.status, startDate: toDate(c.startDate), endDate: toDate(c.endDate), notes: c.notes })) }),
  ]);
}

export async function saveInvoices(idOrNumber: string, invoices: DevInvoice[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.devInvoice.deleteMany({ where: { projectId } }),
    prisma.devInvoice.createMany({ data: invoices.map((i) => ({ id: i.id, projectId, invoiceNumber: i.invoiceNumber, contractRef: i.contractRef, vendorName: i.vendorName, costCode: i.costCode, amount: i.amount, status: i.status, dateIssued: toDate(i.dateIssued), dateDue: toDate(i.dateDue) })) }),
  ]);
}

export async function savePayments(idOrNumber: string, payments: DevPayment[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.devPayment.deleteMany({ where: { projectId } }),
    prisma.devPayment.createMany({ data: payments.map((p) => ({ id: p.id, projectId, invoiceNumber: p.invoiceNumber, vendorName: p.vendorName, amount: p.amount, method: p.method, reference: p.reference, datePaid: toDate(p.datePaid) })) }),
  ]);
}

export async function saveReservations(idOrNumber: string, reservations: BuyerReservation[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.buyerReservation.deleteMany({ where: { projectId } }),
    prisma.buyerReservation.createMany({ data: reservations.map((r) => ({ id: r.id, projectId, lotNumber: r.lotNumber, buyerName: r.buyerName, contact: r.contact, broker: r.broker, depositAmount: r.depositAmount, status: r.status, reservationDate: toDate(r.reservationDate), expiryDate: toDate(r.expiryDate), notes: r.notes })) }),
  ]);
}

export async function saveSalesContracts(idOrNumber: string, salesContracts: SalesContract[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.salesContract.deleteMany({ where: { projectId } }),
    prisma.salesContract.createMany({ data: salesContracts.map((c) => ({ id: c.id, projectId, contractNumber: c.contractNumber, lotNumber: c.lotNumber, buyerName: c.buyerName, salePrice: c.salePrice, depositPaid: c.depositPaid, status: c.status, signedDate: toDate(c.signedDate), closingDate: toDate(c.closingDate), notes: c.notes })) }),
  ]);
}

/** Set a project's status (used by archive / unarchive). */
export async function setDevProjectStatus(idOrNumber: string, status: DevelopmentProject["status"]): Promise<void> {
  const id = await resolveProjectId(idOrNumber);
  if (!id) throw new Error("Project not found");
  await prisma.developmentProject.update({ where: { id }, data: { status } });
}

/** Deep-copy a project and all its children into a new project; returns the new ids. */
export async function duplicateDevelopmentProject(idOrNumber: string): Promise<{ id: string; projectNumber: string }> {
  const src = await getDevelopmentProject(idOrNumber);
  if (!src) throw new Error("Project not found");

  // Unique project number: "<num>-COPY", then -COPY-2, -COPY-3 … if taken.
  const existing = await prisma.developmentProject.findMany({ select: { projectNumber: true } });
  const taken = new Set(existing.map((e) => e.projectNumber));
  let projectNumber = `${src.projectNumber}-COPY`;
  for (let i = 2; taken.has(projectNumber); i++) projectNumber = `${src.projectNumber}-COPY-${i}`;

  const created = await prisma.developmentProject.create({
    data: {
      projectNumber, name: `${src.name} (Copy)`, location: src.location, clientOwner: src.clientOwner,
      developer: src.developer, status: "PLANNING", currency: src.currency, totalParcelArea: src.totalParcelArea,
      zoningClassification: src.zoningClassification, ropvArticleRef: src.ropvArticleRef,
      propertyType: src.propertyType, projectType: src.projectType,
      startDate: toDate(src.startDate), targetPermitDate: toDate(src.targetPermitDate),
      targetInfraDate: toDate(src.targetInfraDate), targetSalesLaunchDate: toDate(src.targetSalesLaunchDate),
      targetCloseoutDate: toDate(src.targetCloseoutDate),
    },
    select: { id: true, projectNumber: true },
  });
  const pid = created.id;

  // Re-create children with fresh ids (omit id → Prisma generates a cuid).
  const ops: Promise<unknown>[] = [];
  if (src.acquisition) {
    const { id: _i, projectId: _p, ...a } = src.acquisition;
    void _i; void _p;
    ops.push(prisma.landAcquisition.create({ data: { projectId: pid, ...a } }));
  }
  if (src.landUse) {
    const { id: _i, projectId: _p, ...l } = src.landUse;
    void _i; void _p;
    ops.push(prisma.landUseAllocation.create({ data: { projectId: pid, ...l } }));
  }
  if (src.lots.length) {
    ops.push(prisma.lotInventory.createMany({
      data: src.lots.map((l) => ({
        projectId: pid, lotNumber: l.lotNumber, phase: l.phase, block: l.block, lotType: l.lotType, areaM2: l.areaM2,
        frontage: l.frontage, depth: l.depth, cornerLot: l.cornerLot, viewPremium: l.viewPremium,
        baseLandPricePerM2: l.baseLandPricePerM2, premiumAdjustmentPerM2: l.premiumAdjustmentPerM2,
        allocatedLandCost: l.allocatedLandCost, allocatedInfraCost: l.allocatedInfraCost, allocatedSoftCost: l.allocatedSoftCost,
        status: l.status, buyerName: l.buyerName, broker: l.broker, reservationDate: toDate(l.reservationDate),
        agreementDate: toDate(l.agreementDate), closingDate: toDate(l.closingDate), depositPct: l.depositPct,
        paymentStatus: l.paymentStatus, notes: l.notes,
      })),
    }));
  }
  for (const u of src.unitTypes) {
    ops.push(prisma.unitType.create({
      data: {
        projectId: pid, name: u.name, quantity: u.quantity,
        components: { create: u.components.map((c) => ({ name: c.name, area: c.area, constructionCostPerM2: c.constructionCostPerM2, salesPricePerM2: c.salesPricePerM2, sortOrder: c.sortOrder })) },
      },
    }));
  }
  if (src.budget.length) {
    ops.push(prisma.infrastructureBudget.createMany({
      data: src.budget.map((b) => ({ projectId: pid, costCode: b.costCode, category: b.category, item: b.item, quantity: b.quantity, unit: b.unit, unitRate: b.unitRate, budget: b.budget, committed: b.committed, actualPaid: b.actualPaid, vendor: b.vendor, contractRef: b.contractRef, invoiceRef: b.invoiceRef, status: b.status })),
    }));
  }
  if (src.permits.length) {
    ops.push(prisma.permitTask.createMany({
      data: src.permits.map((t) => ({ projectId: pid, name: t.name, responsible: t.responsible, startDate: toDate(t.startDate), dueDate: toDate(t.dueDate), completedDate: toDate(t.completedDate), status: t.status, dependency: t.dependency, riskLevel: t.riskLevel, notes: t.notes, sortOrder: t.sortOrder })),
    }));
  }
  if (src.leads.length) {
    ops.push(prisma.salesLead.createMany({
      data: src.leads.map((l) => ({ projectId: pid, name: l.name, contact: l.contact, source: l.source, interestedLot: l.interestedLot, budget: l.budget, financingStatus: l.financingStatus, status: l.status, depositReceived: l.depositReceived, contractSigned: l.contractSigned, broker: l.broker, commissionPct: l.commissionPct, followUpDate: toDate(l.followUpDate), notes: l.notes })),
    }));
  }
  if (src.cashFlow.length) {
    ops.push(prisma.cashFlowMonth.createMany({
      data: src.cashFlow.map((m) => ({ projectId: pid, month: m.month, acquisitionCost: m.acquisitionCost, consultantCost: m.consultantCost, permitCost: m.permitCost, infrastructureCost: m.infrastructureCost, constructionCost: m.constructionCost, marketingCost: m.marketingCost, financingCost: m.financingCost, salesIncome: m.salesIncome, depositIncome: m.depositIncome, loanDraw: m.loanDraw, loanRepayment: m.loanRepayment, equityInvested: m.equityInvested })),
    }));
  }
  if (src.scenarios.length) {
    ops.push(prisma.devScenario.createMany({
      data: src.scenarios.map((s) => ({ projectId: pid, name: s.name, kind: s.kind, landPurchasePrice: s.landPurchasePrice, salesPricePerM2: s.salesPricePerM2, constructionCostPerM2: s.constructionCostPerM2, infrastructureCost: s.infrastructureCost, softCostPct: s.softCostPct, financingRatePct: s.financingRatePct, absorptionRate: s.absorptionRate, contingencyPct: s.contingencyPct, developerProfitTargetPct: s.developerProfitTargetPct, salesDelayMonths: s.salesDelayMonths })),
    }));
  }
  if (src.documents.length) {
    ops.push(prisma.devDocument.createMany({ data: src.documents.map((d) => ({ projectId: pid, kind: d.kind, name: d.name, url: d.url, uploadedAt: toDate(d.uploadedAt) ?? new Date() })) }));
  }
  if (src.vendors.length) {
    ops.push(prisma.vendor.createMany({ data: src.vendors.map((v) => ({ projectId: pid, name: v.name, trade: v.trade, contact: v.contact, email: v.email, phone: v.phone, notes: v.notes })) }));
  }
  if (src.contracts.length) {
    ops.push(prisma.devContract.createMany({ data: src.contracts.map((c) => ({ projectId: pid, contractRef: c.contractRef, title: c.title, vendorName: c.vendorName, costCode: c.costCode, value: c.value, retentionPct: c.retentionPct, status: c.status, startDate: toDate(c.startDate), endDate: toDate(c.endDate), notes: c.notes })) }));
  }
  if (src.invoices.length) {
    ops.push(prisma.devInvoice.createMany({ data: src.invoices.map((i) => ({ projectId: pid, invoiceNumber: i.invoiceNumber, contractRef: i.contractRef, vendorName: i.vendorName, costCode: i.costCode, amount: i.amount, status: i.status, dateIssued: toDate(i.dateIssued), dateDue: toDate(i.dateDue) })) }));
  }
  if (src.payments.length) {
    ops.push(prisma.devPayment.createMany({ data: src.payments.map((p) => ({ projectId: pid, invoiceNumber: p.invoiceNumber, vendorName: p.vendorName, amount: p.amount, method: p.method, reference: p.reference, datePaid: toDate(p.datePaid) })) }));
  }
  if (src.reservations.length) {
    ops.push(prisma.buyerReservation.createMany({ data: src.reservations.map((r) => ({ projectId: pid, lotNumber: r.lotNumber, buyerName: r.buyerName, contact: r.contact, broker: r.broker, depositAmount: r.depositAmount, status: r.status, reservationDate: toDate(r.reservationDate), expiryDate: toDate(r.expiryDate), notes: r.notes })) }));
  }
  if (src.salesContracts.length) {
    ops.push(prisma.salesContract.createMany({ data: src.salesContracts.map((c) => ({ projectId: pid, contractNumber: c.contractNumber, lotNumber: c.lotNumber, buyerName: c.buyerName, salePrice: c.salePrice, depositPaid: c.depositPaid, status: c.status, signedDate: toDate(c.signedDate), closingDate: toDate(c.closingDate), notes: c.notes })) }));
  }
  await Promise.all(ops);
  return created;
}

export async function saveUnits(idOrNumber: string, unitTypes: UnitType[]): Promise<void> {
  const projectId = await resolveProjectId(idOrNumber);
  if (!projectId) throw new Error("Project not found");
  await prisma.$transaction([
    prisma.unitType.deleteMany({ where: { projectId } }), // cascade-deletes components
    ...unitTypes.map((u) =>
      prisma.unitType.create({
        data: {
          id: u.id, projectId, name: u.name, quantity: u.quantity,
          components: {
            create: u.components.map((c) => ({
              id: c.id, name: c.name, area: c.area,
              constructionCostPerM2: c.constructionCostPerM2, salesPricePerM2: c.salesPricePerM2, sortOrder: c.sortOrder,
            })),
          },
        },
      }),
    ),
  ]);
}
