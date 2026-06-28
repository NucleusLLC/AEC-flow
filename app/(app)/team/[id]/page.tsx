import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, CalendarDays, Pencil } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamStatusBadge, RoleBadge } from "@/components/team/badges";
import {
  getTeamMember,
  DISCIPLINE_LABEL,
  DEPARTMENT_LABEL,
} from "@/lib/data/team";
import { getActionItemsForUser } from "@/lib/data/meetings";
import { ActionStatusBadge } from "@/components/meetings/badges";
import { formatDate } from "@/lib/format";
import { initials, cn } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await getTeamMember(id);
  return { title: member ? `${member.name} · ZenArch` : "Team · ZenArch" };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function TeamMemberPage({ params }: PageProps) {
  const { id } = await params;
  const member = await getTeamMember(id);
  if (!member) notFound();
  const actionItems = await getActionItemsForUser(member.id);

  const leaveRemaining = member.annualLeaveTotal - member.annualLeaveTaken;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Team
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand">
          {initials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-fg">{member.name}</h2>
            <TeamStatusBadge status={member.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <RoleBadge role={member.role} />
            <span>
              {member.discipline ? DISCIPLINE_LABEL[member.discipline] : DEPARTMENT_LABEL[member.department]}
            </span>
          </div>
        </div>
        <Link
          href={`/team/${member.id}/edit`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: bio, projects, skills */}
        <div className="space-y-6 lg:col-span-2">
          {member.bio ? (
            <Card>
              <CardHeader title="About" />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">{member.bio}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Current Projects"
              subtitle={`${member.currentProjects.length} active`}
            />
            <div className="divide-y divide-border">
              {member.currentProjects.length > 0 ? (
                member.currentProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-fg">{p.name}</div>
                      <div className="font-mono text-[11px] text-faint">{p.id}</div>
                    </div>
                    <Badge tone="slate">{p.role}</Badge>
                  </Link>
                ))
              ) : (
                <p className="px-5 py-6 text-sm text-muted">No active project assignments.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Action Items" subtitle={`${actionItems.length} open`} />
            <div className="divide-y divide-border">
              {actionItems.length > 0 ? (
                actionItems.map((a) => (
                  <Link
                    key={a.id}
                    href={`/meetings/${a.meetingId}`}
                    className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-fg">{a.description}</div>
                      <div className="mt-0.5 text-[11px] text-faint">
                        {a.meetingTitle} · {a.projectName}
                        {a.dueDate ? ` · due ${formatDate(a.dueDate)}` : ""}
                      </div>
                    </div>
                    <ActionStatusBadge status={a.status} />
                  </Link>
                ))
              ) : (
                <p className="px-5 py-6 text-sm text-muted">No open action items.</p>
              )}
            </div>
          </Card>

          {member.skills.length > 0 ? (
            <Card>
              <CardHeader title="Skills" />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((s) => (
                    <Badge key={s} tone="blue">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Right: contact, allocation, leave */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact & Details" />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label="Email">
                <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1 hover:text-brand">
                  <Mail className="h-3.5 w-3.5 text-faint" />
                  {member.email}
                </a>
              </DetailRow>
              {member.phone ? (
                <DetailRow label="Phone">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-faint" />
                    {member.phone}
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow label="Department">{DEPARTMENT_LABEL[member.department]}</DetailRow>
              {member.officeLocation ? (
                <DetailRow label="Office">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-faint" />
                    {member.officeLocation}
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow label="Joined">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-faint" />
                  {formatDate(member.joiningDate)}
                </span>
              </DetailRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Allocation" />
            <CardBody className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">Utilisation</span>
                  <span className={cn("font-medium", member.utilisation > 100 ? "text-red-600" : "text-fg")}>
                    {member.utilisation}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      member.utilisation > 100
                        ? "bg-red-500"
                        : member.utilisation > 85
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(100, member.utilisation)}%` }}
                  />
                </div>
              </div>
              <DetailRowInline label="Capacity target" value={`${member.capacity}%`} />
              <DetailRowInline label="Active projects" value={String(member.activeProjects)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Annual Leave" />
            <CardBody className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-fg">{leaveRemaining}</span>
                <span className="text-xs text-muted">days remaining</span>
              </div>
              <div className="text-xs text-faint">
                {member.annualLeaveTaken} of {member.annualLeaveTotal} days taken
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRowInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </div>
  );
}
