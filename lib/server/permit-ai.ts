/**
 * The AI synopsis on a permit Process Summary. SERVER-ONLY — it holds the key.
 *
 * One request, no tools: the file goes in as text (dossier), a SITREP comes
 * back as JSON that structured output holds to SYNOPSIS_SCHEMA. The prompt and
 * the parser are pure and tested in lib/building-permits/synopsis.ts.
 *
 * Nothing is stored. The synopsis is written on request for the page being
 * printed, so it can never be an old reading of a file that has moved on.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";
import { dossier } from "@/lib/building-permits/process-summary";
import {
  SYNOPSIS_SCHEMA,
  buildSynopsisPrompt,
  parseSynopsis,
  type PermitSynopsis,
} from "@/lib/building-permits/synopsis";
import type { BuildingPermitDTO } from "@/lib/building-permits/types";
import type { Lang } from "@/lib/i18n/types";

export const SYNOPSIS_MODEL = "claude-opus-5";
/** Used only if the main model declines on policy grounds (server-side fallback). */
export const SYNOPSIS_FALLBACK_MODEL = "claude-opus-4-8";

/** A SITREP is short; a minute is generous. */
const AI_TIMEOUT_MS = 90_000;

export class PermitAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermitAiError";
  }
}

export async function writePermitSynopsis(
  permit: BuildingPermitDTO,
  lang: Lang,
  today: string,
): Promise<PermitSynopsis> {
  const apiKey = await getAnthropicApiKey().catch(() => undefined);
  if (!apiKey) throw new PermitAiError("No AI key is configured. Settings › AI.");

  const client = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const { system, user } = buildSynopsisPrompt(dossier(permit, today), lang);

  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await client.beta.messages.create({
      model: SYNOPSIS_MODEL,
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: SYNOPSIS_FALLBACK_MODEL }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SYNOPSIS_SCHEMA },
      },
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new PermitAiError("The AI key was refused. Check it in Settings › AI.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new PermitAiError("The AI service is busy. Try again in a minute.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new PermitAiError("The AI service could not be reached. Try again.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new PermitAiError(`The AI service returned an error (${err.status ?? "unknown"}).`);
    }
    throw err;
  }

  if (message.stop_reason === "refusal") {
    throw new PermitAiError("The AI declined to summarise this file.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new PermitAiError("The summary ran too long to finish. Try again.");
  }

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const synopsis = parseSynopsis(text);
  if (!synopsis) throw new PermitAiError("The AI's answer could not be read as a summary.");
  return synopsis;
}
