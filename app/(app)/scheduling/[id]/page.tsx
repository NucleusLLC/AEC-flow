import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AppointmentActions } from "@/components/scheduling/appointment-actions";
import { AppointmentStatusBadge, AppointmentTypeBadge } from "@/components/scheduling/badges";
import { getAppointment, officeNow } from "@/lib/data/appointments";
import { awaitingCompletion, effectiveHours, formatHours } from "@/lib/scheduling/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Appointment · AEC-flow" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, t] = await Promise.all([getAppointment(id), getServerT()]);
  if (!a) notFound();
  const now = officeNow();
  const stamp = (iso: string | null) => (iso ? militaryDate(iso.slice(0, 10)) : "—");

  const facts: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: t("Date"), value: militaryDate(a.date), mono: true },
    { label: t("Time slot"), value: `${a.startTime}–${a.endTime}`, mono: true },
    { label: t("Planned hours"), value: formatHours(a.plannedHours), mono: true },
    {
      label: t("Actual hours"),
      value: a.status === "COMPLETED" ? formatHours(effectiveHours(a)) : "—",
      mono: true,
    },
    { label: t("Location"), value: a.location ?? "—" },
    {
      label: t("Project"),
      value: a.projectId ? (
        <Link href={`/projects/${a.projectId}/scheduling`} className="text-brand hover:underline">
          {a.projectName}
        </Link>
      ) : (
        "—"
      ),
    },
    {
      label: t("Service proposal"),
      value: a.serviceProposalId ? (
        <Link href={`/design/service-proposals/${a.serviceProposalId}`} className="text-brand hover:underline">
          {a.proposalNumber} · {a.proposalTitle}
        </Link>
      ) : (
        "—"
      ),
    },
    { label: t("Client"), value: a.clientName ?? "—" },
    { label: t("Team"), value: a.attendeeNames.length ? a.attendeeNames.join(", ") : "—" },
    { label: t("Others attending"), value: a.externalAttendees ?? "—" },
    { label: t("Booked by"), value: a.createdByName ?? "—" },
    {
      label: t("Completed"),
      value: a.completedAt ? `${stamp(a.completedAt)}${a.completedByName ? ` · ${a.completedByName}` : ""}` : "—",
    },
    { label: t("On timesheets"), value: a.timeLoggedAt ? stamp(a.timeLoggedAt) : "—", mono: true },
  ];

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link href="/scheduling" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Scheduling")}
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-xl font-semibold text-fg">{a.number}</h2>
          <AppointmentTypeBadge type={a.type} />
          <AppointmentStatusBadge status={a.status} />
        </div>
        <p className="mt-1 text-sm text-fg">{a.title}</p>
      </div>

      <AppointmentActions appointment={a} />

      {awaitingCompletion(a, now) ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {t("This visit’s time has gone by. Complete it with the hours it took, postpone it or cancel it.")}
        </p>
      ) : null}
      {a.status === "CANCELLED" ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-fg">
          {t("Cancelled:")} {a.cancelReason ?? "—"}
        </p>
      ) : null}
      {a.status === "POSTPONED" && a.cancelReason ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg">
          {t("Postponed:")} {a.cancelReason}
        </p>
      ) : null}

      <Card>
        <CardHeader title={t("Details")} />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className={f.mono ? "font-mono text-fg" : "text-fg"}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {a.notes ? (
        <Card>
          <CardHeader title={t("Agenda / instructions")} />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-fg">{a.notes}</p>
          </CardBody>
        </Card>
      ) : null}

      {a.outcome ? (
        <Card>
          <CardHeader title={t("Outcome")} />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-fg">{a.outcome}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
