import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppointmentForm } from "@/components/scheduling/appointment-form";
import { getAppointment, listSchedulingPickers } from "@/lib/data/appointments";
import { canEdit } from "@/lib/scheduling/calc";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Edit appointment · AEC-flow" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appointment = await getAppointment(id);
  if (!appointment) notFound();
  // A completed or cancelled visit is a record; the route refuses rather than
  // rendering a form whose save would be rejected.
  if (!canEdit(appointment.status)) redirect(`/scheduling/${appointment.id}`);

  const [pickers, t] = await Promise.all([listSchedulingPickers(), getServerT()]);

  // A booking may point at an archived project or a proposal no longer listed;
  // keep it selectable so saving does not silently drop the link.
  const projects =
    appointment.projectId && !pickers.projects.some((p) => p.id === appointment.projectId)
      ? [{ id: appointment.projectId, name: appointment.projectName ?? appointment.projectId }, ...pickers.projects]
      : pickers.projects;
  const proposals =
    appointment.serviceProposalId && !pickers.proposals.some((p) => p.id === appointment.serviceProposalId)
      ? [
          {
            id: appointment.serviceProposalId,
            name: `${appointment.proposalNumber ?? ""} · ${appointment.proposalTitle ?? ""}`,
            projectId: null,
          },
          ...pickers.proposals,
        ]
      : pickers.proposals;
  // Someone who has since left still attended: keep them on the list.
  const team = [
    ...pickers.team,
    ...appointment.attendeeIds
      .map((uid, i) => ({ id: uid, name: appointment.attendeeNames[i] ?? uid }))
      .filter((m) => !pickers.team.some((p) => p.id === m.id)),
  ];

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link
        href={`/scheduling/${appointment.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {appointment.number}
      </Link>
      <h2 className="text-xl font-semibold text-fg">{fmt(t("Edit {number}"), { number: appointment.number })}</h2>
      <AppointmentForm
        mode="edit"
        initial={appointment}
        projects={projects}
        proposals={proposals}
        team={team}
      />
    </div>
  );
}
