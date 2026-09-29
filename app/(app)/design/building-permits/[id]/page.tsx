import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Printer } from "lucide-react";
import { PermitStatusBadge, PermitTypeBadge } from "@/components/building-permits/badges";
import { PermitCaseFile } from "@/components/building-permits/permit-case-file";
import { PermitDeleteButton } from "@/components/building-permits/permit-delete-button";
import { getBuildingPermit } from "@/lib/data/building-permits";
import { ymd } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Building permit")} · AEC-flow` };
}

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
  const t = await getServerT();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/design/building-permits"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Building Permits")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-fg">
              {permit.permitNumber ?? <span className="font-sans italic text-muted">{t("Permit # not yet issued")}</span>}
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
            <Printer className="h-4 w-4" /> {t("Print")}
          </Link>
          <Link
            href={`/print/design/building-permits/${permit.id}/summary`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <FileText className="h-4 w-4" /> {t("Process summary")}
          </Link>
          <Link
            href={`/design/building-permits/${permit.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> {t("Edit")}
          </Link>
          <PermitDeleteButton id={permit.id} reference={permit.reference} />
        </div>
      </div>

      <PermitCaseFile initial={permit} today={today} />

    </div>
  );
}
