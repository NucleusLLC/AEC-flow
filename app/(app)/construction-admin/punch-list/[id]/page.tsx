import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, FileDown } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PriorityBadge } from "@/components/ui/badge";
import { PunchStatusBadge } from "@/components/construction-admin/badges";
import { PunchStatus } from "@/components/construction-admin/punch-status";
import { getPunchItem } from "@/lib/data/ca/punch-list";
import { formatDate } from "@/lib/format";
import { getServerLocale, getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await getPunchItem(id);
  return { title: item ? `${item.itemNumber} · Punch List · AEC-flow` : "Punch Item · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function PunchItemDetailPage({ params }: PageProps) {
  const t = await getServerT();
  const locale = await getServerLocale();
  const { id } = await params;
  const item = await getPunchItem(id);
  if (!item) notFound();

  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/punch-list" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Punch List")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{item.itemNumber}</span>
            <PunchStatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{item.description}</h2>
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {item.projectName}
            </span>
            {item.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {item.location}
              </span>
            ) : null}
          </span>
        </div>
        <Link
          href={`/print/construction-admin/punch-list/${item.projectId}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <FileDown className="h-4 w-4" />
          {t("Project snag list")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("Description")} />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.description}</p>
            </CardBody>
          </Card>

          {item.notes ? (
            <Card>
              <CardHeader title={t("Notes")} />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.notes}</p>
              </CardBody>
            </Card>
          ) : null}

          <PunchStatus itemId={item.id} currentStatus={item.status} currentVerifiedBy={item.verifiedBy} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Details")} />
            <CardBody className="divide-y divide-border py-0">
              <Row label={t("Trade")}>{item.trade ?? "—"}</Row>
              <Row label={t("Responsible party")}>{item.responsibleParty ?? "—"}</Row>
              <Row label={t("Identified")}>{formatDate(item.dateIdentified, locale)}</Row>
              <Row label={t("Due")}>{formatDate(item.dueDate, locale)}</Row>
              <Row label={t("Completed")}>{formatDate(item.dateCompleted, locale)}</Row>
              <Row label={t("Verified by")}>{item.verifiedBy ?? "—"}</Row>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
