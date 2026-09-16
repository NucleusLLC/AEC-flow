import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PermitStatusBadge, PermitTypeBadge } from "@/components/building-permits/badges";
import { PermitCaseFile } from "@/components/building-permits/permit-case-file";
import { PermitDeleteButton } from "@/components/building-permits/permit-delete-button";
import { getBuildingPermit } from "@/lib/data/building-permits";
import { militaryDate, ymd } from "@/lib/building-permits/register";

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
            href={`/print/design/building-permits/${permit.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" /> Print
          </Link>
          <Link
            href={`/design/building-permits/${permit.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <PermitDeleteButton id={permit.id} reference={permit.reference} />
        </div>
      </div>

      <PermitCaseFile initial={permit} today={today} />

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
