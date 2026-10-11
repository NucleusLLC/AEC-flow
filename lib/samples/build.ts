/**
 * The SAMPLE SET: one coherent sample project that runs through every live
 * module, so a new practice opens each module on a finished example instead of
 * an empty list.
 *
 * PURE. No Prisma client, no session, no clock of its own: the caller hands in
 * the company, the owner, the currency, the language, "today" and an id
 * factory, and gets back the exact rows to insert, in insertion order. That is
 * what lets the unit tests pin the counts, the marking and the arithmetic
 * without a database, and what lets the founder's dry run report what WOULD be
 * created by building the very plan the real run inserts.
 *
 * Every figure a screen recomputes is produced here by the app's own engine
 * (the proposal engine, the estimate calc, the invoice, purchase order, change
 * order and certificate calculators), never typed in, so a stored total can
 * not disagree with the lines under it.
 *
 * HOW A SAMPLE IS MARKED
 *   - every name and title starts with SAMPLE (Spanish set: EJEMPLO);
 *   - every number is on its own series, `SMP-<company token>-<kind>-<letter>`.
 *     The trailing LETTER is load-bearing: each numbering sequence in the app
 *     reads the trailing digits of the existing numbers and adds one, so a
 *     number that ends in a letter is invisible to all of them and the next
 *     real invoice, proposal, order or permit is what it would have been.
 *     The token keeps the globally unique columns (project and construction
 *     administration numbers) apart between companies.
 */
import type { Prisma } from "@prisma/client";
import { parseServiceProposalInput } from "@/lib/proposals/schema/proposal";
import { buildWriteData } from "@/lib/proposals/persist";
import { estimateTotals } from "@/lib/estimates/calc";
import type { CostEstimate as EstimateDto } from "@/lib/data/estimates";
import { invoiceTotals } from "@/lib/finance/calc";
import { poTotals } from "@/lib/procurement/calc";
import type { PurchaseOrderLine } from "@/lib/procurement/types";
import { changeOrderTotal, progressPayment } from "@/lib/ca/calc";
import { deriveProjectProgress } from "@/lib/projects/phases";
import { compose } from "@/lib/general-documents/render";
import { buildSchedule } from "@/lib/contracts/schedule";
import type { ContractBody, ContractFacts } from "@/lib/contracts/types";

import { SAMPLE_MODULES, SAMPLE_NUMBER_PREFIX, SAMPLE_WORD, type SampleCounts, type SampleLang } from "./meta";

export {
  SAMPLE_LANGS,
  SAMPLE_MODULES,
  SAMPLE_NUMBER_PREFIX,
  SAMPLE_SET_VERSION,
  SAMPLE_WORD,
  isSampleLang,
  type SampleCounts,
  type SampleLang,
} from "./meta";

export type SampleBuildInput = {
  companyId: string;
  /** Shown as the firm on the letter and the contract. */
  companyName: string;
  /** 4 to 8 upper-case letters or digits; see `sampleToken`. */
  token: string;
  lang: SampleLang;
  /** The company's configured currency (docs/CURRENCY.md). */
  currency: string;
  /** The user the sample is assigned to: the practice's owner. */
  owner: { id: string; name: string };
  today: Date;
  newId: () => string;
};

/**
 * The rows, keyed by Prisma model (delegate name). Insertion order is the key
 * order of `SAMPLE_MODEL_ORDER`; removal runs it backwards.
 */
export type SamplePlan = {
  client: Prisma.ClientCreateManyInput[];
  clientAddress: Prisma.ClientAddressCreateManyInput[];
  project: Prisma.ProjectCreateManyInput[];
  projectPhase: Prisma.ProjectPhaseCreateManyInput[];
  phaseDependency: Prisma.PhaseDependencyCreateManyInput[];
  phaseAssignment: Prisma.PhaseAssignmentCreateManyInput[];
  serviceProposal: Prisma.ServiceProposalCreateManyInput[];
  serviceProposalDiscipline: Prisma.ServiceProposalDisciplineCreateManyInput[];
  serviceProposalPhase: Prisma.ServiceProposalPhaseCreateManyInput[];
  serviceProposalFeeComponent: Prisma.ServiceProposalFeeComponentCreateManyInput[];
  serviceProposalPaymentMilestone: Prisma.ServiceProposalPaymentMilestoneCreateManyInput[];
  serviceProposalReimbursable: Prisma.ServiceProposalReimbursableCreateManyInput[];
  serviceProposalDiscount: Prisma.ServiceProposalDiscountCreateManyInput[];
  serviceProposalTax: Prisma.ServiceProposalTaxCreateManyInput[];
  serviceProposalStatusHistory: Prisma.ServiceProposalStatusHistoryCreateManyInput[];
  serviceProposalVersion: Prisma.ServiceProposalVersionCreateManyInput[];
  costEstimate: Prisma.CostEstimateCreateManyInput[];
  estimateCategory: Prisma.EstimateCategoryCreateManyInput[];
  estimateItem: Prisma.EstimateItemCreateManyInput[];
  projectSchedule: Prisma.ProjectScheduleCreateManyInput[];
  scheduleTask: Prisma.ScheduleTaskCreateManyInput[];
  task: Prisma.TaskCreateManyInput[];
  meetingMinute: Prisma.MeetingMinuteCreateManyInput[];
  actionItem: Prisma.ActionItemCreateManyInput[];
  buildingPermit: Prisma.BuildingPermitCreateManyInput[];
  buildingPermitSubmission: Prisma.BuildingPermitSubmissionCreateManyInput[];
  buildingPermitMeeting: Prisma.BuildingPermitMeetingCreateManyInput[];
  buildingPermitCorrespondence: Prisma.BuildingPermitCorrespondenceCreateManyInput[];
  buildingPermitApproval: Prisma.BuildingPermitApprovalCreateManyInput[];
  buildingPermitDeadline: Prisma.BuildingPermitDeadlineCreateManyInput[];
  caReport: Prisma.CaReportCreateManyInput[];
  changeOrder: Prisma.ChangeOrderCreateManyInput[];
  rfiLog: Prisma.RfiLogCreateManyInput[];
  siteInstruction: Prisma.SiteInstructionCreateManyInput[];
  submittalLog: Prisma.SubmittalLogCreateManyInput[];
  delayNotice: Prisma.DelayNoticeCreateManyInput[];
  progressCertification: Prisma.ProgressCertificationCreateManyInput[];
  punchListItem: Prisma.PunchListItemCreateManyInput[];
  purchaseOrder: Prisma.PurchaseOrderCreateManyInput[];
  materialSelection: Prisma.MaterialSelectionCreateManyInput[];
  designDeliverable: Prisma.DesignDeliverableCreateManyInput[];
  generalDocument: Prisma.GeneralDocumentCreateManyInput[];
  constructionContract: Prisma.ConstructionContractCreateManyInput[];
  invoice: Prisma.InvoiceCreateManyInput[];
  invoiceLine: Prisma.InvoiceLineCreateManyInput[];
  invoicePayment: Prisma.InvoicePaymentCreateManyInput[];
  timeEntry: Prisma.TimeEntryCreateManyInput[];
  expense: Prisma.ExpenseCreateManyInput[];
};

export type SampleModel = keyof SamplePlan;

/** Parents before children. Removal walks this backwards. */
export const SAMPLE_MODEL_ORDER: readonly SampleModel[] = [
  "client",
  "clientAddress",
  "project",
  "projectPhase",
  "phaseDependency",
  "phaseAssignment",
  "serviceProposal",
  "serviceProposalDiscipline",
  "serviceProposalPhase",
  "serviceProposalFeeComponent",
  "serviceProposalPaymentMilestone",
  "serviceProposalReimbursable",
  "serviceProposalDiscount",
  "serviceProposalTax",
  "serviceProposalStatusHistory",
  "serviceProposalVersion",
  "costEstimate",
  "estimateCategory",
  "estimateItem",
  "projectSchedule",
  "scheduleTask",
  "task",
  "meetingMinute",
  "actionItem",
  "buildingPermit",
  "buildingPermitSubmission",
  "buildingPermitMeeting",
  "buildingPermitCorrespondence",
  "buildingPermitApproval",
  "buildingPermitDeadline",
  "caReport",
  "changeOrder",
  "rfiLog",
  "siteInstruction",
  "submittalLog",
  "delayNotice",
  "progressCertification",
  "punchListItem",
  "purchaseOrder",
  "materialSelection",
  "designDeliverable",
  "generalDocument",
  "constructionContract",
  "invoice",
  "invoiceLine",
  "invoicePayment",
  "timeEntry",
  "expense",
];

/**
 * The models that carry no `companyId` column. They are reached only through a
 * parent that does, and are only ever addressed by ids this module created.
 */
export const SAMPLE_CHILD_MODELS: ReadonlySet<SampleModel> = new Set<SampleModel>([
  "clientAddress",
  "projectPhase",
  "phaseDependency",
  "phaseAssignment",
  "estimateCategory",
  "estimateItem",
  "scheduleTask",
  "actionItem",
]);

/** Top-level records per module: what a person would count on the screens. */
export function moduleCounts(ids: Partial<Record<SampleModel, string[]>>): SampleCounts {
  const out: SampleCounts = {};
  for (const m of SAMPLE_MODULES) {
    out[m.key] = m.models.reduce((n, model) => n + (ids[model as SampleModel]?.length ?? 0), 0);
  }
  return out;
}

/** Every row per model, children included: what a run actually inserts. */
export function rowCounts(plan: SamplePlan): Record<SampleModel, number> {
  const out = {} as Record<SampleModel, number>;
  for (const model of SAMPLE_MODEL_ORDER) out[model] = plan[model].length;
  return out;
}

export function totalRows(plan: SamplePlan): number {
  return SAMPLE_MODEL_ORDER.reduce((n, model) => n + plan[model].length, 0);
}

/** The ids of every row in the plan, by model: what is recorded for removal. */
export function planIds(plan: SamplePlan): Record<SampleModel, string[]> {
  const out = {} as Record<SampleModel, string[]>;
  for (const model of SAMPLE_MODEL_ORDER) {
    out[model] = (plan[model] as { id?: string }[]).map((r) => String(r.id));
  }
  return out;
}

/**
 * The company's token for its sample numbers: the last six letters or digits
 * of its id, upper-cased. Deterministic, so a dry run names the numbers the
 * real run will use.
 */
export function sampleToken(companyId: string): string {
  const clean = companyId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (clean.slice(-6) || "SAMPLE").padStart(6, "0");
}

/** `SMP-<token>-<kind>-<letter>`. Ends in a letter on purpose; see the file header. */
export function sampleNumber(token: string, kind: string, letter = "A"): string {
  return `${SAMPLE_NUMBER_PREFIX}${token}-${kind}-${letter}`;
}

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSampleSet(input: SampleBuildInput): SamplePlan {
  const { companyId, companyName, token, lang, currency, owner, newId } = input;
  const L = (en: string, es: string) => (lang === "es" ? es : en);
  const W = SAMPLE_WORD[lang];
  /** A sample name: the marker word, then the name. */
  const S = (en: string, es: string) => `${W} - ${L(en, es)}`;
  const num = (kind: string, letter = "A") => sampleNumber(token, kind, letter);

  // "Today" at UTC midnight, so every date-only column reads the same day everywhere.
  const base = Date.UTC(input.today.getUTCFullYear(), input.today.getUTCMonth(), input.today.getUTCDate());
  const at = (days: number) => new Date(base + days * DAY);
  const iso = (days: number) => at(days).toISOString().slice(0, 10);

  // ── The cast. Nobody here exists. ────────────────────────────────────────
  const clientName = S("Elena Marlow", "Elena Marlow");
  const clientPerson = "Elena Marlow";
  const clientEmail = "elena.marlow@example.com";
  const projectName = S("Casa Miramar, single-family house", "Casa Miramar, vivienda unifamiliar");
  const siteAddress = L("14 Seaview Lane, Palm Bay", "Calle Vista al Mar 14, Bahía Palmera");
  const builder = S("Northshore Builders Ltd.", "Constructora Costa Norte S.A.");
  const builderPerson = "Marco Ruiz";
  const engineer = L("Ana Pereira (structural engineer)", "Ana Pereira (ingeniera estructural)");
  const authority = S("Municipal Building Department", "Departamento Municipal de Obras");
  const supplier = S("Harbour Windows & Doors Ltd.", "Ventanas y Puertas del Puerto S.A.");
  const taxName = L("Sales tax (SAMPLE)", "Impuesto sobre ventas (EJEMPLO)");
  const TAX_PERCENT = 6;
  const CONSTRUCTION_SUM = 480_000;

  const plan = {} as SamplePlan;
  for (const model of SAMPLE_MODEL_ORDER) (plan[model] as unknown[]) = [];

  // ── Client ───────────────────────────────────────────────────────────────
  const clientId = newId();
  plan.client.push({
    id: clientId,
    companyId,
    name: clientName,
    companyName: S("Marlow Family", "Familia Marlow"),
    contactPerson: clientPerson,
    email: clientEmail,
    phone: "+1 555 0100",
    mobile: "+1 555 0101",
    website: "https://example.com",
    taxNumber: "SMP-000000",
    type: "RESIDENTIAL",
    status: "ACTIVE",
    tags: [W, L("Residential", "Residencial")],
    notes: L(
      "This client is part of the sample set. It shows a client record with every contact field filled in. Remove the sample set in Settings when you no longer need it.",
      "Este cliente forma parte del conjunto de ejemplo. Muestra una ficha de cliente con todos los datos de contacto completos. Quite el conjunto de ejemplo en Configuración cuando ya no lo necesite.",
    ),
  });
  plan.clientAddress.push({
    id: newId(),
    clientId,
    label: L("Home", "Domicilio"),
    line1: L("27 Orchard Road", "Camino del Huerto 27"),
    line2: L("Apartment 3B", "Apartamento 3B"),
    city: L("Palm Bay", "Bahía Palmera"),
    emirate: L("North District", "Distrito Norte"),
    country: L("Sample Country", "País de ejemplo"),
    isPrimary: true,
  });

  // ── Service proposal: every figure from the proposal engine ──────────────
  const proposalId = newId();
  const proposalNumber = num("SP");
  const spIds = {
    fee: [newId(), newId(), newId(), newId()],
    phase: [newId(), newId(), newId(), newId()],
    milestone: [newId(), newId(), newId(), newId()],
    reimbursable: [newId()],
    discount: [newId()],
  };
  const parsed = parseServiceProposalInput({
    title: S("Casa Miramar: architecture and engineering services", "Casa Miramar: servicios de arquitectura e ingeniería"),
    number: proposalNumber,
    kind: "ADVANCED",
    clientId,
    clientName,
    projectName,
    contactName: clientPerson,
    contactEmail: clientEmail,
    contactTitle: L("Owner", "Propietaria"),
    currency,
    languageCode: lang,
    taxJurisdiction: L("Sample jurisdiction", "Jurisdicción de ejemplo"),
    costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: CONSTRUCTION_SUM },
    feeComponents: [
      {
        id: spIds.fee[0],
        label: L("Architectural design, concept to construction documents", "Diseño arquitectónico, del concepto a los documentos de construcción"),
        disciplineKey: "ARCHITECTURE",
        method: "PERCENT_OF_BASIS",
        category: "BASE",
        percent: 6,
        taxable: true,
      },
      {
        id: spIds.fee[1],
        label: L("Structural engineering", "Ingeniería estructural"),
        disciplineKey: "STRUCTURAL",
        method: "FIXED",
        category: "BASE",
        fixedAmount: 6500,
        taxable: true,
      },
      {
        id: spIds.fee[2],
        label: L("Construction administration, site visits", "Administración de obra, visitas al sitio"),
        disciplineKey: "PROJECT_MANAGEMENT",
        method: "HOURLY",
        category: "BASE",
        quantity: 40,
        unitRate: 95,
        taxable: true,
      },
      {
        id: spIds.fee[3],
        label: L("Interior design package (optional)", "Paquete de diseño interior (opcional)"),
        disciplineKey: "INTERIOR",
        method: "FIXED",
        category: "OPTIONAL",
        fixedAmount: 4200,
        selected: false,
        taxable: true,
      },
    ],
    phases: [
      { id: spIds.phase[0], name: L("Concept Design", "Diseño conceptual"), percent: 10 },
      { id: spIds.phase[1], name: L("Schematic Design", "Anteproyecto"), percent: 15 },
      { id: spIds.phase[2], name: L("Design Development", "Desarrollo del diseño"), percent: 35 },
      { id: spIds.phase[3], name: L("Construction Documents", "Documentos de construcción"), percent: 40 },
    ],
    paymentMilestones: [
      { id: spIds.milestone[0], name: L("On signing", "A la firma"), trigger: L("Signed proposal", "Propuesta firmada"), percent: 30 },
      { id: spIds.milestone[1], name: L("Schematic design approved", "Anteproyecto aprobado"), trigger: L("Client approval of the schematic design", "Aprobación del anteproyecto por el cliente"), percent: 25 },
      { id: spIds.milestone[2], name: L("Building permit submitted", "Permiso de construcción presentado"), trigger: L("Receipt from the authority", "Acuse de la autoridad"), percent: 25 },
      { id: spIds.milestone[3], name: L("Construction documents issued", "Documentos de construcción entregados"), trigger: L("Issue for construction", "Emisión para construcción"), percent: 20 },
    ],
    reimbursables: [
      { id: spIds.reimbursable[0], label: L("Printing and permit submission copies", "Impresión y copias para el permiso"), amount: 650, taxable: true },
    ],
    discounts: [
      {
        id: spIds.discount[0],
        label: L("Returning client discount", "Descuento por cliente recurrente"),
        type: "PERCENT",
        value: 2,
        reason: L("Second commission from the same family", "Segundo encargo de la misma familia"),
        visibleToClient: true,
      },
    ],
    taxes: [{ name: taxName, percent: TAX_PERCENT, mode: "EXCLUSIVE", registrationNumber: "SMP-000000" }],
    scopeSummary: L(
      "Full architectural and structural design for a 240 m² single-storey house with a covered terrace, from concept to construction documents, the building permit application, and site visits during construction.",
      "Diseño arquitectónico y estructural completo de una vivienda de una planta de 240 m² con terraza cubierta, del concepto a los documentos de construcción, la solicitud del permiso de construcción y visitas al sitio durante la obra.",
    ),
    scopeItems: [
      { title: L("Site analysis and concept design", "Análisis del sitio y diseño conceptual"), description: L("Two concept options with a 3D massing study.", "Dos opciones de concepto con un estudio volumétrico 3D."), discipline: "ARCHITECTURE", category: "BASE", included: true },
      { title: L("Schematic design and permit drawings", "Anteproyecto y planos para el permiso"), description: L("Plans, sections, elevations and the permit application set.", "Plantas, secciones, alzados y el juego para la solicitud del permiso."), discipline: "ARCHITECTURE", category: "BASE", included: true },
      { title: L("Structural design and calculations", "Diseño y cálculo estructural"), description: L("Foundations, columns, beams and the roof slab.", "Cimentación, columnas, vigas y losa de cubierta."), discipline: "STRUCTURAL", category: "BASE", included: true },
      { title: L("Construction documents", "Documentos de construcción"), description: L("Detailed drawings, schedules and specifications for tender.", "Planos de detalle, cuadros y especificaciones para licitación."), discipline: "ARCHITECTURE", category: "BASE", included: true },
      { title: L("Site visits during construction", "Visitas al sitio durante la obra"), description: L("Up to 40 hours, reported in the Construction Admin module.", "Hasta 40 horas, registradas en el módulo de Administración de obra."), discipline: "PROJECT_MANAGEMENT", category: "BASE", included: true },
      { title: L("Interior design package", "Paquete de diseño interior"), description: L("Finishes, joinery and lighting. Offered as an option.", "Acabados, carpintería e iluminación. Se ofrece como opción."), discipline: "INTERIOR", category: "OPTIONAL", included: true },
      { title: L("Topographic survey and soil report", "Levantamiento topográfico y estudio de suelos"), description: L("By others, appointed by the client.", "Por terceros, contratados por el cliente."), discipline: null, category: "ADDITIONAL", included: false },
    ],
    exclusions: L(
      "Topographic survey, soil investigation, authority fees, landscape design and furniture are not included.",
      "No se incluyen el levantamiento topográfico, el estudio de suelos, las tasas de la autoridad, el paisajismo ni el mobiliario.",
    ),
    assumptions: L(
      "The fee is based on an estimated construction cost and one round of client comments per phase.",
      "Los honorarios se basan en un costo de construcción estimado y una ronda de comentarios del cliente por fase.",
    ),
    terms: L(
      "Invoices are payable within 30 days. Additional services are charged at the hourly rate stated above.",
      "Las facturas se pagan a 30 días. Los servicios adicionales se cobran a la tarifa por hora indicada arriba.",
    ),
    estimatedWeeks: 20,
    showFeeDerivation: true,
    validUntil: iso(-125),
    notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
  });
  if (!parsed.ok) {
    throw new Error(`Sample service proposal is not valid: ${parsed.issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
  }
  const spInput = parsed.value;
  const sp = buildWriteData(spInput);
  const grandTotal = Number(sp.header.grandTotal);

  // ── Project (its phases decide its progress) ─────────────────────────────
  const projectId = newId();
  const projectNumber = num("PRJ");
  const phaseRows: {
    name: string;
    discipline: "ARCHITECTURE" | "STRUCTURAL" | "PROJECT_MANAGEMENT" | "CONSTRUCTION";
    status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED";
    progressPct: number;
    start: number;
    end: number;
  }[] = [
    { name: L("Concept Design", "Diseño conceptual"), discipline: "ARCHITECTURE", status: "COMPLETED", progressPct: 100, start: -150, end: -121 },
    { name: L("Schematic Design", "Anteproyecto"), discipline: "ARCHITECTURE", status: "COMPLETED", progressPct: 100, start: -120, end: -91 },
    { name: L("Design Development", "Desarrollo del diseño"), discipline: "STRUCTURAL", status: "COMPLETED", progressPct: 100, start: -100, end: -60 },
    { name: L("Construction Documents", "Documentos de construcción"), discipline: "ARCHITECTURE", status: "COMPLETED", progressPct: 100, start: -90, end: -50 },
    { name: L("Tender / Bidding", "Licitación"), discipline: "PROJECT_MANAGEMENT", status: "COMPLETED", progressPct: 100, start: -59, end: -46 },
    { name: L("Construction Administration", "Administración de obra"), discipline: "CONSTRUCTION", status: "IN_PROGRESS", progressPct: 25, start: -45, end: 160 },
    { name: L("Handover", "Entrega"), discipline: "PROJECT_MANAGEMENT", status: "NOT_STARTED", progressPct: 0, start: 161, end: 175 },
  ];
  const phaseIds = phaseRows.map(() => newId());
  plan.project.push({
    id: projectId,
    companyId,
    projectNumber,
    name: projectName,
    clientId,
    managerId: owner.id,
    status: "ACTIVE",
    priority: "HIGH",
    description: L(
      "A 240 m² single-storey house with three bedrooms, an open living area and a covered terrace. This sample project is the thread through the whole sample set: its proposal, estimate, schedule, permit, site records, purchase order and invoice all belong to it.",
      "Vivienda de una planta de 240 m² con tres dormitorios, zona de estar abierta y terraza cubierta. Este proyecto de ejemplo es el hilo de todo el conjunto de ejemplo: su propuesta, presupuesto, cronograma, permiso, registros de obra, orden de compra y factura le pertenecen.",
    ),
    siteAddress,
    disciplines: ["ARCHITECTURE", "STRUCTURAL", "PROJECT_MANAGEMENT"],
    startDate: at(-150),
    targetEndDate: at(175),
    progressPct: deriveProjectProgress(phaseRows) ?? 0,
    architectureType: "SINGLE_FAMILY_HOME",
    contractValue: grandTotal,
    currency,
    notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
  });
  phaseRows.forEach((p, i) => {
    plan.projectPhase.push({
      id: phaseIds[i],
      projectId,
      name: p.name,
      discipline: p.discipline,
      status: p.status,
      startDate: at(p.start),
      endDate: at(p.end),
      progressPct: p.progressPct,
      sortOrder: i,
    });
    if (i > 0) {
      plan.phaseDependency.push({ id: newId(), dependentId: phaseIds[i], requiredId: phaseIds[i - 1], type: "FS", lagDays: 0 });
    }
  });
  plan.phaseAssignment.push({ id: newId(), phaseId: phaseIds[5], userId: owner.id, roleName: L("Project lead", "Responsable del proyecto") });

  // ── Service proposal rows ────────────────────────────────────────────────
  const spSnapshotInput = { ...spInput, projectId };
  plan.serviceProposal.push({
    ...sp.header,
    id: proposalId,
    companyId,
    number: proposalNumber,
    status: "ACCEPTED",
    versionLabel: "1.0",
    revision: 1,
    projectId,
    projectName,
    costBasisCapturedAt: at(-140),
    issuedAt: at(-138),
    lockedAt: at(-132),
    preparedById: owner.id,
    ownerId: owner.id,
    createdById: owner.id,
    createdByName: owner.name,
    createdAt: at(-142),
  });
  plan.serviceProposalDiscipline.push(
    { id: newId(), companyId, serviceProposalId: proposalId, disciplineKey: "ARCHITECTURE", label: L("Architecture", "Arquitectura"), leadName: owner.name, scope: L("Design lead and permit application.", "Dirección del diseño y solicitud del permiso."), sortOrder: 0 },
    { id: newId(), companyId, serviceProposalId: proposalId, disciplineKey: "STRUCTURAL", label: L("Structural engineering", "Ingeniería estructural"), leadName: "Ana Pereira", scope: L("Foundations, frame and roof slab.", "Cimentación, estructura y losa de cubierta."), sortOrder: 1 },
  );
  sp.children.feeComponents.forEach((c, i) =>
    plan.serviceProposalFeeComponent.push({ ...c, id: spIds.fee[i], companyId, serviceProposalId: proposalId }),
  );
  sp.children.phases.forEach((p, i) =>
    plan.serviceProposalPhase.push({ ...p, id: spIds.phase[i], companyId, serviceProposalId: proposalId }),
  );
  sp.children.paymentMilestones.forEach((m, i) =>
    plan.serviceProposalPaymentMilestone.push({
      ...m,
      id: spIds.milestone[i],
      companyId,
      serviceProposalId: proposalId,
      invoiceDescription: `${L("Professional fees", "Honorarios profesionales")}: ${m.name}`,
    }),
  );
  sp.children.reimbursables.forEach((r, i) =>
    plan.serviceProposalReimbursable.push({ ...r, id: spIds.reimbursable[i], companyId, serviceProposalId: proposalId }),
  );
  sp.children.discounts.forEach((d, i) =>
    plan.serviceProposalDiscount.push({
      ...d,
      id: spIds.discount[i],
      companyId,
      serviceProposalId: proposalId,
      authorisedById: owner.id,
      authorisedAt: at(-141),
    }),
  );
  sp.children.taxes.forEach((t) =>
    plan.serviceProposalTax.push({ ...t, id: newId(), companyId, serviceProposalId: proposalId }),
  );
  const history: [string | null, string, number, string][] = [
    [null, "DRAFT", -142, L("Proposal drafted", "Propuesta redactada")],
    ["DRAFT", "INTERNAL_REVIEW", -140, L("Fee checked against the estimate", "Honorarios revisados contra el presupuesto")],
    ["INTERNAL_REVIEW", "APPROVED_FOR_ISSUE", -139, L("Approved for issue", "Aprobada para emisión")],
    ["APPROVED_FOR_ISSUE", "SENT", -138, L("Sent to the client", "Enviada al cliente")],
    ["SENT", "ACCEPTED", -132, L("Accepted and signed by the client", "Aceptada y firmada por el cliente")],
  ];
  for (const [fromStatus, toStatus, day, reason] of history) {
    plan.serviceProposalStatusHistory.push({
      id: newId(),
      companyId,
      serviceProposalId: proposalId,
      fromStatus: fromStatus as Prisma.ServiceProposalStatusHistoryCreateManyInput["fromStatus"],
      toStatus: toStatus as Prisma.ServiceProposalStatusHistoryCreateManyInput["toStatus"],
      reason,
      byId: owner.id,
      byName: owner.name,
      createdAt: at(day),
    });
  }
  plan.serviceProposalVersion.push({
    id: newId(),
    companyId,
    serviceProposalId: proposalId,
    versionLabel: "1.0",
    snapshot: JSON.parse(JSON.stringify({ input: spSnapshotInput, calc: sp.calc })) as Prisma.InputJsonValue,
    reason: L("Issued to the client", "Emitida al cliente"),
    createdById: owner.id,
    createdByName: owner.name,
    createdAt: at(-138),
  });

  // ── Estimate (a project's estimate is keyed by the project's own id) ──────
  type Line = [task: string, qty: number, unit: string, norm: number, mat: number, equip: number, sub: number, poc: number, code?: string];
  const sections: { code: string; name: string; lines: Line[] }[] = [
    {
      code: "A10",
      name: L("Foundations", "Cimentación"),
      lines: [
        [L("Site clearing and setting out", "Limpieza del terreno y replanteo"), 420, "m²", 0.08, 0.5, 1.2, 0, 100, "EQ-EXC"],
        [L("Excavation for strip footings", "Excavación para zapatas corridas"), 68, "m³", 0.9, 0, 14, 0, 100, "EQ-EXC"],
        [L("Lean concrete blinding, 50 mm", "Concreto pobre de limpieza, 50 mm"), 62, "m²", 0.25, 9.5, 1, 0, 100, "CON-LEAN"],
        [L("Reinforcement to footings", "Acero de refuerzo en zapatas"), 2400, "kg", 0.035, 1.45, 0.05, 0, 100, "RFT-B500"],
        [L("Concrete C30 to footings", "Concreto C30 en zapatas"), 34, "m³", 2.2, 165, 22, 0, 100, "CON-C30"],
        [L("Damp-proof membrane", "Membrana impermeabilizante"), 250, "m²", 0.12, 6.8, 0, 0, 100, "WP-MEMB"],
      ],
    },
    {
      code: "B10",
      name: L("Structure: columns, beams and roof slab", "Estructura: columnas, vigas y losa de cubierta"),
      lines: [
        [L("Formwork to columns and beams", "Encofrado de columnas y vigas"), 310, "m²", 1.1, 14, 1.5, 0, 60, "FRM-PLY"],
        [L("Reinforcement to columns and beams", "Acero de refuerzo en columnas y vigas"), 3600, "kg", 0.04, 1.45, 0.05, 0, 60, "RFT-B500"],
        [L("Concrete C30 to columns and beams", "Concreto C30 en columnas y vigas"), 28, "m³", 3, 165, 28, 0, 40, "CON-C30"],
        [L("Roof slab, 180 mm, formwork, steel and concrete", "Losa de cubierta de 180 mm, encofrado, acero y concreto"), 255, "m²", 1.6, 62, 9, 0, 0, "CON-C30"],
      ],
    },
    {
      code: "C10",
      name: L("Walls and plaster", "Muros y revoque"),
      lines: [
        [L("Blockwork 200 mm, external walls", "Bloque de 200 mm, muros exteriores"), 340, "m²", 0.85, 21, 0.8, 0, 0, "BLK-200"],
        [L("Blockwork 150 mm, internal walls", "Bloque de 150 mm, muros interiores"), 220, "m²", 0.75, 17, 0.6, 0, 0, "BLK-150"],
        [L("Cement plaster, both sides", "Revoque de cemento, ambas caras"), 1120, "m²", 0.45, 4.2, 0.2, 0, 0, "PLS-CEM"],
      ],
    },
    {
      code: "C30",
      name: L("Finishes", "Acabados"),
      lines: [
        [L("Porcelain floor tile 600 x 600", "Piso de porcelanato 600 x 600"), 228, "m²", 0.7, 38, 0.4, 0, 0, "TIL-POR"],
        [L("Wall tile to bathrooms and kitchen", "Azulejo en baños y cocina"), 96, "m²", 0.9, 32, 0.3, 0, 0, "TIL-CER"],
        [L("Emulsion paint, three coats", "Pintura vinílica, tres manos"), 1120, "m²", 0.18, 2.6, 0.1, 0, 0, "PNT-EMUL"],
        [L("Gypsum board ceiling", "Cielo raso de yeso"), 215, "m²", 0.55, 16, 0.4, 0, 0, "GYP-CEIL"],
        [L("Aluminium windows and sliding doors", "Ventanas y puertas corredizas de aluminio"), 58, "m²", 0.6, 0, 2, 265, 0, "GLZ-ALU"],
        [L("Internal doors with frames and ironmongery", "Puertas interiores con marco y herrajes"), 11, "no", 2.5, 310, 0, 0, 0, "DR-INT"],
      ],
    },
    {
      code: "D20",
      name: L("Building services (subcontract)", "Instalaciones (subcontrato)"),
      lines: [
        [L("Electrical installation, complete", "Instalación eléctrica completa"), 1, "ls", 0, 0, 0, 31500, 0, "SC-ELE"],
        [L("Plumbing and drainage, complete", "Instalación hidrosanitaria completa"), 1, "ls", 0, 0, 0, 24800, 0, "SC-PLM"],
        [L("Air conditioning, split units", "Aire acondicionado, equipos split"), 6, "set", 0, 0, 0, 2350, 0, "SC-HVAC"],
      ],
    },
  ];
  const AVG_LABOR_RATE = 45;
  const PROFIT_PCT = 12;
  const BBO_PCT = 7;
  const estimateDto: EstimateDto = {
    id: projectId,
    projectId,
    projectNumber,
    projectName,
    version: "V1.0",
    date: iso(-70),
    location: siteAddress,
    client: clientName,
    clientId,
    currency,
    avgLaborRate: AVG_LABOR_RATE,
    profitPct: PROFIT_PCT,
    bboPct: BBO_PCT,
    gfa: 240,
    categories: sections.map((s) => ({
      id: newId(),
      name: s.name,
      code: s.code,
      items: s.lines.map(([task, qty, unit, laborNorm, materialUnitCost, equipmentUnitCost, subcontractUnitCost, poc, code]) => ({
        id: newId(),
        task,
        qty,
        unit,
        laborNorm,
        materialUnitCost,
        equipmentUnitCost,
        subcontractUnitCost,
        poc,
        code,
      })),
    })),
  };
  plan.costEstimate.push({
    // The app finds a project's estimate by the project's id (lib/data/estimates.ts).
    id: projectId,
    companyId,
    projectId,
    projectNumber,
    projectName,
    client: clientName,
    clientId,
    location: siteAddress,
    version: "V1.0",
    date: at(-70),
    currency,
    avgLaborRate: AVG_LABOR_RATE,
    profitPct: PROFIT_PCT,
    bboPct: BBO_PCT,
    gfa: 240,
    status: "IN_REVIEW",
    locked: false,
    // What the estimate's own save action stores: the grand total, rounded.
    amount: Math.round(estimateTotals(estimateDto).grandTotal),
  });
  estimateDto.categories.forEach((c, ci) => {
    plan.estimateCategory.push({ id: c.id, estimateId: projectId, name: c.name, code: c.code ?? null, sortOrder: ci });
    c.items.forEach((it, ii) => {
      plan.estimateItem.push({
        id: it.id,
        categoryId: c.id,
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
      });
    });
  });

  // ── Schedule: a dependency chain, so the critical path means something ───
  const scheduleId = newId();
  plan.projectSchedule.push({
    id: scheduleId,
    companyId,
    projectId,
    projectNumber,
    projectName,
    client: clientName,
    manager: owner.name,
  });
  type Sched = [key: string, name: string, discipline: string, category: string, sub: string | null, start: number, end: number, pct: number, deps: string[], budget: number | null];
  const sched: Sched[] = [
    ["s1", L("Concept design", "Diseño conceptual"), "ARCHITECTURE", "architecture", "Concept Design", -150, -121, 100, [], null],
    ["s2", L("Schematic design", "Anteproyecto"), "ARCHITECTURE", "architecture", "Schematic Design", -120, -91, 100, ["s1"], null],
    ["s3", L("Structural design and calculations", "Diseño y cálculo estructural"), "STRUCTURAL", "structural", null, -100, -60, 100, ["s2"], null],
    ["s4", L("Permit drawings and submission", "Planos y presentación del permiso"), "ARCHITECTURE", "architecture", "Authority Submission", -90, -76, 100, ["s2"], null],
    ["s5", L("Building permit review by the authority", "Revisión del permiso por la autoridad"), "PROJECT_MANAGEMENT", "project-mgmt", null, -75, -60, 100, ["s4"], null],
    ["s6", L("Construction documents", "Documentos de construcción"), "ARCHITECTURE", "architecture", "Construction Drawings", -90, -50, 100, ["s2"], null],
    ["s7", L("Tender and contractor award", "Licitación y adjudicación"), "PROJECT_MANAGEMENT", "project-mgmt", null, -59, -46, 100, ["s3", "s5", "s6"], null],
    ["s8", L("Mobilisation and site setup", "Movilización e instalación de obra"), "CONSTRUCTION", "construction", "Mobilisation", -45, -39, 100, ["s7"], 9500],
    ["s9", L("Foundations", "Cimentación"), "CONSTRUCTION", "construction", null, -38, -15, 100, ["s8"], 38000],
    ["s10", L("Structure: columns, beams and roof slab", "Estructura: columnas, vigas y losa de cubierta"), "CONSTRUCTION", "construction", null, -14, 30, 35, ["s9"], 96000],
    ["s11", L("Blockwork and plaster", "Muros y revoque"), "CONSTRUCTION", "construction", null, 31, 70, 0, ["s10"], 64000],
    ["s12", L("Electrical and plumbing rough-in", "Canalizaciones eléctricas e hidrosanitarias"), "MEP", "mep", null, 45, 80, 0, ["s10"], 58000],
    ["s13", L("Order and install windows and doors", "Pedido e instalación de ventanas y puertas"), "CONSTRUCTION", "orders", null, 60, 85, 0, ["s11"], 21000],
    ["s14", L("Finishes: floors, ceilings and paint", "Acabados: pisos, cielos y pintura"), "INTERIOR", "interior", null, 86, 140, 0, ["s11", "s12", "s13"], 72000],
    ["s15", L("Snagging, final inspection and handover", "Repasos, inspección final y entrega"), "PROJECT_MANAGEMENT", "project-mgmt", null, 141, 160, 0, ["s14"], null],
  ];
  sched.forEach(([key, name, discipline, category, sub, start, end, pct, deps, budget], i) => {
    plan.scheduleTask.push({
      id: newId(),
      scheduleId,
      taskKey: key,
      name,
      discipline,
      status: pct >= 100 ? "COMPLETED" : pct > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      start: iso(start),
      end: iso(end),
      progressPct: pct,
      dependsOn: deps,
      assignee: discipline === "CONSTRUCTION" || discipline === "MEP" ? builderPerson : owner.name,
      durationUnit: "days",
      category,
      subCategory: sub,
      sortOrder: i,
      budgetAmount: budget,
      budgetSource: budget === null ? null : "manual",
    });
  });

  // ── Tasks: a spread of statuses, priorities and due dates ────────────────
  type TaskRow = [title: string, notes: string, status: "TODO" | "IN_PROGRESS" | "DONE", priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", due: number | null, kind?: "TASK" | "REMINDER"];
  const tasks: TaskRow[] = [
    [L("Issue construction documents to the contractor", "Entregar los documentos de construcción al contratista"), L("Issued as revision C, see the design deliverables.", "Entregados como revisión C, vea los entregables de diseño."), "DONE", "HIGH", -50],
    [L("Collect the building permit from the authority", "Recoger el permiso de construcción en la autoridad"), L("Permit issued, see Building Permits.", "Permiso emitido, vea Permisos de construcción."), "DONE", "HIGH", -60],
    [L("Review the roof slab reinforcement before the pour", "Revisar el acero de la losa de cubierta antes del vaciado"), L("Site visit with the structural engineer.", "Visita al sitio con la ingeniera estructural."), "IN_PROGRESS", "CRITICAL", 5],
    [L("Answer the contractor's question on the window lintels", "Responder la consulta del contratista sobre los dinteles"), L("See the RFI in Construction Admin.", "Vea la consulta (RFI) en Administración de obra."), "IN_PROGRESS", "HIGH", 3],
    [L("Confirm floor tile selection with the client", "Confirmar con la clienta la selección del piso"), L("Two options in Material Selection.", "Dos opciones en Selección de materiales."), "TODO", "MEDIUM", 12],
    [L("Prepare payment certificate no. 2", "Preparar el certificado de pago n.º 2"), L("After the roof slab is poured.", "Después del vaciado de la losa de cubierta."), "TODO", "MEDIUM", 28],
    [L("Order the kitchen joinery shop drawings", "Solicitar los planos de taller de la cocina"), "", "TODO", "LOW", 40],
    [L("Site meeting with the client and contractor", "Reunión de obra con la clienta y el contratista"), L("Every second week on site.", "Cada dos semanas en el sitio."), "TODO", "MEDIUM", 7, "REMINDER"],
  ];
  tasks.forEach(([title, notes, status, priority, due, kind], i) => {
    plan.task.push({
      id: newId(),
      companyId,
      title: `${W} - ${title}`,
      notes: notes || null,
      status,
      priority,
      dueDate: due === null ? null : at(due),
      assignee: owner.name,
      assigneeId: owner.id,
      createdById: owner.id,
      projectId,
      kind: kind ?? "TASK",
      sortOrder: i,
    });
  });

  // ── Meeting minutes ──────────────────────────────────────────────────────
  const meetingId = newId();
  plan.meetingMinute.push({
    id: meetingId,
    companyId,
    projectId,
    authorId: owner.id,
    title: S("Site meeting no. 4: structure progress", "Reunión de obra n.º 4: avance de la estructura"),
    type: "SITE",
    meetingDate: at(-7),
    location: siteAddress,
    participants: [owner.name, clientPerson, `${builderPerson} (${builder})`, engineer],
    summary: L(
      "Foundations are complete and inspected. Columns are cast to roof level; beam formwork is 60% complete. The roof slab pour is planned for the week after next.",
      "La cimentación está terminada e inspeccionada. Las columnas están vaciadas hasta el nivel de cubierta; el encofrado de vigas va al 60%. El vaciado de la losa de cubierta está previsto para dentro de dos semanas.",
    ),
    discussion: L(
      "1. Progress: the works are two working days behind the programme after heavy rain.\n2. Structure: the engineer asked for an inspection of the slab reinforcement before the pour.\n3. Windows: the supplier confirmed delivery in two shipments; the first has arrived on site.\n4. Client: a pergola over the terrace was requested and priced as a change order.\n5. Safety: edge protection at roof level to be completed before the slab formwork starts.",
      "1. Avance: la obra lleva dos días hábiles de retraso respecto al programa por lluvias fuertes.\n2. Estructura: la ingeniera pidió inspeccionar el acero de la losa antes del vaciado.\n3. Ventanas: el proveedor confirmó la entrega en dos envíos; el primero ya llegó al sitio.\n4. Clienta: solicitó una pérgola sobre la terraza, cotizada como orden de cambio.\n5. Seguridad: completar la protección de borde en cubierta antes de iniciar el encofrado de la losa.",
    ),
    decisions: L(
      "1. The change order for the terrace pergola is approved by the client.\n2. Two days of extension are accepted for the rain delay.\n3. The roof slab is not poured until the reinforcement is inspected and signed off.",
      "1. La clienta aprueba la orden de cambio de la pérgola de la terraza.\n2. Se aceptan dos días de prórroga por el retraso por lluvia.\n3. No se vacía la losa de cubierta hasta inspeccionar y aprobar el acero.",
    ),
    followUpDate: at(7),
  });
  const actions: [string, number, "OPEN" | "IN_PROGRESS" | "DONE"][] = [
    [L("Issue the approved change order to the contractor", "Entregar al contratista la orden de cambio aprobada"), -4, "DONE"],
    [L("Arrange the reinforcement inspection with the engineer", "Coordinar con la ingeniera la inspección del acero"), 5, "IN_PROGRESS"],
    [L("Send the revised programme showing the two-day extension", "Enviar el programa revisado con los dos días de prórroga"), 4, "OPEN"],
    [L("Confirm the delivery date of the second window shipment", "Confirmar la fecha de entrega del segundo envío de ventanas"), 10, "OPEN"],
  ];
  for (const [description, due, status] of actions) {
    plan.actionItem.push({
      id: newId(),
      meetingId,
      assigneeId: owner.id,
      description,
      dueDate: at(due),
      status,
      completedAt: status === "DONE" ? at(due) : null,
    });
  }

  // ── Building permit: a finished case, from first submission to issue ─────
  const permitId = newId();
  plan.buildingPermit.push({
    id: permitId,
    companyId,
    reference: num("BP"),
    permitNumber: `SMP-${token}-PERMIT`,
    title: S("New house, Casa Miramar", "Vivienda nueva, Casa Miramar"),
    permitType: "NEW_BUILD",
    status: "ISSUED",
    description: L(
      "Building permit for a new single-storey house of 240 m² with a covered terrace. A complete case: two versions, the authority's letter, the concept and final approvals and the issued permit.",
      "Permiso de construcción para una vivienda nueva de una planta de 240 m² con terraza cubierta. Un expediente completo: dos versiones, la carta de la autoridad, las aprobaciones conceptual y final y el permiso emitido.",
    ),
    projectId,
    projectName,
    clientId,
    clientName,
    applicantName: clientPerson,
    siteAddress,
    parcelNumber: "SMP-PARCEL-0014",
    landRegistry: "SMP-REG-2291",
    authority,
    authorityContact: L("Permit desk", "Ventanilla de permisos"),
    authorityEmail: "permits@example.org",
    lotAreaM2: 640,
    builtAreaM2: 240,
    estimatedValue: CONSTRUCTION_SUM,
    currency,
    submittedAt: at(-90),
    acknowledgedAt: at(-88),
    conceptApprovalAt: at(-74),
    conceptApprovalRef: "SMP-CA-0457",
    decisionAt: at(-62),
    issuedAt: at(-60),
    expiresAt: at(670),
    targetDecisionAt: at(-60),
    feeAmount: 1850,
    feePaidAt: at(-61),
    responsibleId: owner.id,
    responsibleName: owner.name,
    notes: L("Part of the sample set. No files are attached to this sample.", "Parte del conjunto de ejemplo. Este ejemplo no tiene archivos adjuntos."),
    createdById: owner.id,
    createdByName: owner.name,
    createdAt: at(-95),
  });
  plan.buildingPermitSubmission.push(
    {
      id: newId(),
      companyId,
      permitId,
      sequence: 1,
      submittedAt: at(-90),
      method: "COUNTER",
      receivedBy: L("Permit desk", "Ventanilla de permisos"),
      receiptNumber: "SMP-R-10231",
      contents: L("Application form, site plan, floor plan, sections, elevations, structural calculations.", "Formulario de solicitud, plano de sitio, planta, secciones, alzados, cálculo estructural."),
      notes: L("First submission.", "Primera presentación."),
      createdByName: owner.name,
    },
    {
      id: newId(),
      companyId,
      permitId,
      sequence: 2,
      submittedAt: at(-78),
      method: "PORTAL",
      receivedBy: L("Online portal", "Portal en línea"),
      receiptNumber: "SMP-R-10388",
      contents: L("Revised site plan showing the 5 m side setback and the septic tank location.", "Plano de sitio revisado con el retiro lateral de 5 m y la ubicación del tanque séptico."),
      notes: L("Answers the authority's request for information.", "Responde la solicitud de información de la autoridad."),
      createdByName: owner.name,
    },
  );
  plan.buildingPermitMeeting.push({
    id: newId(),
    companyId,
    permitId,
    heldAt: at(-83),
    subject: L("Review meeting on the side setback", "Reunión de revisión sobre el retiro lateral"),
    location: L("Authority offices, room 2", "Oficinas de la autoridad, sala 2"),
    attendees: `${owner.name}, ${L("plan reviewer of the authority", "revisor de planos de la autoridad")}`,
    minutes: L("The reviewer asked for the side setback to be dimensioned and the septic tank to be shown on the site plan.", "El revisor pidió acotar el retiro lateral y mostrar el tanque séptico en el plano de sitio."),
    decisions: L("A revised site plan is enough; no new application is needed.", "Basta un plano de sitio revisado; no hace falta una nueva solicitud."),
    followUp: L("Resubmit within ten working days.", "Volver a presentar en diez días hábiles."),
    createdByName: owner.name,
  });
  plan.buildingPermitCorrespondence.push(
    {
      id: newId(),
      companyId,
      permitId,
      direction: "INCOMING",
      letterRef: "SMP-L-0457/1",
      party: authority,
      subject: L("Request for information: side setback and septic tank", "Solicitud de información: retiro lateral y tanque séptico"),
      letterDate: at(-85),
      receivedAt: at(-84),
      summary: L("The authority asks for a revised site plan before the review continues.", "La autoridad pide un plano de sitio revisado antes de continuar la revisión."),
      requiresResponse: true,
      responseDueAt: at(-70),
      respondedAt: at(-78),
      createdByName: owner.name,
    },
    {
      id: newId(),
      companyId,
      permitId,
      direction: "OUTGOING",
      letterRef: "SMP-L-0457/2",
      party: authority,
      subject: L("Reply with the revised site plan (version 2)", "Respuesta con el plano de sitio revisado (versión 2)"),
      letterDate: at(-78),
      summary: L("Cover letter for the second submission.", "Carta de presentación de la segunda versión."),
      requiresResponse: false,
      createdByName: owner.name,
    },
  );
  plan.buildingPermitApproval.push(
    {
      id: newId(),
      companyId,
      permitId,
      stage: "CONCEPT",
      status: "APPROVED",
      decidedAt: at(-74),
      refNumber: "SMP-CA-0457",
      notes: L("Concept approved on version 2.", "Concepto aprobado sobre la versión 2."),
      createdByName: owner.name,
    },
    {
      id: newId(),
      companyId,
      permitId,
      stage: "FINAL",
      status: "APPROVED_WITH_CONDITIONS",
      decidedAt: at(-62),
      refNumber: "SMP-FA-0457",
      validUntil: at(670),
      conditions: L("Works to start within 12 months. The foundation inspection must be requested before concrete is poured.", "La obra debe iniciar en 12 meses. La inspección de cimentación debe solicitarse antes del vaciado."),
      createdByName: owner.name,
    },
  );
  plan.buildingPermitDeadline.push({
    id: newId(),
    companyId,
    permitId,
    kind: "REPLY",
    label: L("Reply to the request for information", "Responder la solicitud de información"),
    dueDate: at(-70),
    // Met, so the sample never raises a deadline alarm on a dashboard.
    metAt: at(-78),
    createdById: owner.id,
    createdByName: owner.name,
  });

  // ── Construction administration ──────────────────────────────────────────
  plan.caReport.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    reportType: "WEEKLY",
    reportNumber: num("WR"),
    reportingPeriodStart: at(-13),
    reportingPeriodEnd: at(-7),
    preparedBy: owner.name,
    reviewedBy: owner.name,
    approvedBy: clientPerson,
    status: "ISSUED",
    weatherSummary: L("Dry all week except heavy rain on two afternoons.", "Seco toda la semana salvo lluvia fuerte en dos tardes."),
    siteConditions: L("Site clean and fenced. Access road passable after grading.", "Sitio limpio y cercado. Camino de acceso transitable tras la nivelación."),
    workCompleted: L("Columns cast to roof level. Beam formwork 60% complete. Ground slab cured.", "Columnas vaciadas hasta cubierta. Encofrado de vigas al 60%. Losa de piso curada."),
    workPlannedNextPeriod: L("Complete beam formwork and reinforcement. Start roof slab formwork.", "Terminar encofrado y acero de vigas. Iniciar encofrado de la losa de cubierta."),
    manpowerSummary: [
      { trade: L("Carpenters", "Carpinteros"), count: 6, hours: 264 },
      { trade: L("Steel fixers", "Armadores"), count: 4, hours: 176 },
      { trade: L("Labourers", "Ayudantes"), count: 5, hours: 220 },
      { trade: L("Site supervisor", "Maestro de obra"), count: 1, hours: 44 },
    ],
    materialDeliveries: L("Reinforcing steel, 2.4 t. First shipment of windows received and stored.", "Acero de refuerzo, 2,4 t. Primer envío de ventanas recibido y almacenado."),
    safetyIncidents: L("None. Edge protection at roof level still to be completed.", "Ninguno. Falta completar la protección de borde en cubierta."),
    qualityIssues: L("Honeycombing on one column, repaired and accepted by the engineer.", "Cangrejeras en una columna, reparadas y aceptadas por la ingeniera."),
    delays: L("Two working days lost to rain.", "Dos días hábiles perdidos por lluvia."),
    risks: L("Late delivery of the second window shipment would delay the finishes.", "Un retraso del segundo envío de ventanas retrasaría los acabados."),
    notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
  });
  const coCosts = {
    costLabor: 2400,
    costMaterial: 5200,
    costEquipment: 600,
    costSubcontractor: 0,
    overheadPercentage: 8,
    profitPercentage: 10,
    contingencyPercentage: 0,
    vatPercentage: 0,
  };
  const coTotal = changeOrderTotal(coCosts);
  plan.changeOrder.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    changeOrderNumber: num("CO"),
    title: S("Timber pergola over the terrace", "Pérgola de madera sobre la terraza"),
    description: L("Supply and install a treated timber pergola, 6 x 4 m, fixed to the terrace columns.", "Suministro e instalación de una pérgola de madera tratada de 6 x 4 m, fijada a las columnas de la terraza."),
    reason: L("Requested by the client at site meeting no. 4.", "Solicitada por la clienta en la reunión de obra n.º 4."),
    requestedBy: clientPerson,
    contractorId: builder,
    architectId: owner.name,
    engineerId: "Ana Pereira",
    ownerId: clientPerson,
    status: "APPROVED",
    ...coCosts,
    totalCost: coTotal,
    currency,
    scheduleImpactDays: 3,
    originalContractValue: CONSTRUCTION_SUM,
    approvedChangeOrdersToDate: 0,
    // The app's own rule: original + approved to date + this one once approved.
    revisedContractValue: round2(CONSTRUCTION_SUM + coTotal),
    dateRequested: at(-9),
    dateSubmitted: at(-8),
    dateApproved: at(-7),
    notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
  });
  plan.rfiLog.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    rfiNumber: num("RFI"),
    subject: S("Lintel size over the 3.2 m sliding door", "Tamaño del dintel sobre la puerta corrediza de 3,2 m"),
    question: L("Drawing A-201 shows a 200 x 400 lintel; the structural drawing S-102 shows 200 x 500. Which one governs?", "El plano A-201 muestra un dintel de 200 x 400; el plano estructural S-102 muestra 200 x 500. ¿Cuál rige?"),
    submittedBy: builderPerson,
    assignedTo: owner.name,
    discipline: "STRUCTURAL",
    priority: "HIGH",
    status: "ANSWERED",
    response: L("The structural drawing governs: 200 x 500 with 4 bars of 16 mm. A-201 will be corrected in the next revision.", "Rige el plano estructural: 200 x 500 con 4 barras de 16 mm. El A-201 se corregirá en la próxima revisión."),
    responseBy: owner.name,
    dateSubmitted: at(-12),
    dateRequired: at(-8),
    dateResponded: at(-10),
  });
  plan.siteInstruction.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    instructionNumber: num("SI"),
    title: S("Complete edge protection before slab formwork", "Completar la protección de borde antes del encofrado de la losa"),
    description: L("Install guard rails along the full roof perimeter before any slab formwork is erected.", "Instalar barandas en todo el perímetro de la cubierta antes de montar el encofrado de la losa."),
    issuedBy: owner.name,
    issuedTo: builder,
    discipline: "ARCHITECTURAL",
    costImpact: "NONE",
    scheduleImpact: "NONE",
    status: "ACKNOWLEDGED",
    dateIssued: at(-7),
  });
  plan.submittalLog.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    submittalNumber: num("SUB"),
    title: S("Aluminium windows and sliding doors, shop drawings", "Ventanas y puertas corredizas de aluminio, planos de taller"),
    description: L("Shop drawings, profile sections and a glass sample.", "Planos de taller, secciones de perfiles y una muestra de vidrio."),
    submittedBy: builder,
    reviewedBy: owner.name,
    discipline: "ARCHITECTURAL",
    status: "APPROVED_AS_NOTED",
    dateRequired: at(-30),
    dateSubmitted: at(-34),
    dateReviewed: at(-28),
    reviewerComments: L("Approved as noted: raise the sill of window W3 by 100 mm.", "Aprobado con observaciones: subir 100 mm el antepecho de la ventana W3."),
  });
  plan.delayNotice.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    delayNoticeNumber: num("DN"),
    title: S("Rain delay to the beam formwork", "Retraso por lluvia en el encofrado de vigas"),
    description: L("Heavy rain stopped work on two afternoons and flooded the access road for one day.", "La lluvia fuerte detuvo el trabajo dos tardes e inundó el camino de acceso durante un día."),
    cause: L("Weather", "Clima"),
    responsibleParty: L("Neither party", "Ninguna de las partes"),
    claimedDays: 3,
    approvedDays: 2,
    costImpact: 0,
    status: "ACCEPTED",
    dateStarted: at(-12),
    dateResolved: at(-7),
  });
  const cert = progressPayment({
    contractValue: CONSTRUCTION_SUM,
    currentPercentComplete: 22,
    retentionPercentage: 5,
    previousPaymentsValue: 0,
  });
  plan.progressCertification.push({
    id: newId(),
    companyId,
    projectId,
    projectName,
    certificationNumber: num("PC"),
    inspectionDate: at(-16),
    certifiedBy: owner.name,
    lenderName: S("Harbour Bank", "Banco del Puerto"),
    contractorName: builder,
    contractValue: CONSTRUCTION_SUM,
    currency,
    previousPercentComplete: 0,
    currentPercentComplete: 22,
    workCompletedValue: cert.workCompletedValue,
    retentionPercentage: 5,
    retentionAmount: cert.retentionAmount,
    previousPaymentsValue: 0,
    amountRecommendedForPayment: cert.amountRecommendedForPayment,
    deficiencies: L("None that affect payment.", "Ninguna que afecte el pago."),
    recommendation: L("Payment recommended for foundations and columns to roof level.", "Se recomienda el pago de la cimentación y las columnas hasta cubierta."),
    status: "ISSUED",
  });
  type Punch = [letter: string, location: string, description: string, trade: string, priority: "LOW" | "MEDIUM" | "HIGH", status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED", identified: number, due: number, completed: number | null];
  const punch: Punch[] = [
    ["A", L("Column C4, north side", "Columna C4, lado norte"), L("Honeycombing at the base of the column", "Cangrejeras en la base de la columna"), L("Concrete", "Concreto"), "HIGH", "VERIFIED", -20, -14, -16],
    ["B", L("Ground slab, living area", "Losa de piso, estar"), L("Surface crack near the terrace door, to be sealed", "Fisura superficial junto a la puerta de la terraza, a sellar"), L("Concrete", "Concreto"), "MEDIUM", "COMPLETED", -14, -5, -6],
    ["C", L("Roof level, perimeter", "Cubierta, perímetro"), L("Edge protection incomplete on the east side", "Protección de borde incompleta en el lado este"), L("Safety", "Seguridad"), "HIGH", "IN_PROGRESS", -7, 2, null],
    ["D", L("Site entrance", "Entrada al sitio"), L("Project sign board not yet installed", "Rótulo de obra aún sin instalar"), L("General", "General"), "LOW", "OPEN", -7, 14, null],
  ];
  for (const [letter, location, description, trade, priority, status, identified, due, completed] of punch) {
    plan.punchListItem.push({
      id: newId(),
      companyId,
      projectId,
      projectName,
      itemNumber: num("PL", letter),
      location,
      description: `${W} - ${description}`,
      trade,
      responsibleParty: builder,
      priority,
      status,
      dateIdentified: at(identified),
      dueDate: at(due),
      dateCompleted: completed === null ? null : at(completed),
      verifiedBy: status === "VERIFIED" ? owner.name : null,
    });
  }

  // ── Purchase order with a partial receipt ────────────────────────────────
  const poId = newId();
  const poNumber = num("PO");
  const poLines: PurchaseOrderLine[] = [
    { description: L("Sliding door 3200 x 2400, aluminium, clear glass", "Puerta corrediza 3200 x 2400, aluminio, vidrio claro"), quantity: 2, unit: "no", unitPrice: 2150, receivedQty: 2 },
    { description: L("Window 1500 x 1200, aluminium, clear glass", "Ventana 1500 x 1200, aluminio, vidrio claro"), quantity: 8, unit: "no", unitPrice: 520, receivedQty: 5 },
    { description: L("Window 600 x 600, obscure glass, bathrooms", "Ventana 600 x 600, vidrio esmerilado, baños"), quantity: 3, unit: "no", unitPrice: 240, receivedQty: 0 },
    { description: L("Insect screens for all opening windows", "Mosquiteros para todas las ventanas practicables"), quantity: 11, unit: "no", unitPrice: 65, receivedQty: 0 },
  ];
  const po = poTotals({ lineItems: poLines, taxPercentage: TAX_PERCENT, shipping: 350 });
  plan.purchaseOrder.push({
    id: poId,
    companyId,
    poNumber,
    projectId,
    projectName,
    vendorName: supplier,
    vendorContact: "Lucia Fontaine",
    vendorEmail: "orders@example.net",
    status: "PARTIAL",
    currency,
    lineItems: poLines as unknown as Prisma.InputJsonValue,
    subtotal: po.subtotal,
    taxPercentage: TAX_PERCENT,
    shipping: po.shipping,
    total: po.total,
    orderDate: at(-26),
    expectedDate: at(20),
    terms: L("50% with the order, 50% on delivery of the second shipment.", "50% con el pedido, 50% a la entrega del segundo envío."),
    notes: L("Part of the sample set. The first shipment is received; the second is due.", "Parte del conjunto de ejemplo. El primer envío está recibido; falta el segundo."),
    createdById: owner.id,
    createdByName: owner.name,
    // The schedule task this order belongs to ("Order and install windows and doors").
    scheduleTaskKey: "s13",
  });

  // ── Material selections (two of them on the purchase order) ──────────────
  type Mat = [letter: string, category: string, location: string, product: string, maker: string, model: string, finish: string, spec: string, status: "PROPOSED" | "SUBMITTED" | "APPROVED" | "ORDERED", qty: number, unit: string, unitCost: number, onPo: boolean];
  const mats: Mat[] = [
    ["A", L("Windows & Doors", "Ventanas y puertas"), L("Living area and terrace", "Estar y terraza"), L("Aluminium sliding door 3200 x 2400", "Puerta corrediza de aluminio 3200 x 2400"), "Harbour", "SD-3224", L("Anodised, dark bronze", "Anodizado, bronce oscuro"), L("6 mm clear tempered glass, stainless rollers.", "Vidrio templado claro de 6 mm, rodamientos de acero inoxidable."), "ORDERED", 2, "no", 2150, true],
    ["B", L("Windows & Doors", "Ventanas y puertas"), L("Bedrooms and kitchen", "Dormitorios y cocina"), L("Aluminium window 1500 x 1200", "Ventana de aluminio 1500 x 1200"), "Harbour", "W-1512", L("Anodised, dark bronze", "Anodizado, bronce oscuro"), L("6 mm clear glass, two sliding leaves.", "Vidrio claro de 6 mm, dos hojas corredizas."), "ORDERED", 8, "no", 520, true],
    ["C", L("Flooring", "Pisos"), L("All rooms except bathrooms", "Todos los ambientes salvo baños"), L("Porcelain floor tile 600 x 600", "Porcelanato de piso 600 x 600"), "Terra", "PT-6060-SAND", L("Matt, sand", "Mate, arena"), L("Rectified, slip rating R10.", "Rectificado, resistencia al deslizamiento R10."), "APPROVED", 228, "m²", 38, false],
    ["D", L("Paint & Coatings", "Pinturas y recubrimientos"), L("Internal walls", "Muros interiores"), L("Washable emulsion paint", "Pintura vinílica lavable"), "Coral", "EM-200", L("Matt, warm white", "Mate, blanco cálido"), L("Three coats on a primer.", "Tres manos sobre sellador."), "PROPOSED", 1120, "m²", 2.6, false],
  ];
  for (const [letter, category, location, productName, manufacturer, modelNumber, finish, specification, status, quantity, unit, unitCost, onPo] of mats) {
    plan.materialSelection.push({
      id: newId(),
      companyId,
      tag: num("MS", letter),
      projectId,
      projectName,
      category,
      location,
      productName: `${W} - ${productName}`,
      manufacturer,
      modelNumber,
      finish,
      specification,
      status,
      currency,
      quantity,
      unit,
      unitCost,
      totalCost: round2(quantity * unitCost),
      supplier: onPo ? supplier : null,
      purchaseOrderId: onPo ? poId : null,
      approvedBy: status === "PROPOSED" ? null : clientPerson,
      selectedDate: at(status === "PROPOSED" ? -5 : -40),
      notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
      createdById: owner.id,
      createdByName: owner.name,
    });
  }

  // ── Design deliverables ──────────────────────────────────────────────────
  type Deliv = [number: string, title: string, discipline: "ARCHITECTURE" | "ENGINEERING" | "INTERIOR", type: "DRAWING" | "SPECIFICATION" | "REPORT" | "SCHEDULE", rev: string, status: "ISSUED" | "APPROVED" | "IN_REVIEW" | "DRAFT", scale: string | null, issued: number | null, due: number | null];
  const delivs: Deliv[] = [
    ["SMP-A-101", L("Ground floor plan", "Planta baja"), "ARCHITECTURE", "DRAWING", "C", "ISSUED", "1:100", -50, null],
    ["SMP-A-201", L("Elevations", "Alzados"), "ARCHITECTURE", "DRAWING", "B", "ISSUED", "1:100", -50, null],
    ["SMP-A-301", L("Sections", "Secciones"), "ARCHITECTURE", "DRAWING", "B", "APPROVED", "1:50", -50, null],
    ["SMP-A-901", L("Outline specification", "Especificaciones generales"), "ARCHITECTURE", "SPECIFICATION", "A", "ISSUED", null, -50, null],
    ["SMP-S-102", L("Foundation and roof slab layout", "Planta de cimentación y losa de cubierta"), "ENGINEERING", "DRAWING", "B", "ISSUED", "1:100", -60, null],
    ["SMP-S-900", L("Structural calculation report", "Memoria de cálculo estructural"), "ENGINEERING", "REPORT", "A", "APPROVED", null, -62, null],
    ["SMP-I-401", L("Kitchen joinery layout", "Distribución de la carpintería de cocina"), "INTERIOR", "DRAWING", "P1", "IN_REVIEW", "1:20", null, 21],
    ["SMP-I-801", L("Finishes schedule", "Cuadro de acabados"), "INTERIOR", "SCHEDULE", "P1", "DRAFT", null, null, 35],
  ];
  for (const [number, title, discipline, type, revision, status, scale, issued, due] of delivs) {
    plan.designDeliverable.push({
      id: newId(),
      companyId,
      number,
      title: `${W} - ${title}`,
      discipline,
      type,
      revision,
      status,
      projectId,
      projectName,
      scale,
      sheetSize: type === "DRAWING" ? "A1" : "A4",
      issuedTo: issued === null ? null : builder,
      issuedDate: issued === null ? null : at(issued),
      dueDate: due === null ? null : at(due),
      notes: L("Part of the sample set. No file is linked to this sample.", "Parte del conjunto de ejemplo. Este ejemplo no tiene archivo vinculado."),
      createdById: owner.id,
      createdByName: owner.name,
    });
  }

  // ── General document: a letter of transmittal, composed by the catalogue ─
  const gdNumber = num("GD");
  const gdReference = `${projectNumber}/T-01`;
  const gdValues: Record<string, string> = {
    enclosures: L(
      "SMP-A-101 Ground floor plan, revision C, 2 copies\nSMP-A-201 Elevations, revision B, 2 copies\nSMP-S-102 Foundation and roof slab layout, revision B, 2 copies",
      "SMP-A-101 Planta baja, revisión C, 2 copias\nSMP-A-201 Alzados, revisión B, 2 copias\nSMP-S-102 Planta de cimentación y losa de cubierta, revisión B, 2 copias",
    ),
    purpose: "Construction",
    actionRequired: L("Build from these revisions and withdraw the earlier ones from site.", "Construir con estas revisiones y retirar del sitio las anteriores."),
    returnBy: iso(-43),
    method: "By hand",
  };
  const composed = compose(
    "transmittal_letter",
    {
      firmName: companyName,
      clientName,
      projectName,
      projectAddress: siteAddress,
      counterpartyName: builder,
      counterpartyAddress: L("8 Quarry Road, Palm Bay", "Camino de la Cantera 8, Bahía Palmera"),
      contactName: builderPerson,
      reference: gdReference,
      number: gdNumber,
      issueDate: iso(-50),
    },
    gdValues,
  );
  if (!composed) throw new Error("Sample general document: the transmittal letter is not in the catalogue.");
  plan.generalDocument.push({
    id: newId(),
    companyId,
    number: gdNumber,
    docType: "transmittal_letter",
    status: "ISSUED",
    title: `${W} - ${composed.title}`,
    reference: gdReference,
    subject: L("Construction documents issued for construction", "Documentos de construcción emitidos para construcción"),
    clientId,
    clientName,
    projectId,
    projectName,
    counterpartyName: builder,
    counterpartyAddress: L("8 Quarry Road, Palm Bay", "Camino de la Cantera 8, Bahía Palmera"),
    contactName: builderPerson,
    contactEmail: "site@example.net",
    issueDate: at(-50),
    effectiveDate: at(-50),
    values: gdValues,
    body: composed.body,
    notes: L("Part of the sample set.", "Parte del conjunto de ejemplo."),
    createdById: owner.id,
    createdByName: owner.name,
    issuedByName: owner.name,
  });

  // ── Construction contract (the typeset agreement; no template PDF needed) ─
  const contractPhases = [
    { phase: "1", description: L("On signing", "A la firma"), detail: L("Mobilisation and site setup", "Movilización e instalación de obra"), percent: 10 },
    { phase: "2", description: L("Foundations complete", "Cimentación terminada"), detail: L("After the foundation inspection", "Tras la inspección de cimentación"), percent: 20 },
    { phase: "3", description: L("Roof slab poured", "Losa de cubierta vaciada"), detail: L("Structure complete", "Estructura terminada"), percent: 25 },
    { phase: "4", description: L("Walls, plaster and services first fix", "Muros, revoque e instalaciones en bruto"), detail: L("Building weathertight", "Edificio cerrado"), percent: 25 },
    { phase: "5", description: L("Practical completion", "Terminación sustancial"), detail: L("After the final inspection", "Tras la inspección final"), percent: 20 },
  ];
  const built = buildSchedule({ contractSum: CONSTRUCTION_SUM, currency, phases: contractPhases });
  const facts: ContractFacts = {
    projectId,
    projectName,
    projectNumber,
    siteAddress,
    employerName: clientName,
    employerAddress: L("27 Orchard Road, Palm Bay", "Camino del Huerto 27, Bahía Palmera"),
    employerContact: clientPerson,
    employerEmail: clientEmail,
    employerPhone: "+1 555 0100",
    contractorName: builder,
    contractorAddress: L("8 Quarry Road, Palm Bay", "Camino de la Cantera 8, Bahía Palmera"),
    contractorContact: builderPerson,
    contractorEmail: "site@example.net",
    contractorPhone: "+1 555 0140",
    administratorName: companyName,
    contractSum: CONSTRUCTION_SUM,
    currency,
    exchangeRate: 1.75,
    scopeSummary: L(
      "Construction of a 240 m² single-storey house with a covered terrace, complete, in accordance with the construction documents.",
      "Construcción completa de una vivienda de una planta de 240 m² con terraza cubierta, conforme a los documentos de construcción.",
    ),
    commencementDate: iso(-45),
    completionDate: iso(160),
    contractPeriodDays: 205,
    liquidatedDamagesPerDay: 150,
    defectsLiabilityMonths: 12,
    retentionPercent: 5,
    phases: contractPhases,
    notes: L("Part of the sample set. Not a real agreement.", "Parte del conjunto de ejemplo. No es un contrato real."),
  };
  const contractBody: ContractBody = {
    language: L("English", "Spanish"),
    title: S("Construction Agreement", "Contrato de construcción"),
    subtitle: projectName,
    parties: [
      { role: L("The Employer", "El Propietario"), text: `${L("Name", "Nombre")}: ${clientName}\n${L("Address", "Dirección")}: ${facts.employerAddress}\n${L("Contact", "Contacto")}: ${clientPerson}` },
      { role: L("The Contractor", "El Contratista"), text: `${L("Name", "Nombre")}: ${builder}\n${L("Address", "Dirección")}: ${facts.contractorAddress}\n${L("Contact", "Contacto")}: ${builderPerson}` },
    ],
    recitals: [
      L("The Employer wishes to build a single-family house on the site and has had construction documents prepared.", "El Propietario desea construir una vivienda unifamiliar en el sitio y ha hecho preparar los documentos de construcción."),
      L("The Contractor has examined the site and the documents and has offered to carry out the works for the contract sum.", "El Contratista ha examinado el sitio y los documentos y ha ofrecido ejecutar las obras por el precio del contrato."),
    ],
    articles: [
      { number: "1", heading: L("The works", "Las obras"), paragraphs: [facts.scopeSummary, L("The construction documents listed in the letter of transmittal form part of this agreement.", "Los documentos de construcción enumerados en la carta de remisión forman parte de este contrato.")] },
      { number: "2", heading: L("Contract sum", "Precio del contrato"), paragraphs: [L("The contract sum is a fixed lump sum. It changes only by a written change order signed by both parties.", "El precio del contrato es una suma global fija. Solo cambia mediante una orden de cambio escrita y firmada por ambas partes.")] },
      { number: "3", heading: L("Time for completion", "Plazo de ejecución"), paragraphs: [L("The works start on the commencement date and reach practical completion within 205 calendar days. Liquidated damages apply for each day of delay not covered by an accepted extension.", "Las obras inician en la fecha de inicio y alcanzan la terminación sustancial en 205 días calendario. Se aplican penalidades por cada día de retraso no cubierto por una prórroga aceptada.")] },
      { number: "4", heading: L("Payment", "Pagos"), paragraphs: [L("The contract sum is paid in the instalments below, each against a payment certificate issued by the contract administrator. Five percent is retained until the end of the defects liability period.", "El precio del contrato se paga en las cuotas siguientes, cada una contra un certificado de pago emitido por el administrador del contrato. Se retiene el cinco por ciento hasta el final del período de garantía.")] },
      { number: "5", heading: L("Changes and instructions", "Cambios e instrucciones"), paragraphs: [L("Site instructions are given in writing by the contract administrator. A change that affects cost or time is agreed as a change order before the work is done.", "Las instrucciones de obra las da por escrito el administrador del contrato. Un cambio que afecte costo o plazo se acuerda como orden de cambio antes de ejecutar el trabajo.")] },
      { number: "6", heading: L("Defects liability", "Garantía por defectos"), paragraphs: [L("The Contractor makes good, at its own cost, any defect that appears within 12 months of practical completion.", "El Contratista repara a su costo todo defecto que aparezca dentro de los 12 meses siguientes a la terminación sustancial.")] },
    ],
    schedule: built.rows,
    scheduleArticle: "4",
    signatures: [
      { role: L("The Employer", "El Propietario"), name: clientPerson },
      { role: L("The Contractor", "El Contratista"), name: builderPerson },
    ],
    changes: [],
    check: [],
  };
  plan.constructionContract.push({
    id: newId(),
    companyId,
    number: num("CC"),
    status: "ISSUED",
    projectId,
    projectName,
    projectNumber,
    employerName: clientName,
    contractorName: builder,
    currency,
    contractSum: CONSTRUCTION_SUM,
    exchangeRate: 1.75,
    facts: facts as unknown as Prisma.InputJsonValue,
    body: contractBody as unknown as Prisma.InputJsonValue,
    issuedAt: at(-47),
    createdById: owner.id,
    createdByName: owner.name,
    createdAt: at(-49),
  });

  // ── Finance: one settled invoice, with the time and the expense it bills ─
  // Stored ISSUED with one payment for the full amount, which the app reads as
  // PAID: it is never outstanding, never overdue and never chased.
  const invoiceId = newId();
  const invoiceNumber = num("INV");
  const firstMilestone = plan.serviceProposalPaymentMilestone[0];
  const CHARGE_RATE = 95;
  const COST_RATE = 55;
  const billedHours = 6;
  const expenseAmount = 180;
  const expenseMarkup = 10;
  const lineIds = [newId(), newId(), newId()];
  const invLines = [
    {
      id: lineIds[0],
      description: String(firstMilestone.invoiceDescription),
      milestoneId: String(firstMilestone.id),
      milestoneName: firstMilestone.name,
      quantity: null as number | null,
      unitRate: null as number | null,
      amount: Number(firstMilestone.amount),
    },
    {
      id: lineIds[1],
      description: L("Additional site visit for the foundation inspection, 6 hours", "Visita adicional al sitio para la inspección de cimentación, 6 horas"),
      milestoneId: null as string | null,
      milestoneName: null as string | null,
      quantity: billedHours,
      unitRate: CHARGE_RATE,
      amount: round2(billedHours * CHARGE_RATE),
    },
    {
      id: lineIds[2],
      description: L("Printing of the permit submission set, at cost plus 10%", "Impresión del juego para el permiso, al costo más 10%"),
      milestoneId: null,
      milestoneName: null,
      quantity: null,
      unitRate: null,
      amount: round2(expenseAmount * (1 + expenseMarkup / 100)),
    },
  ];
  const inv = invoiceTotals(invLines.map((l) => ({ amount: l.amount, taxable: true })), { percent: TAX_PERCENT, mode: "EXCLUSIVE" }, currency);
  plan.invoice.push({
    id: invoiceId,
    companyId,
    number: invoiceNumber,
    status: "ISSUED",
    currency,
    clientId,
    clientName,
    contactName: clientPerson,
    contactEmail: clientEmail,
    billingAddress: L("27 Orchard Road, Apartment 3B, Palm Bay", "Camino del Huerto 27, Apartamento 3B, Bahía Palmera"),
    projectId,
    projectName,
    serviceProposalId: proposalId,
    proposalNumber,
    title: S("Fee invoice 1: on signing", "Factura de honorarios 1: a la firma"),
    intro: L(
      "This invoice is part of the sample set. It shows an invoice raised from a proposal's payment milestone, with billed time and a recharged expense, paid in full.",
      "Esta factura forma parte del conjunto de ejemplo. Muestra una factura emitida desde un hito de pago de la propuesta, con horas facturadas y un gasto recargado, pagada en su totalidad.",
    ),
    issueDate: at(-24),
    dueDate: at(6),
    termsDays: 30,
    taxName,
    taxPercent: TAX_PERCENT,
    taxMode: "EXCLUSIVE",
    subtotal: inv.subtotal,
    taxableSubtotal: inv.taxableSubtotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    notes: L("SAMPLE invoice. Not a real receivable.", "Factura de EJEMPLO. No es una cuenta por cobrar real."),
    footer: L("Thank you.", "Gracias."),
    createdById: owner.id,
    createdByName: owner.name,
    issuedByName: owner.name,
  });
  invLines.forEach((l, i) => {
    plan.invoiceLine.push({
      id: l.id,
      companyId,
      invoiceId,
      description: l.description,
      milestoneId: l.milestoneId,
      milestoneName: l.milestoneName,
      quantity: l.quantity,
      unitRate: l.unitRate,
      amount: l.amount,
      taxable: true,
      sortOrder: i,
    });
  });
  plan.invoicePayment.push({
    id: newId(),
    companyId,
    invoiceId,
    // Paid on the day it was issued (the milestone is "on signing"), so the
    // invoice and its payment always fall in the same period of the tax report,
    // whichever basis the practice reads it on.
    paidAt: at(-24),
    amount: inv.total,
    method: "BANK_TRANSFER",
    reference: `SMP-${token}-PAY`,
    notes: L("SAMPLE payment in full.", "Pago de EJEMPLO por el total."),
    recordedById: owner.id,
    recordedByName: owner.name,
  });
  plan.timeEntry.push(
    {
      id: newId(),
      companyId,
      userId: owner.id,
      userName: owner.name,
      projectId,
      projectName,
      phaseId: phaseIds[5],
      phaseName: phaseRows[5].name,
      date: at(-38),
      hours: billedHours,
      billable: true,
      chargeRate: CHARGE_RATE,
      costRate: COST_RATE,
      currency,
      description: S("Foundation inspection on site with the engineer", "Inspección de cimentación en el sitio con la ingeniera"),
      status: "APPROVED",
      submittedAt: at(-37),
      approvedAt: at(-36),
      approvedById: owner.id,
      approvedByName: owner.name,
      // Already billed on the sample invoice, so it is never offered as real unbilled work.
      invoicedAt: at(-24),
      invoiceId,
      invoiceNumber,
      invoiceLineId: lineIds[1],
    },
    {
      id: newId(),
      companyId,
      userId: owner.id,
      userName: owner.name,
      projectId,
      projectName,
      phaseId: phaseIds[5],
      phaseName: phaseRows[5].name,
      date: at(-7),
      hours: 2.5,
      billable: false,
      chargeRate: CHARGE_RATE,
      costRate: COST_RATE,
      currency,
      description: S("Site meeting no. 4 and minutes (not billable)", "Reunión de obra n.º 4 y acta (no facturable)"),
      status: "APPROVED",
      submittedAt: at(-6),
      approvedAt: at(-5),
      approvedById: owner.id,
      approvedByName: owner.name,
    },
  );
  plan.expense.push({
    id: newId(),
    companyId,
    userId: owner.id,
    userName: owner.name,
    projectId,
    projectName,
    date: at(-91),
    category: "PRINTING",
    vendor: S("Copy Centre", "Centro de copiado"),
    description: S("Permit submission set, 3 copies A1", "Juego para el permiso, 3 copias A1"),
    amount: expenseAmount,
    currency,
    billable: true,
    markupPercent: expenseMarkup,
    reimbursable: false,
    status: "APPROVED",
    submittedAt: at(-90),
    approvedAt: at(-89),
    approvedById: owner.id,
    approvedByName: owner.name,
    invoicedAt: at(-24),
    invoiceId,
    invoiceNumber,
    invoiceLineId: lineIds[2],
  });

  return plan;
}
