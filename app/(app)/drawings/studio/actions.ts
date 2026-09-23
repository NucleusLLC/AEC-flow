"use server";

/**
 * Drawing Studio server actions: redline marks and review comments.
 *
 * Each returns a discriminated result rather than throwing, the contract the
 * rest of the app keeps. The role and ownership rules live in the data layer,
 * where every caller passes — an action is a public endpoint and so is anything
 * else that can reach Prisma.
 *
 * NO `revalidatePath` ON A MARK. The studio is a canvas: it applies the change
 * optimistically and reconciles from the action's return value. Revalidating
 * the route on every pen stroke would re-render the page under the user's hand,
 * which is exactly the "the drawing jumped while I was drawing" bug.
 */

import { revalidatePath } from "next/cache";
import {
  addComment,
  addMarkup,
  assignComment,
  clearMyMarkups,
  listComments,
  listMarkups,
  removeComment,
  removeMarkup,
  setCommentStatus,
  StudioForbiddenError,
  StudioInvalidError,
  StudioNotFoundError,
  type CommentDTO,
  type CommentInput,
  type MarkupDTO,
  type MarkupInput,
} from "@/lib/data/drawing-studio";

export type MarkupResult = { ok: true; markup: MarkupDTO } | { ok: false; error: string };
export type MarkupListResult = { ok: true; markups: MarkupDTO[] } | { ok: false; error: string };
export type CommentResult = { ok: true; comment: CommentDTO } | { ok: false; error: string };
export type CommentListResult = { ok: true; comments: CommentDTO[] } | { ok: false; error: string };
export type StudioResult = { ok: true; count?: number } | { ok: false; error: string };

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof StudioForbiddenError ||
    e instanceof StudioInvalidError ||
    e instanceof StudioNotFoundError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function listMarkupsAction(drawingId: string): Promise<MarkupListResult> {
  try {
    return { ok: true, markups: await listMarkups(drawingId) };
  } catch (e) {
    return failure(e, "The markup could not be loaded.");
  }
}

export async function addMarkupAction(input: MarkupInput): Promise<MarkupResult> {
  try {
    return { ok: true, markup: await addMarkup(input) };
  } catch (e) {
    return failure(e, "That mark could not be saved.");
  }
}

export async function removeMarkupAction(id: string): Promise<StudioResult> {
  try {
    await removeMarkup(id);
    return { ok: true };
  } catch (e) {
    return failure(e, "That mark could not be removed.");
  }
}

export async function clearMyMarkupsAction(drawingId: string, page: number): Promise<StudioResult> {
  try {
    return { ok: true, count: await clearMyMarkups(drawingId, page) };
  } catch (e) {
    return failure(e, "Your marks could not be cleared.");
  }
}

export async function listCommentsAction(drawingId: string): Promise<CommentListResult> {
  try {
    return { ok: true, comments: await listComments(drawingId) };
  } catch (e) {
    return failure(e, "The comments could not be loaded.");
  }
}

export async function addCommentAction(input: CommentInput): Promise<CommentResult> {
  try {
    const comment = await addComment(input);
    // A comment DOES change the register (its open count), unlike a pen stroke.
    revalidatePath("/drawings");
    return { ok: true, comment };
  } catch (e) {
    return failure(e, "That comment could not be saved.");
  }
}

export async function setCommentStatusAction(id: string, resolved: boolean): Promise<StudioResult> {
  try {
    await setCommentStatus(id, resolved);
    revalidatePath("/drawings");
    return { ok: true };
  } catch (e) {
    return failure(e, "That comment could not be updated.");
  }
}

export async function assignCommentAction(id: string, userId: string | null): Promise<StudioResult> {
  try {
    await assignComment(id, userId);
    return { ok: true };
  } catch (e) {
    return failure(e, "That comment could not be assigned.");
  }
}

export async function removeCommentAction(id: string): Promise<StudioResult> {
  try {
    await removeComment(id);
    revalidatePath("/drawings");
    return { ok: true };
  } catch (e) {
    return failure(e, "That comment could not be removed.");
  }
}
