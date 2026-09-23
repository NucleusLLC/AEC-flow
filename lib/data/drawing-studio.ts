/**
 * Redline markup and review comments — data access. SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (DrawingMarkup
 * and DrawingComment are both in TENANT_MODELS), and single-row reads use
 * `findFirst` for the reason lib/data/invoices.ts sets out.
 *
 * ─── WHO MAY DO WHAT ────────────────────────────────────────────────────────
 * Anybody signed in may mark up a drawing and comment on it — that is the point
 * of a review, and a practice where only directors may redline does not review
 * anything. What is restricted is OTHER PEOPLE'S WORK: you may delete your own
 * marks, an administrator may delete anyone's, and nobody may edit somebody
 * else's comment text. Resolving a comment is open to anyone, because the
 * person who fixes a thing is usually not the person who raised it.
 *
 * ─── GEOMETRY IS VALIDATED BEFORE IT IS STORED ──────────────────────────────
 * `isValidGeometry` runs here, on the server, not only in the toolbar. A server
 * action is a public endpoint, and a JSONB column will happily accept a
 * four-megabyte array of NaNs from anything that can POST.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  DEFAULT_MARKUP_COLOUR,
  MARKUP_KINDS,
  isValidGeometry,
  simplifyStroke,
  type MarkupGeometry,
  type MarkupKind,
} from "@/lib/drawings/markup";

export class StudioNotFoundError extends Error {
  constructor(what = "That drawing") {
    super(`${what} could not be found.`);
    this.name = "StudioNotFoundError";
  }
}

export class StudioForbiddenError extends Error {
  constructor(what: string) {
    super(`You cannot ${what}.`);
    this.name = "StudioForbiddenError";
  }
}

export class StudioInvalidError extends Error {
  constructor(why: string) {
    super(why);
    this.name = "StudioInvalidError";
  }
}

/** Longest a comment may be. Past this it is a letter, not a markup note. */
const MAX_BODY = 4000;
const MAX_TEXT = 500;

export type MarkupDTO = {
  id: string;
  drawingId: string;
  page: number;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  colour: string;
  strokeWidth: number;
  text: string | null;
  mmPerPoint: number | null;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  /** True when the signed-in person may remove it. Computed here so the
   *  toolbar never has to guess at the rule the server enforces. */
  canDelete: boolean;
};

export type CommentDTO = {
  id: string;
  drawingId: string;
  page: number;
  x: number | null;
  y: number | null;
  body: string;
  status: "OPEN" | "RESOLVED";
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  canEdit: boolean;
  replies: CommentDTO[];
};

function isAdmin(actor: Actor): boolean {
  return canManagePasswords(actor.role, actor.isFounder);
}

/** The drawing must be one of ours before anything may be attached to it. */
async function requireDrawing(drawingId: string): Promise<{ id: string; projectId: string }> {
  const row = await prisma.drawing.findFirst({
    where: { id: drawingId },
    select: { id: true, projectId: true },
  });
  if (!row) throw new StudioNotFoundError();
  return row;
}

/* ------------------------------------------------------------------ *
 * Markup
 * ------------------------------------------------------------------ */

export async function listMarkups(drawingId: string): Promise<MarkupDTO[]> {
  const actor = await requireActor();
  await requireDrawing(drawingId);
  const rows = await prisma.drawingMarkup.findMany({
    where: { drawingId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }],
    take: 2000,
  });
  const admin = isAdmin(actor);
  return rows.map((r) => ({
    id: r.id,
    drawingId: r.drawingId,
    page: r.page,
    kind: r.kind as MarkupKind,
    geometry: r.geometry as unknown as MarkupGeometry,
    colour: r.colour,
    strokeWidth: r.strokeWidth,
    text: r.text,
    mmPerPoint: r.mmPerPoint,
    authorId: r.authorId,
    authorName: r.authorName,
    createdAt: r.createdAt.toISOString(),
    canDelete: admin || r.authorId === actor.id,
  }));
}

export type MarkupInput = {
  drawingId: string;
  page?: number;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  colour?: string;
  strokeWidth?: number;
  text?: string | null;
  mmPerPoint?: number | null;
};

export async function addMarkup(input: MarkupInput): Promise<MarkupDTO> {
  const actor = await requireActor();
  await requireDrawing(input.drawingId);

  if (!MARKUP_KINDS.includes(input.kind)) {
    throw new StudioInvalidError("That is not a markup tool this app knows.");
  }

  // Thin the stroke here as well as in the browser: the browser's copy is a
  // courtesy, this one is the control on what reaches the column.
  const geometry: MarkupGeometry =
    input.geometry?.kind === "PEN"
      ? { kind: "PEN", points: simplifyStroke(input.geometry.points ?? []) }
      : input.geometry;

  if (!isValidGeometry(geometry) || geometry.kind !== input.kind) {
    throw new StudioInvalidError("That mark has no shape the drawing can hold.");
  }

  const row = await prisma.drawingMarkup.create({
    data: {
      drawingId: input.drawingId,
      page: clampPage(input.page),
      kind: input.kind,
      geometry: geometry as unknown as object,
      colour: colourOrDefault(input.colour),
      strokeWidth: clampStroke(input.strokeWidth),
      text: (input.text ?? null)?.slice(0, MAX_TEXT) ?? null,
      mmPerPoint: Number.isFinite(input.mmPerPoint ?? NaN) ? (input.mmPerPoint as number) : null,
      authorId: actor.id,
      authorName: actor.name,
    },
  });

  return {
    id: row.id,
    drawingId: row.drawingId,
    page: row.page,
    kind: row.kind as MarkupKind,
    geometry: row.geometry as unknown as MarkupGeometry,
    colour: row.colour,
    strokeWidth: row.strokeWidth,
    text: row.text,
    mmPerPoint: row.mmPerPoint,
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
    canDelete: true,
  };
}

/** Soft delete. Your own always; anyone's if you administer the practice. */
export async function removeMarkup(id: string): Promise<void> {
  const actor = await requireActor();
  const row = await prisma.drawingMarkup.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!row) throw new StudioNotFoundError("That markup");
  if (row.authorId !== actor.id && !isAdmin(actor)) {
    throw new StudioForbiddenError("delete somebody else's markup");
  }
  await prisma.drawingMarkup.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Clear your own marks on a page in one go — the "undo the last five minutes" case. */
export async function clearMyMarkups(drawingId: string, page: number): Promise<number> {
  const actor = await requireActor();
  await requireDrawing(drawingId);
  const result = await prisma.drawingMarkup.updateMany({
    where: { drawingId, page: clampPage(page), authorId: actor.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count;
}

/* ------------------------------------------------------------------ *
 * Comments
 * ------------------------------------------------------------------ */

export async function listComments(drawingId: string): Promise<CommentDTO[]> {
  const actor = await requireActor();
  await requireDrawing(drawingId);
  const rows = await prisma.drawingComment.findMany({
    where: { drawingId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }],
    take: 1000,
  });

  const admin = isAdmin(actor);
  const toDto = (r: (typeof rows)[number]): CommentDTO => ({
    id: r.id,
    drawingId: r.drawingId,
    page: r.page,
    x: r.x,
    y: r.y,
    body: r.body,
    status: r.status as "OPEN" | "RESOLVED",
    parentId: r.parentId,
    authorId: r.authorId,
    authorName: r.authorName,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedToName,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    resolvedByName: r.resolvedByName,
    createdAt: r.createdAt.toISOString(),
    canEdit: admin || r.authorId === actor.id,
    replies: [],
  });

  // Threads, one level deep. A reply whose parent was deleted is promoted to a
  // top-level note rather than vanishing — somebody said it, and it still reads.
  const all = rows.map(toDto);
  const byId = new Map(all.map((c) => [c.id, c]));
  const roots: CommentDTO[] = [];
  for (const c of all) {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    if (parent) parent.replies.push(c);
    else roots.push(c);
  }
  return roots;
}

export type CommentInput = {
  drawingId: string;
  page?: number;
  /** Omit both to comment on the sheet rather than on a place on it. */
  x?: number | null;
  y?: number | null;
  body: string;
  parentId?: string | null;
  assignedToId?: string | null;
};

export async function addComment(input: CommentInput): Promise<CommentDTO> {
  const actor = await requireActor();
  await requireDrawing(input.drawingId);

  const body = String(input.body ?? "").trim();
  if (!body) throw new StudioInvalidError("A comment with nothing in it helps nobody.");

  let assignedToName: string | null = null;
  if (input.assignedToId) {
    const person = await prisma.user.findFirst({
      // User is NOT tenant-scoped by the extension — the company filter is ours
      // to carry (see lib/server/actor.ts). Without it you could assign work to
      // somebody in another practice.
      where: { id: input.assignedToId, companyId: actor.companyId },
      select: { id: true, name: true },
    });
    if (!person) throw new StudioNotFoundError("That colleague");
    assignedToName = person.name;
  }

  // A reply inherits its parent's page and place: a thread that wanders across
  // a sheet is not a thread.
  let page = clampPage(input.page);
  let x = numberOrNull(input.x);
  let y = numberOrNull(input.y);
  if (input.parentId) {
    const parent = await prisma.drawingComment.findFirst({
      where: { id: input.parentId, drawingId: input.drawingId, deletedAt: null },
      select: { id: true, page: true, x: true, y: true },
    });
    if (!parent) throw new StudioNotFoundError("That comment");
    page = parent.page;
    x = parent.x;
    y = parent.y;
  }

  const row = await prisma.drawingComment.create({
    data: {
      drawingId: input.drawingId,
      page,
      x,
      y,
      body: body.slice(0, MAX_BODY),
      parentId: input.parentId ?? null,
      authorId: actor.id,
      authorName: actor.name,
      assignedToId: input.assignedToId ?? null,
      assignedToName,
    },
  });

  return {
    id: row.id,
    drawingId: row.drawingId,
    page: row.page,
    x: row.x,
    y: row.y,
    body: row.body,
    status: row.status as "OPEN" | "RESOLVED",
    parentId: row.parentId,
    authorId: row.authorId,
    authorName: row.authorName,
    assignedToId: row.assignedToId,
    assignedToName: row.assignedToName,
    resolvedAt: null,
    resolvedByName: null,
    createdAt: row.createdAt.toISOString(),
    canEdit: true,
    replies: [],
  };
}

/**
 * Resolve or reopen. Open to anybody, deliberately: the person who fixes a
 * thing is usually not the person who raised it, and a workflow that makes the
 * reviewer come back to tick a box is a workflow that keeps stale comments.
 */
export async function setCommentStatus(id: string, resolved: boolean): Promise<void> {
  const actor = await requireActor();
  const row = await prisma.drawingComment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new StudioNotFoundError("That comment");
  await prisma.drawingComment.update({
    where: { id },
    data: resolved
      ? { status: "RESOLVED", resolvedAt: new Date(), resolvedByName: actor.name }
      : { status: "OPEN", resolvedAt: null, resolvedByName: null },
  });
}

export async function assignComment(id: string, userId: string | null): Promise<void> {
  const actor = await requireActor();
  const row = await prisma.drawingComment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new StudioNotFoundError("That comment");

  if (!userId) {
    await prisma.drawingComment.update({
      where: { id },
      data: { assignedToId: null, assignedToName: null },
    });
    return;
  }

  const person = await prisma.user.findFirst({
    where: { id: userId, companyId: actor.companyId },
    select: { id: true, name: true },
  });
  if (!person) throw new StudioNotFoundError("That colleague");
  await prisma.drawingComment.update({
    where: { id },
    data: { assignedToId: person.id, assignedToName: person.name },
  });
}

/** Soft delete a comment. Its replies go with it — they answer nothing now. */
export async function removeComment(id: string): Promise<void> {
  const actor = await requireActor();
  const row = await prisma.drawingComment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!row) throw new StudioNotFoundError("That comment");
  if (row.authorId !== actor.id && !isAdmin(actor)) {
    throw new StudioForbiddenError("delete somebody else's comment");
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.drawingComment.update({ where: { id }, data: { deletedAt: now } }),
    prisma.drawingComment.updateMany({ where: { parentId: id, deletedAt: null }, data: { deletedAt: now } }),
  ]);
}

/** Counts for the register: how much review is outstanding on each sheet. */
export async function commentCounts(drawingIds: string[]): Promise<Record<string, number>> {
  if (drawingIds.length === 0) return {};
  const rows = await prisma.drawingComment.groupBy({
    by: ["drawingId"],
    where: { drawingId: { in: drawingIds }, status: "OPEN", deletedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.drawingId, r._count._all]));
}

/* ------------------------------------------------------------------ *
 * Small guards
 * ------------------------------------------------------------------ */

function clampPage(page: number | null | undefined): number {
  const n = Math.trunc(Number(page ?? 1));
  return Number.isFinite(n) && n >= 1 && n <= 999 ? n : 1;
}

function clampStroke(width: number | null | undefined): number {
  const n = Number(width ?? 2);
  if (!Number.isFinite(n)) return 2;
  return Math.min(24, Math.max(0.5, n));
}

function colourOrDefault(colour: string | null | undefined): string {
  const c = (colour ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_MARKUP_COLOUR;
}

function numberOrNull(n: number | null | undefined): number | null {
  return Number.isFinite(n ?? NaN) ? (n as number) : null;
}
