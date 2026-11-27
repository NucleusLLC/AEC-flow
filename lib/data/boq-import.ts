/**
 * Data access for "Import from MEPflow" (app/(app)/estimates/import). SERVER-ONLY.
 *
 * Every query runs inside a signed-in request, so the tenant extension in
 * lib/db.ts scopes it to the caller's practice; nothing here passes a
 * companyId of its own. The estimate and purchase-order writes reuse the
 * /api/v1 import writers (lib/data/api-v1.ts) — one write path per document.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ImportProject } from "@/lib/api/v1/estimate-import";
import type { BoqPrice } from "@/lib/imports/cadgen-boq";
import { getPriceBook } from "@/lib/data/price-lists";
import { currencyOf } from "@/lib/data/price-lists.types";
import { createProject } from "@/lib/data/projects";
import { deleteObject, isStorageConfigured, uploadObject } from "@/lib/server/storage";

import type { ImportTargetClient, ImportTargetProject } from "@/lib/data/boq-import.types";
export type { ImportTargetClient, ImportTargetProject };

/** Projects (not archived, newest first) and clients for the pickers. */
export async function listImportTargets(): Promise<{ projects: ImportTargetProject[]; clients: ImportTargetClient[] }> {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, projectNumber: true, name: true, client: { select: { name: true } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    projects: projects.map((p) => ({ id: p.id, number: p.projectNumber, name: p.name, client: p.client?.name ?? null })),
    clients,
  };
}

/** The practice price book, flattened for code matching (materials first). */
export async function getImportPriceBook(): Promise<BoqPrice[]> {
  const book = await getPriceBook();
  return [
    ...book.materials.map((p) => ({ code: p.code, name: p.name, unit: p.unit, unitPrice: p.unitPrice, currency: currencyOf(p), kind: "material" as const })),
    ...book.equipment.map((p) => ({ code: p.code, name: p.name, unit: p.unit, unitPrice: p.unitPrice, currency: currencyOf(p), kind: "equipment" as const })),
  ];
}

/** One project of this practice as the import plans need it, or null. */
export async function findBoqProject(id: string): Promise<ImportProject | null> {
  const p = await prisma.project.findFirst({
    where: { id },
    select: { id: true, projectNumber: true, name: true, siteAddress: true, clientId: true, client: { select: { name: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    siteAddress: p.siteAddress ?? null,
    clientId: p.clientId ?? null,
    clientName: p.client?.name ?? null,
  };
}

/** Create the project the file describes, through the app's own createProject. */
export async function createBoqProject(input: {
  name: string;
  projectNumber: string | null;
  clientId: string;
  siteAddress: string | null;
  manager: string;
  currency: string;
}): Promise<ImportProject> {
  const client = await prisma.client.findFirst({ where: { id: input.clientId }, select: { name: true } });
  if (!client) throw new Error("That client is not in this practice.");
  const created = await createProject({
    name: input.name,
    projectNumber: input.projectNumber,
    clientName: client.name,
    manager: input.manager,
    siteAddress: input.siteAddress,
    currency: input.currency,
  });
  const p = await findBoqProject(created.id);
  if (!p) throw new Error("The new project could not be read back.");
  return p;
}

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/** JPEG / PNG magic bytes — the declared type alone is not trusted. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

export type CoverResult = { ok: true } | { ok: false; reason: "storage" | "image" | "project" };

/**
 * Store a rendering as the project's cover image and point the project at it.
 * The previous cover object is removed after the switch (best effort).
 */
export async function setProjectCover(projectId: string, dataUrl: string): Promise<CoverResult> {
  if (!isStorageConfigured()) return { ok: false, reason: "storage" };
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) return { ok: false, reason: "image" };
  const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
  const type = sniff(bytes);
  if (!type || type !== m[1]) return { ok: false, reason: "image" };

  const project = await prisma.project.findFirst({ where: { id: projectId }, select: { id: true, coverImageKey: true } });
  if (!project) return { ok: false, reason: "project" };

  const key = `projects/${project.id}/cover/${randomUUID()}.${COVER_TYPES[type]}`;
  await uploadObject(key, bytes, type);
  await prisma.project.update({ where: { id: project.id }, data: { coverImageKey: key } });
  if (project.coverImageKey && project.coverImageKey !== key) {
    await deleteObject(project.coverImageKey).catch(() => undefined);
  }
  return { ok: true };
}

/** The cover key of one project of this practice (null = none or not theirs). */
export async function getProjectCoverKey(projectId: string): Promise<string | null> {
  const p = await prisma.project.findFirst({ where: { id: projectId }, select: { coverImageKey: true } });
  return p?.coverImageKey ?? null;
}
