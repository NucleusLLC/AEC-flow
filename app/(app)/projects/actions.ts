"use server";

import { revalidatePath } from "next/cache";
import { createProject, updateProject } from "@/lib/data/projects";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { ProjectWriteInput } from "@/lib/data/projects.types";

export type SaveProjectResult =
  | { ok: true; id: string; projectNumber: string | null }
  | { ok: false; error: string };

/**
 * Persist a project (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client.
 *
 * On `edit`, `id` is the project's cuid (required). On `new`, `id` is ignored.
 */
export async function saveProject(
  mode: "new" | "edit",
  input: ProjectWriteInput,
  id?: string,
): Promise<SaveProjectResult> {
  try {
    let result: { id: string; projectNumber: string | null };
    if (mode === "new") {
      result = await createProject(input);
    } else {
      if (!id) throw new Error("Missing project id for update.");
      const updated = await updateProject(id, input);
      result = { id: updated.id, projectNumber: null };
    }
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.id}`);
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "project",
        entityId: result.id,
        projectId: result.id,
      });
    }
    return { ok: true, id: result.id, projectNumber: result.projectNumber };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save project.";
    return { ok: false, error };
  }
}
