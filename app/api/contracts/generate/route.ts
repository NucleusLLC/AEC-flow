/**
 * Generating a contract, streamed.
 *
 * ─── WHY A ROUTE AND NOT A SERVER ACTION ────────────────────────────────────
 * Filling a twenty-page contract takes thirty to ninety seconds, and a screen
 * that shows nothing for ninety seconds is a screen people reload. A server
 * action can only return once; this streams, so the browser can show what has
 * actually happened: the template read, the model thinking, each article as it
 * arrives, then the finished contract.
 *
 * ─── THE PROGRESS IS MEASURED, NEVER MIMED ──────────────────────────────────
 * The model reports no progress, so nothing here invents one. The stages are
 * things that can be counted — the template's bytes, the characters received
 * against an estimated length, the sections actually present in the partial
 * JSON — and the estimate is labelled as an estimate where it lives
 * (`CHARS_PER_PAGE` in lib/server/contract-ai.ts). The bar never goes
 * backwards, and it only reaches 100% when the row exists.
 *
 * ─── THE KEY NEVER LEAVES THE SERVER ────────────────────────────────────────
 * Which is the whole reason this is not a browser-direct call to Anthropic.
 */
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/server/actor";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { parseContractFacts, issuesToMessage } from "@/lib/contracts/schema";
import { readTemplateBytes, saveGenerated } from "@/lib/data/contracts";
import {
  generateContract,
  sectionsSeen,
  writeProgress,
  type GenerateEvent,
} from "@/lib/server/contract-ai";
import type { ContractBody, ContractFacts } from "@/lib/contracts/types";

export const runtime = "nodejs";
/** The model takes as long as it takes; Vercel's ceiling is the real limit. */
export const maxDuration = 300;

type Frame =
  | { stage: string; progress: number; note?: string; sections?: string[] }
  | { done: true; id: string; number: string }
  | { error: string };

export async function POST(request: Request) {
  try {
    await requireActor();
  } catch {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let payload: { facts?: unknown; templateId?: unknown; supersedesId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  const parsed = parseContractFacts(payload.facts);
  if (!parsed.ok) {
    return NextResponse.json({ error: issuesToMessage(parsed.issues) }, { status: 400 });
  }
  const facts = parsed.value as ContractFacts;
  const templateId = typeof payload.templateId === "string" ? payload.templateId : "";
  if (!templateId) {
    return NextResponse.json({ error: "Choose the contract to fill in." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /** Monotonic: a bar that goes backwards reads as a fault. */
      let floor = 0;
      const send = (frame: Frame) => {
        if ("progress" in frame) {
          floor = Math.max(floor, frame.progress);
          frame.progress = floor;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      };

      try {
        send({ stage: "Reading the template", progress: 0.04 });
        const template = await readTemplateBytes(templateId);
        send({
          stage: "Reading the template",
          progress: 0.12,
          note: `${template.name} · ${Math.round(template.bytes.byteLength / 1024)} KB`,
        });

        const practice = await getPracticeSettings();
        send({ stage: "Sending the particulars", progress: 0.16 });

        // An estimate, and only a denominator for the bar: a contract of this
        // many pages is what the SP&CA work measured at ~2,600 chars a page.
        const expectedPages = Math.max(8, Math.min(40, 8 + facts.phases.length));

        let lastSections: string[] = [];
        let body: ContractBody | null = null;
        let modelId = "";

        for await (const event of generateContract({
          facts,
          practiceName: practice.footer?.text?.trim() || "the practice",
          templatePdf: template.bytes,
          templateName: template.name,
        })) {
          const e: GenerateEvent = event;
          if (e.type === "thinking") {
            // Thinking has no length to measure against, so it creeps: it is
            // evidence of life, not of progress.
            send({ stage: "Reading the contract", progress: Math.min(0.31, floor + 0.004) });
          } else if (e.type === "text") {
            const sections = sectionsSeen(e.partial);
            const grew = sections.length !== lastSections.length;
            if (grew) lastSections = sections;
            send({
              stage: "Writing the contract",
              progress: e.partial.includes('"signatures"')
                ? 0.95
                : writeProgress(e.chars, expectedPages),
              sections: grew ? sections : undefined,
            });
          } else if (e.type === "error") {
            send({ error: e.message });
            controller.close();
            return;
          } else if (e.type === "done") {
            body = e.body;
            modelId = e.modelId;
          }
        }

        if (!body) {
          send({ error: "The model returned nothing that could be read as a contract." });
          controller.close();
          return;
        }

        send({ stage: "Typesetting", progress: 0.97 });
        const saved = await saveGenerated({
          facts,
          body,
          templateId,
          templateName: template.name,
          modelId,
          supersedesId: typeof payload.supersedesId === "string" ? payload.supersedesId : null,
        });

        send({ stage: "Ready", progress: 1 });
        send({ done: true, id: saved.id, number: saved.number });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "The contract could not be generated." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
