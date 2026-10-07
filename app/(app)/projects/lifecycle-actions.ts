"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { archiveProject, deleteProject, restoreProject } from "@/lib/data/project-lifecycle";
import { logActivity } from "@/lib/data/activity";
import type { ProjectLink } from "@/lib/projects/lifecycle";

export type LifecycleResult = { ok: true; archivedAt?: string | null } | { ok: false; error: string; links?: ProjectLink[] };

const NOT_ALLOWED = "Only an administrator or director can archive or delete a project.";

/** Archive, restore and delete are one privilege: Admin, Director or the founder. */
async function requireProjectAdmin() {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) throw new Error(NOT_ALLOWED);
  return actor;
}

function failure(e: unknown, fallback: string): LifecycleResult {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function archiveProjectAction(id: string): Promise<LifecycleResult> {
  try {
    const actor = await requireProjectAdmin();
    const { archivedAt } = await archiveProject(id, actor.id);
    await logActivity({ userId: actor.id, action: "archived", entityType: "project", entityId: id, projectId: id });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`, "layout");
    return { ok: true, archivedAt };
  } catch (e) {
    return failure(e, "The project could not be archived.");
  }
}

export async function restoreProjectAction(id: string): Promise<LifecycleResult> {
  try {
    const actor = await requireProjectAdmin();
    await restoreProject(id);
    await logActivity({ userId: actor.id, action: "restored", entityType: "project", entityId: id, projectId: id });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`, "layout");
    return { ok: true, archivedAt: null };
  } catch (e) {
    return failure(e, "The project could not be restored.");
  }
}

export async function deleteProjectAction(id: string, typedProjectNumber: string): Promise<LifecycleResult> {
  try {
    await requireProjectAdmin();
    const res = await deleteProject(id, typedProjectNumber);
    if (!res.ok) {
      if (res.reason === "NOT_ARCHIVED") return { ok: false, error: "Archive the project before deleting it." };
      if (res.reason === "WRONG_CONFIRMATION") return { ok: false, error: "The project number does not match." };
      return { ok: false, error: "Records still point at this project. It stays archived.", links: res.links };
    }
    revalidatePath("/projects");
    return { ok: true };
  } catch (e) {
    return failure(e, "The project could not be deleted.");
  }
}
