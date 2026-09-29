/**
 * The AI synopsis on a permit Process Summary, written in military style.
 *
 * PURE: the prompt, the output schema and the parser; the call itself is
 * lib/server/permit-ai.ts.
 *
 * WHAT THE MODEL IS GIVEN. Only `dossier()` from process-summary.ts, which is
 * the same facts the printed summary shows. It is told to use nothing else,
 * so a synopsis cannot cite a letter the chronology does not list, invent a
 * date, or promise an outcome.
 *
 * WHAT "MILITARY" MEANS HERE. It means a SITREP: the bottom line up front
 * (BLUF), then the situation, the actions required and the risks, as short
 * numbered points, with dates written 16 SEP 2026 and no filler. The same
 * style is the default for AI documents, so the practice's papers read alike.
 */
import type { Lang } from "@/lib/i18n/types";

export type PermitSynopsis = {
  /** One or two sentences: where the file stands and what matters most. */
  bluf: string;
  situation: string[];
  actions: string[];
  risks: string[];
};

/** Named to the model, so script and variant are never left to chance. */
export const SYNOPSIS_LANGUAGE: Record<Lang, string> = {
  en: "English",
  es: "Spanish",
  nl: "Dutch",
  de: "German",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  pt: "Portuguese (Brazil)",
};

export const SYNOPSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["bluf", "situation", "actions", "risks"],
  properties: {
    bluf: { type: "string", description: "Bottom line up front: one or two sentences." },
    situation: {
      type: "array",
      items: { type: "string" },
      description: "Where the file stands, 2 to 5 short points, oldest context first.",
    },
    actions: {
      type: "array",
      items: { type: "string" },
      description: "What must be done next and by whom, most urgent first, 1 to 5 points. Empty when nothing is owed.",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "What could delay or endanger the permit, 0 to 4 points.",
    },
  },
} as const;

/** Fixed, so it caches across requests; everything that varies is in the user turn. */
export const SYNOPSIS_SYSTEM = [
  "You write situation reports (SITREPs) on building permit applications for an architecture and engineering practice. The reader is a principal who needs the position in thirty seconds.",
  "",
  "Style (military):",
  "- Bottom line up front. The BLUF states where the file stands and the single most important thing about it.",
  "- Short, declarative points. No greetings, no filler, no hedging, no adjectives that carry no fact.",
  "- Write every date as DD MMM YYYY with the month in capitals, for example 16 SEP 2026.",
  "- Name the actor in each action: the practice (\"we\"), the client, or the authority.",
  "",
  "Facts:",
  "- Use only the file given in the user message. Never invent a date, a reference, a name, a decision or a deadline.",
  "- Where the file does not say something that matters, say it is not recorded rather than guessing.",
  "- Do not predict the authority's decision. You may state what is overdue, what is pending and how long the file has been in process.",
  "- The points do not repeat the numbering; the page numbers them.",
].join("\n");

export function buildSynopsisPrompt(dossierText: string, lang: Lang): { system: string; user: string } {
  return {
    system: SYNOPSIS_SYSTEM,
    user: [
      `Write the SITREP in ${SYNOPSIS_LANGUAGE[lang] ?? "English"}. Keep references, names and dates exactly as they appear in the file.`,
      "",
      "<file>",
      dossierText,
      "</file>",
    ].join("\n"),
  };
}

const MAX_POINT = 600;

function points(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim().slice(0, MAX_POINT))
    .filter(Boolean)
    .slice(0, max);
}

/** The model's JSON, checked and trimmed; null when it is not a synopsis. */
export function parseSynopsis(text: string): PermitSynopsis | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bluf = typeof r.bluf === "string" ? r.bluf.trim().slice(0, 800) : "";
  if (!bluf) return null;
  return {
    bluf,
    situation: points(r.situation, 6),
    actions: points(r.actions, 6),
    risks: points(r.risks, 5),
  };
}
