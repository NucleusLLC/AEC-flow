/**
 * The tie-break: ask Claude what kind of drawing a sheet is, when the lexicon
 * in `lib/drawings/sheet-type.ts` could not tell.
 *
 * SERVER-ONLY. It holds an API key and makes a network call.
 *
 * ─── WHEN THIS RUNS ─────────────────────────────────────────────────────────
 * Only when the deterministic classifier came back missing or below its
 * confidence bar, and only for a PDF that actually had a text layer. On a
 * normal sheet set that is a small minority of sheets: the title block usually
 * says "GROUND FLOOR PLAN" and no model is needed to read it. Calling a model
 * for every sheet would cost money per upload, add a second of latency per
 * file, and — the real objection — make the accuracy figures unreproducible.
 *
 * ─── IT FAILS OPEN, ALWAYS ──────────────────────────────────────────────────
 * No key, no network, a timeout, a malformed answer, a value outside the
 * vocabulary: every one of those returns null and the rules' answer stands. An
 * upload must never fail because a classifier was unavailable.
 *
 * ─── WHAT LEAVES THE BUILDING ───────────────────────────────────────────────
 * The title-block text only — which carries the project name and often the
 * client's. That is the same class of data the estimating wiki already sends
 * (`app/(app)/estimates/wiki-actions.ts`), so it is not a new exposure, but it
 * is a real one: the text is trimmed to `MAX_TEXT_CHARS`, never the whole
 * sheet, and the call is skipped entirely when no key is configured — which is
 * also the switch for turning this off.
 *
 * ─── WHY HAIKU ──────────────────────────────────────────────────────────────
 * This is a closed-vocabulary classification of a short string. Haiku 4.5
 * answers it as well as a larger model at a fraction of the cost and latency,
 * and the cost lands per uploaded sheet. The rest of the app uses a bigger
 * model for open-ended writing; this is not that.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";
import {
  SHEET_TYPES,
  SHEET_TYPE_LABEL,
  type SheetType,
} from "@/lib/drawings/sheet-type";
import { field, type Field } from "@/lib/drawings/types";

/** A short classification needs a small model. */
export const SHEET_TYPE_MODEL = "claude-haiku-4-5-20251001";

/** Enough of a title block to classify; more is noise and cost. */
export const MAX_TEXT_CHARS = 1200;

/** A classifier that hangs must not hold up an upload. */
export const AI_TIMEOUT_MS = 8000;

/**
 * The model's answer is never trusted above a labelled title-block reading, so
 * it is capped below the "high" band: it is a well-informed opinion about a
 * sheet the rules could not read, and the UI should still ask.
 */
export const AI_CONFIDENCE = 0.72;

export type SheetTypeAiInput = {
  title?: string | null;
  titleBlockText?: string | null;
  sheetNumber?: string | null;
};

const VOCABULARY = SHEET_TYPES.filter((t) => t !== "OTHER");

function prompt(input: SheetTypeAiInput): string {
  const text = (input.titleBlockText ?? "").slice(0, MAX_TEXT_CHARS);
  return [
    "You are reading the title block of an architectural or engineering drawing.",
    "Decide what KIND of drawing the sheet is.",
    "",
    "The text may be in English, Dutch or Spanish. It may be fragmentary — it was",
    "machine-extracted from a PDF and the column order is not reliable.",
    "",
    `Sheet number: ${input.sheetNumber || "(not read)"}`,
    `Sheet title: ${input.title || "(not read)"}`,
    "Title-block text:",
    text || "(none)",
    "",
    "Answer with ONE of these codes and nothing else:",
    VOCABULARY.join(", "),
    "",
    "If the text does not support any of them, answer UNKNOWN.",
  ].join("\n");
}

function parse(answer: string): SheetType | null {
  const token = answer.trim().toUpperCase().replace(/[^A-Z_]/g, "");
  if (!token || token === "UNKNOWN") return null;
  return (VOCABULARY as string[]).includes(token) ? (token as SheetType) : null;
}

/**
 * Classify with a model, or return null. Never throws.
 *
 * The caller decides whether to ask — see `shouldAskModel` — so that the
 * decision is testable without a network.
 */
export async function classifySheetTypeWithAi(
  input: SheetTypeAiInput,
): Promise<Field<SheetType> | null> {
  const apiKey = await getAnthropicApiKey().catch(() => undefined);
  if (!apiKey) return null;

  const text = (input.titleBlockText ?? "").trim();
  if (!text && !input.title) return null;

  try {
    const client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
    const response = await client.messages.create({
      model: SHEET_TYPE_MODEL,
      max_tokens: 16,
      temperature: 0,
      messages: [{ role: "user", content: prompt(input) }],
    });

    const block = response.content.find((c) => c.type === "text");
    const value = block && block.type === "text" ? parse(block.text) : null;
    if (!value) return null;

    return field(value, AI_CONFIDENCE, [
      {
        source: "titleblock-scan",
        pattern: "sheet-type.ai",
        fragment: SHEET_TYPE_LABEL[value],
        note: `Read by ${SHEET_TYPE_MODEL} because the wording matched no known phrase. Confirm it.`,
      },
    ]);
  } catch {
    // Deliberately silent: an upload does not fail because a classifier did.
    return null;
  }
}

/**
 * Is it worth asking? Pure, so the policy is tested without a network.
 *
 * Three conditions: the rules are not already sure, there is text worth
 * sending, and the file had a text layer at all (a scan has nothing to read
 * and asking about an empty string wastes a call).
 */
export function shouldAskModel(args: {
  ruleConfidence: number | null;
  hasTextLayer: boolean;
  titleBlockText: string | null | undefined;
  threshold?: number;
}): boolean {
  if (!args.hasTextLayer) return false;
  const text = (args.titleBlockText ?? "").trim();
  if (text.length < 12) return false;
  const threshold = args.threshold ?? 0.8;
  return args.ruleConfidence === null || args.ruleConfidence < threshold;
}
