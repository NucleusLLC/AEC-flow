import { notFound, redirect } from "next/navigation";
import { getMeetingProjectId } from "@/lib/data/meetings";
import { meetingHref } from "@/lib/meetings/paths";

type PageProps = { params: Promise<{ id: string }> };

/**
 * The old address of a set of minutes. It is in emails already sent, in the
 * activity log and in "my action items", so it keeps working: it forwards to the
 * minutes under their project.
 */
export default async function MeetingRedirect({ params }: PageProps) {
  const { id } = await params;
  const projectId = await getMeetingProjectId(id);
  if (!projectId) notFound();
  redirect(meetingHref(projectId, id));
}
