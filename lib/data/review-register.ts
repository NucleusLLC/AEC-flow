/**
 * Loading a project's review register. SERVER-ONLY.
 *
 * It computes nothing: `lib/drawings/review-register.ts` owns the references,
 * the ages and the per-person counts, and is pure and tested. This reads the
 * rows and hands them over. A second place that decides what "open" means is
 * how two screens come to disagree about the same comment.
 *
 * THREADS ARE FLATTENED ON PURPOSE. A reply is part of the conversation on
 * screen; on a register it is a separate line only if it carries its own state,
 * which it does not — the thread's status lives on the top-level comment. So
 * the register lists the item that was raised and appends the replies to its
 * text, which is what somebody reading a printed schedule needs.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import {
  buildRegister,
  type RegisterFilter,
  type RegisterSheet,
  type RegisterSource,
  type ReviewRegister,
} from "@/lib/drawings/review-register";

export type ProjectRegister = ReviewRegister & {
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  /** The instant the register was built, which every age is measured against. */
  asOf: string;
};

export async function projectReviewRegister(
  projectId: string,
  filter?: RegisterFilter,
): Promise<ProjectRegister | null> {
  await requireActor();

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, name: true, projectNumber: true },
  });
  if (!project) return null;

  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    select: { id: true, sheetNumber: true, title: true, revision: true, discipline: true },
    take: 1000,
  });
  const ids = drawings.map((d) => d.id);

  const [comments, markups] = await Promise.all([
    ids.length === 0
      ? []
      : prisma.drawingComment.findMany({
          where: { drawingId: { in: ids }, deletedAt: null },
          orderBy: [{ createdAt: "asc" }],
          take: 5000,
        }),
    ids.length === 0
      ? []
      : prisma.drawingMarkup.findMany({
          where: { drawingId: { in: ids }, deletedAt: null },
          orderBy: [{ createdAt: "asc" }],
          take: 5000,
        }),
  ]);

  // Replies hang off their parent's text rather than becoming lines of their
  // own — see the note at the top of this file.
  const repliesFor = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!c.parentId) continue;
    repliesFor.set(c.parentId, [...(repliesFor.get(c.parentId) ?? []), c]);
  }

  const items: RegisterSource[] = [];

  for (const c of comments) {
    if (c.parentId) continue;
    const replies = repliesFor.get(c.id) ?? [];
    const body = [c.body, ...replies.map((r) => `${r.authorName}: ${r.body}`)]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" — ");

    items.push({
      id: c.id,
      drawingId: c.drawingId,
      page: c.page,
      kind: "COMMENT",
      body,
      status: c.status === "RESOLVED" ? "RESOLVED" : "OPEN",
      authorName: c.authorName,
      assignedToName: c.assignedToName,
      resolvedByName: c.resolvedByName,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    });
  }

  // A redline with a note is an instruction and is listed. One without is
  // counted only: "someone drew a line" is not an action anybody can take.
  const unlabelledMarkups: Record<string, number> = {};
  for (const m of markups) {
    const text = m.text?.trim();
    if (!text) {
      unlabelledMarkups[m.drawingId] = (unlabelledMarkups[m.drawingId] ?? 0) + 1;
      continue;
    }
    items.push({
      id: m.id,
      drawingId: m.drawingId,
      page: m.page,
      kind: "MARKUP",
      body: text,
      // Markup carries no status of its own: a redline is open until it is
      // rubbed out. Presenting it as resolvable would promise a button that
      // does not exist.
      status: "OPEN",
      authorName: m.authorName,
      assignedToName: null,
      resolvedByName: null,
      createdAt: m.createdAt.toISOString(),
      resolvedAt: null,
    });
  }

  const sheets: RegisterSheet[] = drawings.map((d) => ({
    drawingId: d.id,
    sheetNumber: d.sheetNumber,
    title: d.title,
    revision: d.revision,
    discipline: d.discipline,
  }));

  const asOf = new Date().toISOString();
  return {
    ...buildRegister({ sheets, items, unlabelledMarkups, asOf, filter }),
    projectId: project.id,
    projectName: project.name,
    projectNumber: project.projectNumber,
    asOf,
  };
}

/** The people an open item can be sitting with, for the filter. */
export async function registerAssignees(projectId: string): Promise<string[]> {
  await requireActor();
  const rows = await prisma.drawingComment.findMany({
    where: { drawing: { projectId }, deletedAt: null, status: "OPEN", assignedToName: { not: null } },
    select: { assignedToName: true },
    take: 2000,
  });
  return [...new Set(rows.map((r) => r.assignedToName!).filter(Boolean))].sort();
}
