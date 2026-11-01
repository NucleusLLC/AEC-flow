/**
 * Reading a sheet's title block with Claude. SERVER-ONLY — it holds the key
 * and sends page images out.
 *
 * ─── WHAT IT IS SHOWN ────────────────────────────────────────────────────────
 * Up to three one-page PDFs of the same sheet — the whole page, the right-hand
 * strip, the bottom strip (`lib/server/pdf-pages.ts`) — plus the text-layer
 * title-block text when there is one, plus what the rules already proposed.
 * The strips are the point: they are the title block at several times the
 * magnification the whole-page image would give it.
 *
 * ─── WHAT COMES BACK ─────────────────────────────────────────────────────────
 * A JSON object in `AI_READ_SCHEMA` (structured output, so the shape is
 * guaranteed when the call succeeds). `lib/drawings/ai-read.ts` turns it into
 * a draft with confidences and evidence; this file never interprets it.
 *
 * ─── IT FAILS OPEN, ALWAYS ───────────────────────────────────────────────────
 * No key, no network, a timeout, a refusal, a request too large, an answer
 * that is not JSON: every one returns `{ ok: false, reason }` and the rules'
 * draft stands. An upload must never fail because a reader was unavailable —
 * the user types the six values in and the register would rather have the
 * drawing. The reason is surfaced on the row so "AI did not run" is never
 * mistaken for "AI read nothing".
 *
 * ─── WHAT LEAVES THE BUILDING ────────────────────────────────────────────────
 * The sheet itself, as images. That is more than the sheet-type tie-break
 * sends (text only) and the same as the contract generator sends (a whole PDF
 * template). The switch is the key: no key, no call. A practice that must not
 * send drawings out leaves Settings › AI empty and gets the rules-only intake.
 *
 * ─── WHY OPUS ────────────────────────────────────────────────────────────────
 * Reading small lettering off a cropped strip, telling a revision table's last
 * row from its first, and knowing that "Ing." before a name on a Dutch sheet
 * marks the engineer — this is reading comprehension of a crowded form, in
 * three languages, and the cheaper models get the revision row wrong more
 * often than a register can afford. Cost lands per sheet (a few cents); a
 * wrong revision costs a site visit.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";
import {
  AI_READ_SCHEMA,
  aiReadToDraft,
  aiSheetType,
  buildAiReadPrompt,
  parseAiRead,
  type AiReadInput,
  type AiTitleBlockRead,
} from "@/lib/drawings/ai-read";
import type { DrawingMetadataDraft, Field } from "@/lib/drawings/types";
import type { SheetType } from "@/lib/drawings/sheet-type";
import type { TitleBlockViews } from "@/lib/server/pdf-pages";

export const TITLE_BLOCK_MODEL = "claude-opus-5-5";

/** The answer is a dozen short fields; this is room, not a target. */
const MAX_TOKENS = 4_000;

/** A page read normally takes 10–25 s. One retry on a connection error. */
export const AI_TIMEOUT_MS = 60_000;

/**
 * The API takes 32 MB per request; base64 inflates by a third, and three copies
 * of a heavy vector sheet add up. Past this the strips are dropped and only
 * the page goes; past `MAX_PAGE_BYTES` nothing goes.
 */
export const MAX_REQUEST_BYTES = 18 * 1024 * 1024;
export const MAX_PAGE_BYTES = 16 * 1024 * 1024;

export type TitleBlockAiResult =
  | {
      ok: true;
      read: AiTitleBlockRead;
      draft: DrawingMetadataDraft;
      sheetType: Field<SheetType> | null;
      model: string;
    }
  | { ok: false; reason: string };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

type DocumentBlock = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
  title: string;
};

function documentBlocks(views: TitleBlockViews): DocumentBlock[] | null {
  if (views.fullPage.byteLength > MAX_PAGE_BYTES) return null;
  const blocks: DocumentBlock[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(views.fullPage) }, title: "Full page" },
  ];
  let total = views.fullPage.byteLength;
  const add = (bytes: Uint8Array | null, title: string) => {
    if (!bytes || total + bytes.byteLength > MAX_REQUEST_BYTES) return;
    total += bytes.byteLength;
    blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) }, title });
  };
  add(views.rightStrip, "Right-hand strip (magnified)");
  add(views.bottomStrip, "Bottom strip (magnified)");
  return blocks;
}

/** Read a sheet. Never throws. */
export async function readTitleBlockWithAi(
  views: TitleBlockViews,
  input: AiReadInput,
): Promise<TitleBlockAiResult> {
  const apiKey = await getAnthropicApiKey().catch(() => undefined);
  if (!apiKey) return { ok: false, reason: "No AI key is configured (Settings › AI), so the sheet was not read by AI." };

  const documents = documentBlocks(views);
  if (!documents) return { ok: false, reason: "The page is too large to send to the AI reader." };

  try {
    const client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
    const message = await client.beta.messages.create({
      model: TITLE_BLOCK_MODEL,
      max_tokens: MAX_TOKENS,
      // A declined request is re-run on the fallback model inside the same call.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: AI_READ_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [...documents, { type: "text", text: buildAiReadPrompt(input) }],
        },
      ],
    });

    if (message.stop_reason === "refusal") return { ok: false, reason: "The AI declined to read this sheet." };
    if (message.stop_reason === "max_tokens") return { ok: false, reason: "The AI's answer was cut short." };

    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const read = parseAiRead(text);
    if (!read) return { ok: false, reason: "The AI's answer could not be read." };

    const model = message.model || TITLE_BLOCK_MODEL;
    return { ok: true, read, draft: aiReadToDraft(read, model), sheetType: aiSheetType(read, model), model };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "The AI key was refused. Check it in Settings › AI." };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "The AI is busy; the sheet was not read by AI." };
    if (err instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: "The AI took too long; the sheet was not read by AI." };
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, reason: "The AI could not be reached; the sheet was not read by AI." };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `The AI request failed (${err.status ?? "error"}); the sheet was not read by AI.` };
    return { ok: false, reason: "The AI reader failed; the sheet was not read by AI." };
  }
}
