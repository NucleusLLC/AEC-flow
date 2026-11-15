import { notFound, redirect } from "next/navigation";
import { getMeetingProjectId } from "@/lib/data/meetings";
import { editMeetingHref } from "@/lib/meetings/paths";

type PageProps = { params: Promise<{ id: string }> };

/** The old edit address; forwards to the edit page under the minutes' project. */
export default async function EditMeetingRedirect({ params }: PageProps) {
  const { id } = await params;
  const projectId = await getMeetingProjectId(id);
  if (!projectId) notFound();
  redirect(editMeetingHref(projectId, id));
}
