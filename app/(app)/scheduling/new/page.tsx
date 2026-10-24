import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppointmentForm } from "@/components/scheduling/appointment-form";
import { listSchedulingPickers, officeNow } from "@/lib/data/appointments";
import { splitWallClock } from "@/lib/scheduling/calc";
import { APPOINTMENT_TYPES, type AppointmentType } from "@/lib/scheduling/types";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Schedule · AEC-flow" };

/**
 * Book a meeting or a visit. `?project=`, `?proposal=` and `?type=` prefill the
 * form — from a project's Scheduling tab or a proposal's card. A project or
 * proposal id that is not this practice's is not in the pickers (they are read
 * through the tenant-scoped client), so it is simply ignored; the action would
 * refuse it anyway.
 */
export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; proposal?: string; type?: string }>;
}) {
  const [sp, pickers, t] = await Promise.all([searchParams, listSchedulingPickers(), getServerT()]);

  const project = sp.project ? pickers.projects.find((p) => p.id === sp.project) : undefined;
  const proposal = sp.proposal ? pickers.proposals.find((p) => p.id === sp.proposal) : undefined;
  const type = APPOINTMENT_TYPES.includes(sp.type as AppointmentType) ? (sp.type as AppointmentType) : null;
  const today = splitWallClock(officeNow()).date;

  const back = project
    ? { href: `/projects/${project.id}/scheduling`, label: project.name }
    : proposal
      ? { href: `/design/service-proposals/${proposal.id}`, label: proposal.name }
      : { href: "/scheduling", label: t("Scheduling") };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {back.label}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Schedule an appointment")}</h2>
        <p className="text-sm text-muted">
          {t("A meeting, an inspection, a measuring or supervision visit. The number is assigned when it is booked.")}
        </p>
      </div>
      <AppointmentForm
        mode="new"
        defaults={{
          projectId: project?.id ?? null,
          serviceProposalId: proposal?.id ?? null,
          type,
          date: today,
        }}
        projects={pickers.projects}
        proposals={pickers.proposals}
        team={pickers.team}
      />
    </div>
  );
}
