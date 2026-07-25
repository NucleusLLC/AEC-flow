/**
 * Built-in project-type proposal templates.
 *
 * A template is a starting point the user then edits — it prefills fee lines, the phase
 * split, and the scope/exclusions/assumptions/terms text so a proposal for a common project
 * type can be produced in a minute. CLIENT-SAFE (pure data, no I/O); the form applies one to
 * its local state.
 *
 * Percentages and phase splits are conventional defaults, not firm policy — every value stays
 * editable. Fee percentages assume the basis is estimated construction cost.
 *
 * No placeholder prose — the scope/exclusion/assumption text is usable as-is.
 */
import type { CostBasisType, FeeMethod, ServiceCategory } from "./engine/types";

export interface TemplateFee {
  label: string;
  method: FeeMethod;
  category: ServiceCategory;
  percent?: number;
  fixedAmount?: number;
  quantity?: number;
  unitRate?: number;
}

export interface TemplatePhase {
  name: string;
  percentage: number;
}

export interface ProposalTemplate {
  key: string;
  name: string;
  group: "Architecture" | "Interior" | "Engineering" | "Other";
  description: string;
  defaultBasis: CostBasisType;
  fees: TemplateFee[];
  phases: TemplatePhase[];
  scopeSummary: string;
  exclusions: string;
  assumptions: string;
  terms: string;
}

/** The standard architectural phase split. */
const ARCH_PHASES: TemplatePhase[] = [
  { name: "Concept Design", percentage: 10 },
  { name: "Schematic Design", percentage: 15 },
  { name: "Design Development", percentage: 35 },
  { name: "Construction Documents", percentage: 40 },
];

const INTERIOR_PHASES: TemplatePhase[] = [
  { name: "Concept & space planning", percentage: 20 },
  { name: "Design development", percentage: 30 },
  { name: "FF&E selection", percentage: 30 },
  { name: "Documentation & handover", percentage: 20 },
];

const ENGINEERING_PHASES: TemplatePhase[] = [
  { name: "Preliminary design", percentage: 25 },
  { name: "Detailed design & calculations", percentage: 40 },
  { name: "Construction documentation", percentage: 25 },
  { name: "Site support", percentage: 10 },
];

const STD_EXCLUSIONS =
  "Land surveying, geotechnical investigation, environmental or hazardous-material testing, " +
  "quantity surveying, legal services, government and permit fees, and any specialist " +
  "consultant not expressly listed are excluded.";

const STD_ASSUMPTIONS =
  "The client will provide accurate site and ownership information and timely decisions. " +
  "Construction-cost figures are preliminary estimates unless independently verified. The fee " +
  "assumes a defined number of design revisions; major client-directed changes may constitute " +
  "additional services.";

const STD_TERMS =
  "This proposal is valid for 30 days from its date. Fees are invoiced per phase, net 30 days. " +
  "Intellectual property in the documents remains with the consultant until fees are paid in " +
  "full. This proposal is subject to the consultant's standard terms of engagement.";

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    key: "single_family_residence",
    name: "Single-family residence",
    group: "Architecture",
    description: "Full architectural service for a new private home.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Architectural design services", method: "PERCENT_OF_BASIS", category: "BASE", percent: 8 }],
    phases: ARCH_PHASES,
    scopeSummary:
      "Full architectural design of a new single-family residence, from concept through " +
      "construction documents, including coordination of structural and MEP consultants.",
    exclusions: STD_EXCLUSIONS,
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "commercial_building",
    name: "Commercial building",
    group: "Architecture",
    description: "New commercial / office building, base architectural service.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Architectural design services", method: "PERCENT_OF_BASIS", category: "BASE", percent: 6 }],
    phases: ARCH_PHASES,
    scopeSummary:
      "Architectural design of a new commercial building through construction documents, with " +
      "consultant coordination and permit-drawing preparation.",
    exclusions: STD_EXCLUSIONS,
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "hotel_resort",
    name: "Hotel / resort",
    group: "Architecture",
    description: "Hospitality project with architecture plus interior design.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [
      { label: "Architectural design services", method: "PERCENT_OF_BASIS", category: "BASE", percent: 6.5 },
      { label: "Interior design", method: "FIXED", category: "BASE", fixedAmount: 120000 },
      { label: "Renderings & visualisation", method: "FIXED", category: "OPTIONAL", fixedAmount: 18000 },
    ],
    phases: ARCH_PHASES,
    scopeSummary:
      "Integrated architecture and interior design for a hospitality development, including " +
      "guest-room and public-area design, through construction documents.",
    exclusions: STD_EXCLUSIONS,
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "residential_interior",
    name: "Residential interior design",
    group: "Interior",
    description: "Interior design for a private residence, fixed fee.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [
      { label: "Interior design services", method: "FIXED", category: "BASE", fixedAmount: 45000 },
      { label: "FF&E procurement management", method: "PERCENT_OF_BASIS", category: "OPTIONAL", percent: 10 },
    ],
    phases: INTERIOR_PHASES,
    scopeSummary:
      "Interior design of a private residence: space planning, material and finish direction, " +
      "FF&E selection, joinery design, and installation coordination.",
    exclusions:
      "Structural, MEP and lighting-engineering design, the supply of furniture and fittings, " +
      "and building-permit services are excluded unless separately agreed.",
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "commercial_interior_fitout",
    name: "Commercial interior fit-out",
    group: "Interior",
    description: "Office / retail fit-out, area-rate based.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Interior fit-out design", method: "PER_AREA", category: "BASE", quantity: 0, unitRate: 45 }],
    phases: INTERIOR_PHASES,
    scopeSummary:
      "Design of a commercial interior fit-out charged per square metre of floor area, from " +
      "concept through documentation for tender.",
    exclusions:
      "Base-building alterations, MEP engineering, and landlord-required approvals are excluded.",
    assumptions:
      "Enter the floor area as the quantity on the fee line. " + STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "structural_engineering",
    name: "Structural engineering",
    group: "Engineering",
    description: "Structural design as a subconsultant or direct service.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Structural engineering", method: "PERCENT_OF_BASIS", category: "BASE", percent: 1.25 }],
    phases: ENGINEERING_PHASES,
    scopeSummary:
      "Structural engineering design and calculations through construction documentation, " +
      "including shop-drawing review and periodic site inspections.",
    exclusions: STD_EXCLUSIONS,
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "mep_engineering",
    name: "MEP engineering",
    group: "Engineering",
    description: "Mechanical, electrical and plumbing design.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "MEP engineering", method: "PERCENT_OF_BASIS", category: "BASE", percent: 1.75 }],
    phases: ENGINEERING_PHASES,
    scopeSummary:
      "Mechanical, electrical and plumbing design and documentation, with load calculations, " +
      "coordination and construction-phase support.",
    exclusions: STD_EXCLUSIONS,
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "feasibility_study",
    name: "Feasibility study",
    group: "Other",
    description: "Fixed-fee feasibility / pre-design study.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Feasibility study", method: "FIXED", category: "BASE", fixedAmount: 15000 }],
    phases: [{ name: "Feasibility study", percentage: 100 }],
    scopeSummary:
      "A feasibility study assessing site constraints, indicative massing, order-of-magnitude " +
      "cost and programme, delivered as a summary report.",
    exclusions:
      "Detailed design, statutory approvals and independent cost verification are excluded.",
    assumptions: STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
  {
    key: "construction_admin_only",
    name: "Construction administration only",
    group: "Other",
    description: "Monthly construction-phase service.",
    defaultBasis: "ESTIMATED_CONSTRUCTION_COST",
    fees: [{ label: "Construction administration", method: "MONTHLY", category: "BASE", quantity: 10, unitRate: 8000 }],
    phases: [{ name: "Construction administration", percentage: 100 }],
    scopeSummary:
      "Construction-phase administration: site observation, RFIs, submittal review, payment " +
      "certification and change-order review, charged monthly for the construction period.",
    exclusions:
      "Design services, full-time site supervision, and responsibility for contractor means " +
      "and methods are excluded.",
    assumptions:
      "Enter the number of months as the quantity on the fee line. " + STD_ASSUMPTIONS,
    terms: STD_TERMS,
  },
];

export function getTemplate(key: string): ProposalTemplate | undefined {
  return PROPOSAL_TEMPLATES.find((t) => t.key === key);
}
