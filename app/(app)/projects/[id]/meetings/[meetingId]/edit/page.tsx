import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MeetingForm, type MeetingFormValues } from "@/components/meetings/meeting-form";
import { getMeeting } from "@/lib/data/meetings";
import { getProjects } from "@/lib/data/projects";
import { getTeam } from "@/lib/data/team";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { editMeetingHref, meetingHref } from "@/lib/meetings/paths";

type PageProps = { params: Promise<{ id: string; meetingId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { meetingId } = await params;
  const meeting = await getMeeting(meetingId);
  const t = await getServerT();
  return { title: meeting ? `${fmt(t("Edit {title}"), { title: meeting.title })} · AEC-flow` : `${t("Edit minutes")} · AEC-flow` };
}

export default async function EditMeetingPage({ params }: PageProps) {
  const { id, meetingId } = await params;
  const [meeting, projects, team] = await Promise.all([
    getMeeting(meetingId),
    getProjects(),
    getTeam(),
  ]);
  if (!meeting) notFound();
  if (meeting.projectId !== id) redirect(editMeetingHref(meeting.projectId, meeting.id));
  const t = await getServerT();

  const initial: MeetingFormValues = {
    title: meeting.title,
    projectId: meeting.projectId,
    author: meeting.author,
    type: meeting.type,
    meetingDate: meeting.meetingDate,
    location: meeting.location ?? "",
    participants: meeting.participants.join(", "),
    summary: meeting.summary ?? "",
    discussion: meeting.discussion ?? "",
    decisions: meeting.decisions ?? "",
    followUpDate: meeting.followUpDate ?? "",
    actionItems: meeting.actionItems.map((a) => ({
      description: a.description,
      assignee: a.assignee,
      dueDate: a.dueDate ?? "",
      status: a.status,
    })),
  };

  const backHref = meetingHref(meeting.projectId, meeting.id);

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {meeting.title}
      </Link>
      <div>
        <h3 className="text-xl font-semibold text-fg">{t("Edit minutes")}</h3>
        <p className="text-sm text-muted">{meeting.title}</p>
      </div>
      <MeetingForm
        mode="edit"
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          projectNumber: p.projectNumber,
        }))}
        users={team.map((u) => ({ name: u.name }))}
        initial={initial}
        meetingId={meeting.id}
        backHref={backHref}
      />
    </div>
  );
}
