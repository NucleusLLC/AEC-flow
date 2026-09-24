/**
 * Construction contracts — client-safe types and label tables.
 *
 * CLIENT-SAFE. No Prisma import, no "server-only": the contract screens are
 * client components, and importing the generated enums here would drag the
 * server into the browser bundle. The unions below mirror the schema's enums
 * exactly, and `lib/contracts/enums.test.ts` fails the build if they drift —
 * the same tripwire the finance and permit modules carry.
 *
 * THE DOCUMENT IS STRUCTURE, NOT HTML. `ContractBody` is what the model returns
 * and what the row stores: a title, the parties, the recitals, numbered
 * articles of paragraphs, a payment schedule and signature blocks. Typesetting
 * is a render of this, so a change to the letterhead fixes every contract ever
 * made. See docs/contracts/PLAN.md.
 */

export type ContractStatus = "DRAFT" | "ISSUED" | "SIGNED" | "SUPERSEDED" | "VOID";

export const CONTRACT_STATUSES: ContractStatus[] = [
  "DRAFT",
  "ISSUED",
  "SIGNED",
  "SUPERSEDED",
  "VOID",
];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SIGNED: "Signed",
  SUPERSEDED: "Superseded",
  VOID: "Void",
};

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  DRAFT: "slate",
  ISSUED: "blue",
  SIGNED: "green",
  SUPERSEDED: "amber",
  VOID: "red",
};

/* ------------------------------------------------------------------ *
 * The document
 * ------------------------------------------------------------------ */

export type ContractParty = {
  /** `CONTRACTOR`, `EMPLOYER`, `OWNER` — the template's own word, in capitals. */
  role: string;
  /** One paragraph of `Label: value` particulars, which the layout reads as a card. */
  text: string;
};

export type ContractArticle = {
  /** `1`, `11.1` — exactly as the template numbers it. */
  number: string;
  heading: string;
  paragraphs: string[];
};

/**
 * One payment instalment.
 *
 * THE FIGURES HERE ARE THE APP'S, NOT THE MODEL'S. `percent`, `amountAwg` and
 * `amountUsd` are recomputed by `lib/contracts/schedule.ts` in integer cents
 * before the document is stored, whatever the model returned. The model
 * supplies the WORDS: the instalment's name and when it falls due.
 */
export type ContractPhase = {
  /** `1`, `2`, `Final` — the template's own label for the row. */
  phase: string;
  /** The instalment's short name, in the contract's words. */
  description: string;
  /** When it falls due, in the contract's words. Empty when the template says none. */
  detail: string;
  percent: number;
  amountAwg: number;
  amountUsd: number;
};

export type ContractSignature = {
  role: string;
  name: string;
};

export type ContractBody = {
  /** The language the template is written in — the contract keeps it. */
  language: string;
  title: string;
  subtitle: string;
  parties: ContractParty[];
  recitals: string[];
  articles: ContractArticle[];
  schedule: ContractPhase[];
  /** The article the schedule belongs under, matching an `article.number`. */
  scheduleArticle: string;
  signatures: ContractSignature[];
  /** Every fact the model inserted, as `<what>: <old> → <new>`. Never printed. */
  changes: string[];
  /** What it could not fill or was unsure of. Never printed. */
  check: string[];
};

export const EMPTY_BODY: ContractBody = {
  language: "English",
  title: "",
  subtitle: "",
  parties: [],
  recitals: [],
  articles: [],
  schedule: [],
  scheduleArticle: "",
  signatures: [],
  changes: [],
  check: [],
};

/* ------------------------------------------------------------------ *
 * The facts that go in
 * ------------------------------------------------------------------ */

/** A phase as the user enters it: a name, when it is due, and a percentage. */
export type PhaseInput = {
  phase: string;
  description: string;
  detail: string;
  percent: number;
};

export type ContractFacts = {
  projectId: string | null;
  /** Free text when there is no project row — a contract can precede one. */
  projectName: string;
  projectNumber: string;
  siteAddress: string;

  employerName: string;
  employerAddress: string;
  employerContact: string;
  employerEmail: string;
  employerPhone: string;

  contractorName: string;
  contractorAddress: string;
  contractorContact: string;
  contractorEmail: string;
  contractorPhone: string;

  /** The architect or engineer administering the contract — often this practice. */
  administratorName: string;

  /** Integer major units. The one figure everything else is derived from. */
  contractSum: number;
  currency: string;
  /** AWG per 1 US$. Aruba's peg is 1.75 and that is the default, not a guess. */
  exchangeRate: number;

  scopeSummary: string;
  commencementDate: string;
  completionDate: string;
  /** Calendar days, as the template counts them. */
  contractPeriodDays: number | null;
  /** Per day, in the contract currency. */
  liquidatedDamagesPerDay: number | null;
  defectsLiabilityMonths: number | null;
  retentionPercent: number | null;

  phases: PhaseInput[];
  notes: string;
};

export const EMPTY_FACTS: ContractFacts = {
  projectId: null,
  projectName: "",
  projectNumber: "",
  siteAddress: "",
  employerName: "",
  employerAddress: "",
  employerContact: "",
  employerEmail: "",
  employerPhone: "",
  contractorName: "",
  contractorAddress: "",
  contractorContact: "",
  contractorEmail: "",
  contractorPhone: "",
  administratorName: "",
  contractSum: 0,
  currency: "AWG",
  exchangeRate: 1.75,
  scopeSummary: "",
  commencementDate: "",
  completionDate: "",
  contractPeriodDays: null,
  liquidatedDamagesPerDay: null,
  defectsLiabilityMonths: null,
  retentionPercent: null,
  phases: [],
  notes: "",
};

/** Aruba's florin is pegged at 1.79 to the dollar; 1.75 is the rate the
 *  practice contracts at. A project may save its own. */
export const DEFAULT_EXCHANGE_RATE = 1.75;
