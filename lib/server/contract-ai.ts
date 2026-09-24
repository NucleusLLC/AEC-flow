/**
 * Filling the practice's contract. SERVER-ONLY — it holds the API key.
 *
 * ─── THE MODEL EDITS; IT DOES NOT AUTHOR ────────────────────────────────────
 * The template arrives as a PDF document block, not as scraped text: layout,
 * numbering and clause structure are part of what has to survive, and a text
 * dump throws all three away. The instruction is to keep every word of the
 * contract except the facts, and to say what it changed. A generator that
 * writes its own clauses produces a document nobody has approved.
 *
 * ─── IT IS NEVER ASKED FOR A NUMBER ─────────────────────────────────────────
 * Every instalment is computed here, in integer cents, by
 * `lib/contracts/schedule.ts`, and handed to the model as a finished table. It
 * is asked for the instalment NAMES and for when each falls due — the words
 * that belong to the template. `reconcileSchedule` then puts our figures back
 * over whatever it returned, so a hallucinated total cannot reach a contract.
 *
 * ─── IT IS ASKED FOR THE SHAPES THE TYPESETTER READS ────────────────────────
 * `lib/contracts/layout.ts` recognises `11.1 Title.` sub-clauses, `Label: value`
 * particulars and execution blocks that open with a role in capitals. The
 * prompt asks for exactly those shapes. The two files are one contract in two
 * places — change them together.
 *
 * ─── WHAT IT DOES WITH WHAT IT DOES NOT KNOW ────────────────────────────────
 * `__________`, and a line in `check`. A plausible-looking wrong completion
 * date is worse than a blank, because a blank gets filled in and a wrong date
 * gets signed.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";
import { buildSchedule } from "@/lib/contracts/schedule";
import { amountInWords } from "@/lib/contracts/schedule";
import type { ContractBody, ContractFacts } from "@/lib/contracts/types";

/** Opus for this one: it is a legal document, read once, at length. */
export const CONTRACT_MODEL = "claude-opus-5";

/** A long contract runs to twenty-odd pages of JSON. */
export const MAX_TOKENS = 32_000;

/** Two minutes: a twenty-page contract is a slow read. */
export const AI_TIMEOUT_MS = 180_000;

export class ContractAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractAiError";
  }
}

/** The structured shape the model must return. */
export const CONTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "language",
    "title",
    "subtitle",
    "parties",
    "recitals",
    "articles",
    "schedule",
    "schedule_article",
    "signatures",
    "changes",
    "check",
  ],
  properties: {
    language: {
      type: "string",
      description: "The language the template is written in — the contract keeps it.",
    },
    title: { type: "string" },
    subtitle: { type: "string" },
    parties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "text"],
        properties: {
          role: { type: "string", description: "EMPLOYER, CONTRACTOR — the template's own word, in capitals" },
          text: {
            type: "string",
            description:
              "One paragraph of the party's particulars as `Label: value` pairs joined by ` — `",
          },
        },
      },
    },
    recitals: { type: "array", items: { type: "string" } },
    articles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "heading", "paragraphs"],
        properties: {
          number: { type: "string" },
          heading: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
        },
      },
    },
    schedule: {
      type: "array",
      description: "The payment instalments in order, one row each; empty when the contract has none",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "description", "detail"],
        properties: {
          phase: { type: "string" },
          description: {
            type: "string",
            description: "The instalment's short NAME in the contract's words",
          },
          detail: {
            type: "string",
            description: "When it falls due, in the contract's words; empty if the template says none",
          },
        },
      },
    },
    schedule_article: {
      type: "string",
      description: "The number of the article the schedule belongs under; empty if none",
    },
    signatures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "name"],
        properties: { role: { type: "string" }, name: { type: "string" } },
      },
    },
    changes: {
      type: "array",
      items: { type: "string" },
      description: "Every fact you inserted or replaced, as `<what>: <old> → <new>`",
    },
    check: {
      type: "array",
      items: { type: "string" },
      description: "Anything you could not fill or were unsure of, for the reviewer",
    },
  },
} as const;

/* ------------------------------------------------------------------ *
 * The prompt
 * ------------------------------------------------------------------ */

const line = (label: string, value: string | number | null | undefined): string | null => {
  const v = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : String(value ?? "");
  return v.trim() ? `${label}: ${v.trim()}` : null;
};

/**
 * The deal, as labelled lines.
 *
 * Labelled lines rather than JSON on purpose: the model is reading a contract
 * and filling in fields, and a list that reads like a schedule of particulars
 * is closer to that task than a data structure.
 */
export function factsBlock(facts: ContractFacts, practiceName: string): string {
  const money = (n: number) =>
    `${facts.currency || "AWG"} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const built = buildSchedule({
    contractSum: facts.contractSum,
    currency: facts.currency,
    exchangeRate: facts.exchangeRate,
    phases: facts.phases,
  });

  const rows = built.rows.map(
    (r, i) =>
      `  ${i + 1}. ${r.phase} — ${r.description || "(name it from the template)"} — ${r.percent}% — ` +
      `${money(r.amountAwg)} — US$ ${r.amountUsd.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` +
      (r.detail ? ` — due: ${r.detail}` : ""),
  );

  return [
    "THE PARTICULARS OF THIS CONTRACT",
    "",
    ...[
      line("Practice administering the contract", facts.administratorName || practiceName),
      line("Project", facts.projectName),
      line("Project number", facts.projectNumber),
      line("Site address", facts.siteAddress),
      line("Scope of works", facts.scopeSummary),
      "",
      line("Employer / client", facts.employerName),
      line("Employer address", facts.employerAddress),
      line("Employer contact", facts.employerContact),
      line("Employer email", facts.employerEmail),
      line("Employer telephone", facts.employerPhone),
      "",
      line("Contractor", facts.contractorName),
      line("Contractor address", facts.contractorAddress),
      line("Contractor contact", facts.contractorContact),
      line("Contractor email", facts.contractorEmail),
      line("Contractor telephone", facts.contractorPhone),
      "",
      line("Contract sum (figures)", facts.contractSum > 0 ? money(facts.contractSum) : ""),
      line(
        "Contract sum (words)",
        facts.contractSum > 0 && (facts.currency || "AWG") === "AWG"
          ? amountInWords(facts.contractSum)
          : "",
      ),
      line("Exchange rate", `1 US$ = ${facts.currency || "AWG"} ${Number(facts.exchangeRate || 1.75).toFixed(2)}`),
      line("Retention", facts.retentionPercent ? `${facts.retentionPercent}%` : ""),
      "",
      line("Commencement date", facts.commencementDate),
      line("Completion date", facts.completionDate),
      line("Contract period", facts.contractPeriodDays ? `${facts.contractPeriodDays} calendar days` : ""),
      line(
        "Liquidated damages",
        facts.liquidatedDamagesPerDay ? `${money(facts.liquidatedDamagesPerDay)} per day` : "",
      ),
      line("Defects liability period", facts.defectsLiabilityMonths ? `${facts.defectsLiabilityMonths} months` : ""),
    ].filter((l): l is string => l !== null),
    "",
    rows.length
      ? [
          "PAYMENT INSTALMENTS — these figures are final. Use them exactly as given;",
          "do not recompute, round or re-total them.",
          ...rows,
          `  TOTAL — ${built.totals.percent}% — ${money(built.totals.amountAwg)}`,
        ].join("\n")
      : "PAYMENT INSTALMENTS: none supplied — keep whatever schedule the template has.",
    "",
    facts.notes.trim() ? `NOTES FROM THE PRACTICE:\n${facts.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const INSTRUCTIONS = `You are filling in a construction contract for an architectural practice.

The attached PDF is the practice's own contract. Reproduce it, keeping:
  · its language, and every clause's wording, order, numbering and obligations;
  · its headings and its structure;
  · the way it writes amounts — if it writes a figure in words as well, write yours in words too.

Replace ONLY the variable facts with the particulars below. Do not add clauses,
do not remove clauses, do not improve the drafting, and do not give advice.

Where a fact is not supplied, write __________ in the document and add a line to
"check". Never invent a name, a date or a figure.

THE FIGURES ARE FIXED. The instalment percentages and amounts are given below
and are already exact. Reproduce them as given. In "schedule" return only the
words: each instalment's short NAME as the contract calls it, in "description",
and when it falls due in "detail".

WRITE THESE SHAPES, because the typesetter reads them:
  · a numbered sub-clause as "11.1 Entire Agreement. <text>" — the title short,
    at most seven words, followed by a full stop;
  · a party's particulars, and each execution block, as ONE paragraph of
    "Label: value" pairs joined by " — ", opening with the role in capitals,
    e.g. "CONTRACTOR — Name: Acme NV — Signature: __________ — Date: __________";
  · wrap the facts you inserted in **double asterisks** so they can be set in
    bold — the names, the sums, the dates, the areas and the percentages.

List every fact you inserted in "changes", as "<what>: <old> → <new>".`;

/* ------------------------------------------------------------------ *
 * The call
 * ------------------------------------------------------------------ */

export type GenerateInput = {
  facts: ContractFacts;
  practiceName: string;
  /** The template PDF's bytes. */
  templatePdf: Uint8Array;
  templateName: string;
};

export type GenerateEvent =
  | { type: "thinking"; text: string }
  | { type: "text"; chars: number; partial: string }
  | { type: "done"; body: ContractBody; modelId: string }
  | { type: "error"; message: string };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Stream the contract out of the model.
 *
 * An async generator rather than a callback: the route handler turns each event
 * into an SSE frame, and a generator keeps back-pressure and cancellation
 * working without a second abstraction.
 */
export async function* generateContract(input: GenerateInput): AsyncGenerator<GenerateEvent> {
  const apiKey = await getAnthropicApiKey().catch(() => undefined);
  if (!apiKey) {
    yield { type: "error", message: "No AI key is configured. Settings › AI." };
    return;
  }
  if (!input.templatePdf?.byteLength) {
    yield { type: "error", message: "The template PDF could not be read from storage." };
    return;
  }

  const client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });

  let text = "";
  try {
    const stream = client.messages.stream({
      model: CONTRACT_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "enabled", budget_tokens: 4_000 },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: toBase64(input.templatePdf) },
              title: input.templateName,
            },
            { type: "text", text: INSTRUCTIONS },
            { type: "text", text: factsBlock(input.facts, input.practiceName) },
            {
              type: "text",
              text:
                "Return ONLY a JSON object matching this schema, with no prose around it:\n" +
                JSON.stringify(CONTRACT_SCHEMA),
            },
          ],
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as { type: string; text?: string; thinking?: string };
        if (delta.type === "thinking_delta" && delta.thinking) {
          yield { type: "thinking", text: delta.thinking };
        } else if (delta.type === "text_delta" && delta.text) {
          text += delta.text;
          yield { type: "text", chars: text.length, partial: text };
        }
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield {
        type: "error",
        message: "The model declined to fill this contract in. Check the template and the particulars.",
      };
      return;
    }
    if (final.stop_reason === "max_tokens") {
      yield {
        type: "error",
        message:
          "The contract was too long to finish in one pass. Split the template, or remove the annexes from it.",
      };
      return;
    }

    const body = parseBody(text);
    if (!body) {
      yield { type: "error", message: "The model's answer could not be read as a contract." };
      return;
    }
    yield { type: "done", body, modelId: CONTRACT_MODEL };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "The contract could not be generated.",
    };
  }
}

/**
 * Read the JSON out of the answer.
 *
 * Tolerant of a fenced block or a sentence in front of it — asking for "only
 * JSON" is an instruction, not a guarantee, and failing a twenty-page contract
 * over a stray "Here is the contract:" would be absurd.
 */
export function parseBody(raw: string): ContractBody | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) candidates.push(fenced[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") continue;
      return normaliseBody(parsed);
    } catch {
      // try the next shape
    }
  }
  return null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normaliseBody(raw: Record<string, unknown>): ContractBody {
  return {
    language: str(raw.language) || "English",
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    parties: arr<Record<string, unknown>>(raw.parties).map((p) => ({
      role: str(p.role),
      text: str(p.text),
    })),
    recitals: arr<unknown>(raw.recitals).map(str).filter(Boolean),
    articles: arr<Record<string, unknown>>(raw.articles).map((a) => ({
      number: str(a.number),
      heading: str(a.heading),
      paragraphs: arr<unknown>(a.paragraphs).map(str).filter(Boolean),
    })),
    // The figures are put back by `reconcileSchedule` at the call site; only
    // the words are taken from here.
    schedule: arr<Record<string, unknown>>(raw.schedule).map((s) => ({
      phase: str(s.phase),
      description: str(s.description),
      detail: str(s.detail),
      percent: 0,
      amountAwg: 0,
      amountUsd: 0,
    })),
    scheduleArticle: str(raw.schedule_article) || str(raw.scheduleArticle),
    signatures: arr<Record<string, unknown>>(raw.signatures).map((s) => ({
      role: str(s.role),
      name: str(s.name),
    })),
    changes: arr<unknown>(raw.changes).map(str).filter(Boolean),
    check: arr<unknown>(raw.check).map(str).filter(Boolean),
  };
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

/**
 * Roughly how many characters of JSON a contract of `pages` pages runs to.
 *
 * AN ESTIMATE, and labelled as one. Calibrated on the SP&CA work at ~2,600
 * characters per page; it exists only to give the progress bar a denominator,
 * and it is clamped so a long contract cannot make the bar go backwards.
 */
export const CHARS_PER_PAGE = 2_600;

export function writeProgress(chars: number, expectedPages: number): number {
  const expected = Math.max(1, expectedPages) * CHARS_PER_PAGE;
  return Math.min(0.96, 0.32 + (chars / expected) * 0.64);
}

/** The sections that have actually arrived in the partial JSON, in order. */
export function sectionsSeen(partial: string): string[] {
  const seen: string[] = [];
  const has = (key: string) => partial.includes(`"${key}"`);
  if (has("title")) seen.push("Title");
  if (has("parties")) seen.push("Parties");
  if (has("recitals")) seen.push("Recitals");
  for (const m of partial.matchAll(/"number"\s*:\s*"([^"]{1,12})"\s*,\s*"heading"\s*:\s*"([^"]{0,80})"/g)) {
    seen.push(`${m[1]} ${m[2]}`.trim());
  }
  if (has("schedule")) seen.push("Payment schedule");
  if (has("signatures")) seen.push("Signatures");
  return seen;
}
