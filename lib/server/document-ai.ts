/**
 * Writing a general document with AI. SERVER-ONLY — it holds the API key.
 *
 * One request, one answer: a letter is a page or two, so this is a server
 * action's call rather than a streamed route (the contract generator streams
 * because a twenty-page contract takes a minute and a half).
 *
 * The prompt and the reading of the answer live in
 * lib/general-documents/ai-draft.ts, which is pure and tested. This file only
 * talks to the API and turns its failures into sentences a user can act on.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";
import {
  AI_DRAFT_SCHEMA,
  buildDraftPrompt,
  parseDraft,
  type AiDraft,
  type AiDraftRequest,
} from "@/lib/general-documents/ai-draft";

/** Opus: a letter that goes out under the practice's name is worth the best writer. */
export const DOCUMENT_MODEL = "claude-opus-5";

/** A letter is a page or two; this is room, not a target. */
const MAX_TOKENS = 16_000;

/** Ninety seconds, then one retry — a letter normally takes ten to thirty. */
const AI_TIMEOUT_MS = 90_000;

export type DraftResult =
  { ok: true; draft: AiDraft; model: string } | { ok: false; error: string };

export async function draftDocument(req: AiDraftRequest): Promise<DraftResult> {
  const apiKey = await getAnthropicApiKey().catch(() => undefined);
  if (!apiKey)
    return { ok: false, error: "No AI key is configured. Settings › AI." };

  const client = new Anthropic({
    apiKey,
    timeout: AI_TIMEOUT_MS,
    maxRetries: 1,
  });
  const { system, user } = buildDraftPrompt(req);

  try {
    const message = await client.beta.messages.create({
      model: DOCUMENT_MODEL,
      max_tokens: MAX_TOKENS,
      // A declined request is re-run on the fallback model inside the same call
      // rather than simply stopping. (SDK 0.105 types the array form only.)
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: AI_DRAFT_SCHEMA },
      },
      system,
      messages: [{ role: "user", content: user }],
    });

    if (message.stop_reason === "refusal") {
      return {
        ok: false,
        error:
          "The AI declined to write this document. Reword the summary and try again.",
      };
    }
    if (message.stop_reason === "max_tokens") {
      return {
        ok: false,
        error: "The document was too long to finish. Shorten the summary.",
      };
    }

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    const draft = parseDraft(text);
    if (!draft)
      return {
        ok: false,
        error: "The AI's answer could not be read as a document. Try again.",
      };
    return { ok: true, draft, model: message.model || DOCUMENT_MODEL };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error: "The AI key was refused. Check it in Settings › AI.",
      };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "The AI is busy right now. Wait a minute and try again.",
      };
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, error: "The AI took too long to answer. Try again." };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return {
        ok: false,
        error:
          "The AI could not be reached. Check the connection and try again.",
      };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: "The AI could not write the document. Try again.",
      };
    }
    return {
      ok: false,
      error: "The document could not be written. Try again.",
    };
  }
}
