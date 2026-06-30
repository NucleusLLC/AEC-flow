import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MeetingForm, type MeetingFormValues } from "@/components/meetings/meeting-form";
import { getMeeting } from "@/lib/data/meetings";
import { getProjects } from "@/lib/data/projects";
import { getTeam } from "@/lib/data/team";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return { title: meeting ? `Edit ${meeting.title} · AEC-flow` : "Edit Minutes · AEC-flow" };
}

export default async function EditMeetingPage({ params }: PageProps) {
  const { id } = await params;
  const [meeting, projects, team] = await Promise.all([
    getMeeting(id),
    getProjects(),
    getTeam(),
  ]);
  if (!meeting) notFound();

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

  const backHref = `/meetings/${meeting.id}`;

  return (
    <div className="w-full space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {meeting.title}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit minutes</h2>
        <p className="text-sm text-muted">{meeting.title}</p>
      </div>
      <MeetingForm
        mode="edit"
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        users={team.map((u) => ({ name: u.name }))}
        initial={initial}
        meetingId={meeting.id}
        backHref={backHref}
      />
    </div>
  );
}
