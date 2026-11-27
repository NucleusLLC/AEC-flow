"use server";

/**
 * "Import from MEPflow" — write the draft estimate (or purchase order) a
 * cadgen.boq/1 file describes. The browser sends the file WITHOUT its images
 * plus the two images it shrank (rendering ≤ 1600 px JPEG, floor plan); this
 * action re-validates everything and prices from the book it reads itself.
 */
import { revalidatePath } from "next/cache";
import { requireActor, ActorError } from "@/lib/server/actor";
import {
  BOQ_LIMITS,
  buildPreview,
  cleanDataUrl,
  importTitle,
  parseBoqCore,
  planBoqEstimate,
  planBoqPurchaseOrder,
} from "@/lib/imports/cadgen-boq";
import type { ImportProject } from "@/lib/api/v1/estimate-import";
import { createImportedEstimate, createImportedPurchaseOrder } from "@/lib/data/api-v1";
import { createBoqProject, findBoqProject, getImportPriceBook, setProjectCover } from "@/lib/data/boq-import";
import { cleanProjectNumber } from "@/lib/data/projects";

export type BoqImportInput = {
  core: unknown;
  target: "estimate" | "purchase-order";
  currency: string;
  project:
    | { mode: "existing"; id: string }
    | { mode: "new"; name: string; number: string; clientId: string; siteAddress: string }
    | { mode: "none" };
  rendering: string | null;
  plan: string | null;
  projectCover: boolean;
};

export type BoqImportResult =
  | { ok: true; href: string; label: string; notes: string[] }
  | { ok: false; message: string };

export async function importBoqAction(input: BoqImportInput): Promise<BoqImportResult> {
  let actor;
  try {
    actor = await requireActor();
  } catch (e) {
    return { ok: false, message: e instanceof ActorError ? e.message : "You must be signed in." };
  }

  const parsed = parseBoqCore(input?.core);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const core = parsed.core;

  const currency = String(input.currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, message: "Choose a currency." };
  const target = input.target === "purchase-order" ? "purchase-order" : "estimate";

  const rendering = cleanDataUrl(input.rendering, ["image/jpeg", "image/png"], BOQ_LIMITS.maxRenderingBytes);
  const plan = cleanDataUrl(input.plan, ["image/svg+xml", "image/png", "image/jpeg"], BOQ_LIMITS.maxPlanBytes);

  // The project: an existing one of this practice, a new one from the file, or (PO only) none.
  let project: ImportProject | null = null;
  try {
    const p = input.project;
    if (p?.mode === "existing") {
      project = await findBoqProject(String(p.id ?? ""));
      if (!project) return { ok: false, message: "That project is not in this practice." };
    } else if (p?.mode === "new") {
      const name = String(p.name ?? "").trim().slice(0, 200);
      if (!name) return { ok: false, message: "Give the new project a name." };
      if (!p.clientId) return { ok: false, message: "Choose the client for the new project." };
      project = await createBoqProject({
        name,
        projectNumber: cleanProjectNumber(p.number),
        clientId: String(p.clientId),
        siteAddress: String(p.siteAddress ?? "").trim().slice(0, 300) || null,
        manager: actor.name,
        currency,
      });
    } else if (target === "estimate") {
      return { ok: false, message: "An estimate must belong to a project." };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The project could not be created." };
  }

  const book = await getImportPriceBook();
  const preview = buildPreview(core, book, currency);
  const notes: string[] = [];

  if (project && input.projectCover && rendering) {
    const r = await setProjectCover(project.id, rendering).catch(() => ({ ok: false as const, reason: "storage" as const }));
    if (!r.ok) notes.push(r.reason === "storage" ? "cover-storage" : "cover-failed");
    else notes.push("cover-set");
  }

  try {
    if (target === "purchase-order") {
      const po = await createImportedPurchaseOrder(planBoqPurchaseOrder(core, preview, project, currency, actor.name));
      revalidatePath("/procurement");
      return { ok: true, href: `/procurement/${po.id}`, label: po.poNumber, notes };
    }
    // Estimate: project is set (checked above).
    const id = await createImportedEstimate(planBoqEstimate(core, preview, project!, currency, { image: rendering, plan }));
    revalidatePath("/estimates");
    if (project) revalidatePath(`/projects/${project.id}`, "layout");
    return { ok: true, href: `/estimates?project=${encodeURIComponent(id)}`, label: importTitle(core), notes };
  } catch (e) {
    console.error("[boq-import] write failed", e);
    return { ok: false, message: "The import could not be saved. Nothing was written to the estimate or order." };
  }
}
