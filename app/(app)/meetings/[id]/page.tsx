import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Printer,
  FolderKanban,
  CalendarClock,
  MapPin,
  Users,
  ListChecks,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MeetingTypeBadge, ActionStatusBadge } from "@/components/meetings/badges";
import { getMeeting } from "@/lib/data/meetings";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return {
    title: meeting ? `${meeting.title} · Minutes · AEC-flow` : "Minutes · AEC-flow",
  };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {subtitle ? <span className="text-xs text-muted">{subtitle}</span> : null}
    </div>
  );
}

function TextCard({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <Card>
      <SectionHeader title={title} />
      <CardBody>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{body}</p>
      </CardBody>
    </Card>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Meeting Minutes
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MeetingTypeBadge type={meeting.type} />
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <CalendarClock className="h-3.5 w-3.5 text-faint" />
              {formatDate(meeting.meetingDate)}
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-fg">{meeting.title}</h2>
          <Link
            href={`/projects/${meeting.projectId}`}
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand hover:underline"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            {meeting.projectName}
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href={`/print/meetings/${meeting.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </a>
          <Link
            href={`/meetings/${meeting.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: notes + action items */}
        <div className="space-y-5 lg:col-span-2">
          <TextCard title="Summary" body={meeting.summary} />
          <TextCard title="Discussion" body={meeting.discussion} />
          <TextCard title="Decisions" body={meeting.decisions} />

          <Card>
            <SectionHeader
              title="Action Items"
              subtitle={`${meeting.actionItemsCount} item${meeting.actionItemsCount === 1 ? "" : "s"} · ${meeting.openActionsCount} open`}
            />
            {meeting.actionItems.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="px-5 py-2">Action</th>
                      <th className="px-3 py-2">Assignee</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-5 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {meeting.actionItems.map((a) => (
                      <tr key={a.id} className="transition-colors hover:bg-surface-2/60">
                        <td className="px-5 py-2 font-medium text-fg">{a.description}</td>
                        <td className="px-3 py-2 text-muted">{a.assignee}</td>
                        <td className="px-3 py-2 text-muted">
                          {a.dueDate ? formatDate(a.dueDate) : <span className="text-faint">—</span>}
                        </td>
                        <td className="px-5 py-2 text-right">
                          <ActionStatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardBody className="flex items-center gap-2 text-sm text-muted">
                <ListChecks className="h-4 w-4 text-faint" />
                No action items recorded.
              </CardBody>
            )}
          </Card>
        </div>

        {/* Right: details + participants */}
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label="Type">
                <MeetingTypeBadge type={meeting.type} />
              </DetailRow>
              <DetailRow label="Date">{formatDate(meeting.meetingDate)}</DetailRow>
              <DetailRow label="Author">{meeting.author}</DetailRow>
              <DetailRow label="Location">
                {meeting.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-faint" />
                    {meeting.location}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </DetailRow>
              <DetailRow label="Follow-up">
                {meeting.followUpDate ? formatDate(meeting.followUpDate) : <span className="text-faint">—</span>}
              </DetailRow>
            </CardBody>
          </Card>

          <Card>
            <SectionHeader title="Participants" subtitle={`${meeting.participantCount}`} />
            <CardBody>
              {meeting.participants.length ? (
                <ul className="space-y-1.5">
                  {meeting.participants.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-fg">
                      <Users className="h-3.5 w-3.5 text-faint" />
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No participants recorded.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
