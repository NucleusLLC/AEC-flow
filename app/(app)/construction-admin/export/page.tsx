import { FileDown, FileText, FileSignature, BadgeCheck, ListChecks, MessageSquareWarning } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { listChangeOrders } from "@/lib/data/ca/change-orders";
import { listReports } from "@/lib/data/ca/reports";
import { listCertifications } from "@/lib/data/ca/certifications";
import { listRfis } from "@/lib/data/ca/rfis";
import { listPunchItems } from "@/lib/data/ca/punch-list";
import { CA_REPORT_TYPE_LABEL } from "@/lib/ca/labels";

export const metadata = { title: "Export Center · AEC-flow" };

function ExportRow({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-fg">{title}</div>
        <div className="font-mono text-[11px] text-faint">{sub}</div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand">
        <FileDown className="h-3.5 w-3.5" />
        PDF
      </span>
    </a>
  );
}

export default async function ExportCenterPage() {
  const [changeOrders, reports, certs, rfis, punchItems] = await Promise.all([
    listChangeOrders(),
    listReports(),
    listCertifications(),
    listRfis(),
    listPunchItems(),
  ]);

  // Punch list exports as a per-project snag register (+ a portfolio roll-up).
  const punchByProject = new Map<string, { name: string; count: number }>();
  for (const p of punchItems) {
    const entry = punchByProject.get(p.projectId) ?? { name: p.projectName, count: 0 };
    entry.count += 1;
    punchByProject.set(p.projectId, entry);
  }
  const punchProjects = [...punchByProject.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Report Export Center</h2>
        <p className="text-sm text-muted">
          Generate print-ready A4 PDFs for any document. Word export and bulk distribution are on the
          Phase 2 roadmap.
        </p>
      </div>
      <CaSubNav />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader title="Change Orders" action={<FileSignature className="h-4 w-4 text-faint" />} />
          <div className="divide-y divide-border">
            {changeOrders.map((c) => (
              <ExportRow key={c.id} href={`/print/construction-admin/change-orders/${c.id}`} title={c.title} sub={c.changeOrderNumber} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Reports" action={<FileText className="h-4 w-4 text-faint" />} />
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <ExportRow key={r.id} href={`/print/construction-admin/reports/${r.id}`} title={`${CA_REPORT_TYPE_LABEL[r.reportType]} — ${r.projectName}`} sub={r.reportNumber} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="RFIs" action={<MessageSquareWarning className="h-4 w-4 text-faint" />} />
          <div className="divide-y divide-border">
            {rfis.map((r) => (
              <ExportRow key={r.id} href={`/print/construction-admin/rfis/${r.id}`} title={r.subject} sub={r.rfiNumber} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Certifications" action={<BadgeCheck className="h-4 w-4 text-faint" />} />
          <div className="divide-y divide-border">
            {certs.map((c) => (
              <ExportRow key={c.id} href={`/print/construction-admin/certifications/${c.id}`} title={c.projectName} sub={c.certificationNumber} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Punch List" action={<ListChecks className="h-4 w-4 text-faint" />} />
          <div className="divide-y divide-border">
            {punchItems.length > 0 ? (
              <ExportRow href="/print/construction-admin/punch-list/all" title="Portfolio snag register" sub={`All projects · ${punchItems.length} items`} />
            ) : null}
            {punchProjects.map(([projectId, { name, count }]) => (
              <ExportRow key={projectId} href={`/print/construction-admin/punch-list/${projectId}`} title={name} sub={`Snag register · ${count} item${count === 1 ? "" : "s"}`} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
