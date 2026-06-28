import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, HardHat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChangeOrderStatusBadge, RfiStatusBadge, CertStatusBadge } from "@/components/construction-admin/badges";
import { getProject } from "@/lib/data/projects";
import { listChangeOrders } from "@/lib/data/ca/change-orders";
import { listRfis } from "@/lib/data/ca/rfis";
import { listCertifications } from "@/lib/data/ca/certifications";
import { formatCurrency } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} · Construction Admin · ZenArch` : "Project · ZenArch" };
}

export default async function ProjectConstructionAdminPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [changeOrders, rfis, certs] = await Promise.all([
    listChangeOrders(project.id),
    listRfis(project.id),
    listCertifications(project.id),
  ]);

  const approved = changeOrders.filter((c) => c.status === "APPROVED").reduce((n, c) => n + c.totalCost, 0);
  const currency = changeOrders[0]?.currency ?? project.currency;
  const openRfis = rfis.filter((r) => r.status === "OPEN").length;

  const tiles = [
    { label: "Change Orders", value: String(changeOrders.length) },
    { label: "Approved CO value", value: formatCurrency(approved, currency) },
    { label: "Open RFIs", value: String(openRfis) },
    { label: "Certifications", value: String(certs.length) },
  ];

  const empty = changeOrders.length + rfis.length + certs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Construction Administration</h3>
          <p className="text-xs text-muted">Change orders, RFIs and progress certifications for this project.</p>
        </div>
        <Link href="/construction-admin" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2">
          Open module
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="mt-1.5 text-lg font-semibold tracking-tight text-fg">{t.value}</div>
          </Card>
        ))}
      </div>

      {empty ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <HardHat className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-fg">No construction-admin records for this project yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Raise change orders, RFIs and certifications in the Construction Admin module — they’ll appear here once linked to this project.
          </p>
          <Link href="/construction-admin/change-orders/new" className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-fg hover:bg-brand/90">
            New Change Order
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold text-fg">Change Orders</div>
            <ul className="divide-y divide-border">
              {changeOrders.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/construction-admin/change-orders/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{c.title}</span>
                      <span className="font-mono text-[11px] text-faint">{c.changeOrderNumber}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-fg">{formatCurrency(c.totalCost, c.currency)}</span>
                      <ChangeOrderStatusBadge status={c.status} />
                    </span>
                  </Link>
                </li>
              ))}
              {changeOrders.length === 0 ? <li className="px-5 py-4 text-sm text-muted">No change orders.</li> : null}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold text-fg">RFIs &amp; Certifications</div>
            <ul className="divide-y divide-border">
              {rfis.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link href={`/construction-admin/rfis/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{r.subject}</span>
                      <span className="font-mono text-[11px] text-faint">{r.rfiNumber}</span>
                    </span>
                    <RfiStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
              {certs.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link href={`/construction-admin/certifications/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{c.certificationNumber}</span>
                      <span className="text-[11px] text-faint">Recommended {formatCurrency(c.amountRecommendedForPayment, c.currency)}</span>
                    </span>
                    <CertStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
