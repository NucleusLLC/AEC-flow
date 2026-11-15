/**
 * Turning an accepted Service Proposal into a project. PURE — no Prisma, no React.
 *
 * Release D of docs/proposal-module/: the proposal the client accepted becomes
 * the project the practice runs. What carries across, and why:
 *
 *  - CLIENT. The project's client is the proposal's client RECORD. A proposal
 *    can name a client in free text only; a project cannot exist without a
 *    client record, so that case is refused with a sentence that says what to
 *    fix, rather than inventing a client.
 *  - PHASES. The proposal's fee phases become the project's phases, in order.
 *    A proposal without phases gets the same six standard phases a project made
 *    by hand gets, so the new project is usable either way.
 *  - DISCIPLINES. A proposal's disciplines are free-text keys and labels; the
 *    project's are a fixed list. Each is matched by keyword; one that matches
 *    nothing is left off rather than guessed.
 *  - VALUE. The project's contract value is the fee the practice earns — the
 *    grand total LESS tax. Tax is collected for the government, not earned, and
 *    counting it would overstate every project's value by the tax rate.
 *
 * MONEY IS NEVER A FLOAT HERE: lib/proposals/engine/money.ts, as everywhere else.
 */
import { fromMajor, subtract, toMajor } from "@/lib/proposals/engine/money";
import type { ServiceProposalStatus } from "@/lib/proposals/engine/status";

/** The project disciplines (prisma enum `Discipline`), kept here so this file stays client-safe. */
export type ProjectDiscipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT"
  | "CONSTRUCTION";

/** The phases a project made by hand starts with (lib/data/projects.ts). */
export const STANDARD_PROJECT_PHASES: readonly string[] = [
  "Concept Design",
  "Schematic Design",
  "Detailed Design",
  "Tender Documentation",
  "Construction Support",
  "Handover",
];

/** Statuses a proposal can be converted from. */
const CONVERTIBLE: readonly ServiceProposalStatus[] = ["ACCEPTED", "PARTIALLY_ACCEPTED"];

export type ConvertBlocker = "status" | "client" | "alreadyLinked";

/**
 * Why a proposal cannot be turned into a NEW project, or null when it can.
 *
 * A proposal that already points at a project is not blocked from being marked
 * converted — it is blocked from making a second project. The caller decides
 * which of the two it is doing.
 */
export function convertBlocker(p: {
  status: ServiceProposalStatus;
  clientId: string | null | undefined;
  projectId: string | null | undefined;
}): ConvertBlocker | null {
  if (!CONVERTIBLE.includes(p.status)) return "status";
  if (p.projectId) return "alreadyLinked";
  if (!p.clientId) return "client";
  return null;
}

/** The sentence a person sees for each blocker. English = i18n key. */
export const CONVERT_BLOCKER_MESSAGE: Record<ConvertBlocker, string> = {
  status: "Only an accepted proposal can become a project.",
  client: "This proposal names its client in text only. Choose the client from the client list on the proposal first, then create the project.",
  alreadyLinked: "This proposal is already linked to a project.",
};

const WORDS: Record<ProjectDiscipline, RegExp> = {
  ARCHITECTURE: /architect|arquitect|bouwkund/i,
  STRUCTURAL: /struct|estructur|constructief|civil|engineer|ingenier/i,
  INTERIOR: /interior|interieur/i,
  MEP: /\bmep\b|m\.e\.p|mechanical|electrical|plumbing|hvac|install/i,
  PROJECT_MANAGEMENT: /manag|gesti[oó]n|beheer|directie/i,
  CONSTRUCTION: /construction|supervis|toezicht|obra/i,
};

/** The project list order, which is the order returned. */
const PROJECT_ORDER: readonly ProjectDiscipline[] = [
  "ARCHITECTURE",
  "STRUCTURAL",
  "INTERIOR",
  "MEP",
  "PROJECT_MANAGEMENT",
  "CONSTRUCTION",
];

/**
 * Most specific first: "MEP engineering" is MEP, not structural engineering,
 * and "Arquitectura de interiores" is interior, not architecture.
 */
const MATCH_ORDER: readonly ProjectDiscipline[] = [
  "INTERIOR",
  "MEP",
  "PROJECT_MANAGEMENT",
  "CONSTRUCTION",
  "STRUCTURAL",
  "ARCHITECTURE",
];

/**
 * The project disciplines a proposal's disciplines map to, in the project
 * list's own order, each at most once. A discipline matching nothing is left out.
 */
export function projectDisciplines(
  disciplines: readonly { disciplineKey?: string | null; label?: string | null }[],
): ProjectDiscipline[] {
  const found = new Set<ProjectDiscipline>();
  for (const d of disciplines) {
    const text = `${d.disciplineKey ?? ""} ${d.label ?? ""}`;
    for (const discipline of MATCH_ORDER) {
      if (WORDS[discipline].test(text)) {
        found.add(discipline);
        break;
      }
    }
  }
  return PROJECT_ORDER.filter((d) => found.has(d));
}

/** The project's phase names, in order: the proposal's own, or the standard six. */
export function projectPhaseNames(
  phases: readonly { name?: string | null; sortOrder?: number | null }[],
): string[] {
  const named = [...phases]
    .map((p, i) => ({ name: (p.name ?? "").trim(), order: p.sortOrder ?? i, i }))
    .filter((p) => p.name)
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((p) => p.name.slice(0, 200));
  return named.length > 0 ? named : [...STANDARD_PROJECT_PHASES];
}

/** The project's contract value: the proposal's grand total less its tax, never below zero. */
export function projectContractValue(p: {
  currency: string;
  grandTotal: number | string | null | undefined;
  taxTotal: number | string | null | undefined;
}): number {
  const net = subtract(fromMajor(p.grandTotal, p.currency), fromMajor(p.taxTotal, p.currency));
  return net.minor > 0 ? toMajor(net) : 0;
}
