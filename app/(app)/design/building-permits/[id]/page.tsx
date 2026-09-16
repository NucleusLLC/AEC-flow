import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PermitStatusBadge, PermitTypeBadge } from "@/components/building-permits/badges";
import { PermitCorrespondence } from "@/components/building-permits/permit-correspondence";
import { PermitDeleteButton } from "@/components/building-permits/permit-delete-button";
import { PermitVersions } from "@/components/building-permits/permit-versions";
import { getBuildingPermit } from "@/lib/data/building-permits";
import {
  lapsedMonths,
  militaryDate,
  permitVersion,
  ymd,
} from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Building Permit · AEC-flow" };

export default async function BuildingPermitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const permit = await getBuildingPermit(id);
  if (!permit) notFound();

  // The practice's own calendar day, as on the register.
  const today = ymd(new Date());
  const version = permitVersion(permit);
  const lapsed = lapsedMonths(permit, today);

  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: "Authority", value: permit.authority ?? "—" },
    { label: "Applicant", value: permit.applicantName ?? "—" },
    { label: "Site address", value: permit.siteAddress ?? "—" },
    { label: "Parcel", value: permit.parcelNumber ?? "—", mono: true },
    { label: "Project", value: permit.projectName ?? "—" },
    { label: "Concept approval", value: militaryDate(permit.conceptApprovalAt), mono: true },
    { label: "Target decision", value: militaryDate(permit.targetDecisionAt), mono: true },
    { label: "Expires", value: militaryDate(permit.expiresAt), mono: true },
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/design/building-permits"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Building Permits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-fg">
              {permit.permitNumber ?? <span className="font-sans italic text-muted">Permit # not yet issued</span>}
            </h2>
            <PermitStatusBadge status={permit.status} />
            <PermitTypeBadge type={permit.permitType} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{permit.reference}</span> · {permit.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/design/building-permits/${permit.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <PermitDeleteButton id={permit.id} reference={permit.reference} />
        </div>
      </div>

      {/* The four numbers the register is read for, in the register's order. */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Version #" value={version ? `V${version.version}` : "—"} />
        <Stat label="Submittal date" value={militaryDate(permit.submittedAt)} />
        <Stat
          label="Lapsed (months)"
          value={lapsed ? lapsed.months.toFixed(1) : "—"}
          note={lapsed ? (lapsed.running ? "running" : "final") : undefined}
        />
        <Stat label="Permit ready date" value={militaryDate(permit.issuedAt)} tone={permit.issuedAt ? "green" : undefined} />
      </div>

      <Card>
        <CardHeader title="Versions" subtitle="V1 is the first submittal; each resubmission is the next version." />
        <CardBody>
          <PermitVersions permitId={permit.id} submissions={permit.submissions} today={today} />
        </CardBody>
      </Card>

      <div id="correspondence" className="scroll-mt-6">
        <Card>
          <CardHeader title="Correspondence" subtitle="Every letter to and from the authority, with its PDF." />
          <CardBody>
            <PermitCorrespondence permitId={permit.id} letters={permit.correspondence} today={today} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Case file" />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm">
              <span className="text-muted">{f.label}</span>
              <span className={`text-right text-fg ${f.mono ? "font-mono text-xs" : ""}`}>{f.value}</span>
            </div>
          ))}
          {permit.description ? (
            <p className="whitespace-pre-line text-sm text-fg sm:col-span-2">{permit.description}</p>
          ) : null}
          {permit.notes ? (
            <p className="whitespace-pre-line text-sm text-muted sm:col-span-2">{permit.notes}</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "green";
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div
          className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
            tone === "green" ? "text-green-700 dark:text-green-400" : "text-fg"
          }`}
        >
          {value}
        </div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
