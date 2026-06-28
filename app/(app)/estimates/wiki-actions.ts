"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/server/ai-config";

/** Structured article the AI returns — mirrors the editable fields of WikiArticle. */
export type AiWikiArticle = {
  title: string;
  category: string;
  tags: string[];
  summary: string;
  facts: { label: string; value: string }[];
  body: string;
};

export type AiWikiResult =
  | { ok: true; article: AiWikiArticle }
  | { ok: false; error: string };

// Forced-tool-use schema → guarantees a typed, validated JSON object back.
const WIKI_TOOL: Anthropic.Tool = {
  name: "create_wiki_article",
  description:
    "Return a structured estimating-wiki article for a construction / cost-estimating topic.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", description: "Concise article title." },
      category: {
        type: "string",
        description:
          "One short category, e.g. Concrete, Masonry, Finishes, Reinforcement, Waterproofing, Labour, Commercial.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "3-6 short lowercase keyword tags.",
      },
      summary: {
        type: "string",
        description: "One or two sentences stating the rule of thumb / norm.",
      },
      facts: {
        type: "array",
        description:
          "Quantitative reference facts an estimator uses — coverage rates, ratios, densities, wastage %, productivity norms.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
          required: ["label", "value"],
        },
      },
      body: {
        type: "string",
        description:
          "A short paragraph (2-4 sentences) on how to apply the figures in an estimate, with caveats.",
      },
    },
    required: ["title", "category", "tags", "summary", "facts", "body"],
  },
};

const SYSTEM = [
  "You are a senior quantity surveyor maintaining an estimating knowledge base for an AEC practice",
  "(UAE / Caribbean context, metric units — m², m³, kg, hrs).",
  "For the given topic, produce a concise, practical reference article an estimator would actually use:",
  "coverage rates, mix ratios, densities, wastage allowances, or labour-productivity norms.",
  "Be specific and quantitative, state assumptions, and prefer a typical RANGE over a single invented number",
  "when the figure varies. Always call the create_wiki_article tool.",
].join(" ");

/**
 * Generate a structured estimating-wiki article from a short topic, using Claude
 * with a forced tool call so the result is always a validated typed object.
 * Never throws to the client — returns a tagged result.
 */
export async function aiFetchWikiArticle(topic: string): Promise<AiWikiResult> {
  const t = topic.trim();
  if (!t) return { ok: false, error: "Enter a topic to fetch." };
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "AI is not configured — add an Anthropic API key in Settings → Integrations.",
    };
  }
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      system: SYSTEM,
      tools: [WIKI_TOOL],
      tool_choice: { type: "tool", name: "create_wiki_article" },
      messages: [
        { role: "user", content: `Create an estimating-wiki article about: ${t}` },
      ],
    });
    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return { ok: false, error: "The model did not return a structured article." };
    }
    const a = block.input as Partial<AiWikiArticle>;
    return {
      ok: true,
      article: {
        title: a.title?.trim() || t,
        category: a.category?.trim() || "Custom",
        tags: Array.isArray(a.tags) ? a.tags : [],
        summary: a.summary ?? "",
        facts: Array.isArray(a.facts) ? a.facts : [],
        body: a.body ?? "",
      },
    };
  } catch (e) {
    const error =
      e instanceof Anthropic.APIError
        ? `AI request failed (${e.status ?? "?"}): ${e.message}`
        : e instanceof Error
          ? e.message
          : "AI request failed.";
    return { ok: false, error };
  }
}
