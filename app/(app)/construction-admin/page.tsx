import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import {
  FileSignature,
  MessageSquareWarning,
  FileText,
  BadgeCheck,
  ListChecks,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import {
  ChangeOrderStatusBadge,
  RfiStatusBadge,
  CertStatusBadge,
} from "@/components/construction-admin/badges";
import { getCaDashboard } from "@/lib/data/ca/dashboard";
import { listChangeOrders } from "@/lib/data/ca/change-orders";
import { listRfis } from "@/lib/data/ca/rfis";
import { listCertifications } from "@/lib/data/ca/certifications";
import { listPunchItems } from "@/lib/data/ca/punch-list";
import { formatCurrencyCompact, formatCurrency } from "@/lib/format";

export const metadata = { title: "Construction Admin · AEC-flow" };

const RISK_TONE = { LOW: "green", MEDIUM: "amber", HIGH: "red" } as const;

function ToneIcon({ tone }: { tone?: "up" | "down" | "flat" }) {
  if (tone === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (tone === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  if (tone === "flat") return <Minus className="h-4 w-4 text-faint" />;
  return null;
}

export default async function ConstructionAdminPage() {
  const tr = await getServerT();
  const [dash, changeOrders, rfis, certs, punchItems] = await Promise.all([
    getCaDashboard(),
    listChangeOrders(),
    listRfis(),
    listCertifications(),
    listPunchItems(),
  ]);

  const money = (v: number) => formatCurrencyCompact(v, dash.currency);
  const schedule =
    dash.scheduleStatusDays === 0
      ? "On schedule"
      : dash.scheduleStatusDays > 0
        ? `+${dash.scheduleStatusDays}d slip`
        : `${dash.scheduleStatusDays}d ahead`;

  const tiles: Array<{ label: string; value: string; hint?: string; tone?: "up" | "down" | "flat" }> = [
    { label: "Original Contract", value: money(dash.originalContractValue) },
    { label: "Approved COs", value: money(dash.approvedChangeOrders), tone: "up" },
    { label: "Pending COs", value: money(dash.pendingChangeOrders), tone: "flat" },
    { label: "Revised Contract", value: money(dash.revisedContractValue), tone: "up" },
    { label: "Percent Complete", value: `${dash.percentComplete}%` },
    {
      label: "Schedule Status",
      value: schedule,
      tone: dash.scheduleStatusDays > 0 ? "down" : dash.scheduleStatusDays < 0 ? "up" : "flat",
    },
    { label: "Open RFIs", value: String(dash.openRfis) },
    { label: "Open Submittals", value: String(dash.openSubmittals) },
    { label: "Open Punch Items", value: String(dash.openPunchItems) },
    { label: "Pending Bank Draws", value: String(dash.pendingBankDraws) },
  ];

  const quickLinks = [
    { label: "Change Orders", href: "/construction-admin/change-orders", icon: FileSignature, count: changeOrders.length },
    { label: "RFIs", href: "/construction-admin/rfis", icon: MessageSquareWarning, count: rfis.length },
    { label: "Reports", href: "/construction-admin/reports", icon: FileText, count: null },
    { label: "Certifications", href: "/construction-admin/certifications", icon: BadgeCheck, count: certs.length },
    { label: "Punch List", href: "/construction-admin/punch-list", icon: ListChecks, count: punchItems.length },
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{tr("Construction Administration & Reporting")}</h2>
        <p className="text-sm text-muted">
          {tr("Project controls across change orders, RFIs, progress reports and lender certifications.")}
        </p>
      </div>

      <CaSubNav />

      {/* Widgets */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">{t.label}</div>
              <ToneIcon tone={t.tone} />
            </div>
            <div className="mt-1.5 text-lg font-semibold tracking-tight text-fg">{t.value}</div>
          </Card>
        ))}
        <Card className="p-4">
          <div className="text-xs text-muted">Current Risk Level</div>
          <div className="mt-2">
            <Badge tone={RISK_TONE[dash.riskLevel]}>{dash.riskLevel}</Badge>
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {quickLinks.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.href} href={q.href} className="group">
              <Card className="flex items-center justify-between p-4 transition-colors hover:border-brand/40 hover:bg-surface-2">
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-fg">
                  <Icon className="h-4 w-4 text-faint" />
                  {q.label}
                  {q.count !== null ? <span className="text-xs text-faint">({q.count})</span> : null}
                </span>
                <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent change orders + RFIs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-fg">Recent Change Orders</h3>
            <Link href="/construction-admin/change-orders" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {changeOrders.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/construction-admin/change-orders/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{c.title}</div>
                    <div className="font-mono text-[11px] text-faint">{c.changeOrderNumber}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-fg">{formatCurrency(c.totalCost, c.currency)}</span>
                    <ChangeOrderStatusBadge status={c.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-fg">Open RFIs &amp; Certifications</h3>
            <Link href="/construction-admin/rfis" className="text-xs text-brand hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {rfis.filter((r) => r.status === "OPEN").slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link href={`/construction-admin/rfis/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{r.subject}</div>
                    <div className="font-mono text-[11px] text-faint">{r.rfiNumber}</div>
                  </div>
                  <RfiStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
            {certs.slice(0, 2).map((c) => (
              <li key={c.id}>
                <Link href={`/construction-admin/certifications/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{c.projectName}</div>
                    <div className="font-mono text-[11px] text-faint">{c.certificationNumber}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-fg">{formatCurrency(c.amountRecommendedForPayment, c.currency)}</span>
                    <CertStatusBadge status={c.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
