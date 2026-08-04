import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPunchItems } from "@/lib/data/ca/punch-list";
import { PUNCH_STATUS_LABEL } from "@/lib/ca/labels";
import { formatDate } from "@/lib/format";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import type { PunchListItem, PunchStatus, PunchPriority } from "@/lib/ca/types";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

type PageProps = { params: Promise<{ project: string }> };

const OUTSTANDING: PunchStatus[] = ["OPEN", "IN_PROGRESS"];
const PRIORITY_LABEL: Record<PunchPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
// Print-safe text colours (avoid relying on screen badge tokens in PDF).
const PRIORITY_COLOR: Record<PunchPriority, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-blue-700",
  HIGH: "text-amber-700",
  CRITICAL: "text-red-700",
};
const STATUS_COLOR: Record<PunchStatus, string> = {
  OPEN: "text-amber-700",
  IN_PROGRESS: "text-blue-700",
  COMPLETED: "text-violet-700",
  VERIFIED: "text-emerald-700",
  REJECTED: "text-red-700",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { project } = await params;
  return { title: project === "all" ? "Punch List Register — AEC-flow" : `Punch List — ${project}` };
}

/** Group items by location label, preserving a stable order. */
function byLocation(items: PunchListItem[]): [string, PunchListItem[]][] {
  const map = new Map<string, PunchListItem[]>();
  for (const it of items) {
    const key = it.location?.trim() || "Unspecified location";
    (map.get(key) ?? map.set(key, []).get(key)!).push(it);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function Summary({ items }: { items: PunchListItem[] }) {
  const outstanding = items.filter((p) => OUTSTANDING.includes(p.status)).length;
  const tiles: [string, number | string][] = [
    ["Total items", items.length],
    ["Outstanding", outstanding],
    ["Completed", items.filter((p) => p.status === "COMPLETED").length],
    ["Verified", items.filter((p) => p.status === "VERIFIED").length],
    ["Critical open", items.filter((p) => p.priority === "CRITICAL" && OUTSTANDING.includes(p.status)).length],
  ];
  return (
    <div className="mt-4 grid grid-cols-5 gap-3 rounded-md bg-gray-50 px-4 py-3 text-[11px] print:bg-gray-50">
      {tiles.map(([label, value]) => (
        <div key={label}>
          <div className="text-gray-400">{label}</div>
          <div className="text-base font-semibold tabular-nums text-gray-900">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ items }: { items: PunchListItem[] }) {
  return (
    <table className="w-full border-collapse text-[10.5px]">
      <thead>
        <tr className="border-b border-gray-300 text-left text-[9px] uppercase tracking-wide text-gray-500">
          <th className="py-1.5 pr-2 font-medium">Item</th>
          <th className="py-1.5 pr-2 font-medium">Description</th>
          <th className="py-1.5 pr-2 font-medium">Trade</th>
          <th className="py-1.5 pr-2 font-medium">Responsible</th>
          <th className="py-1.5 pr-2 font-medium">Priority</th>
          <th className="py-1.5 pr-2 font-medium">Status</th>
          <th className="py-1.5 pr-2 font-medium">Due</th>
          <th className="py-1.5 font-medium">Completed</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id} className="break-inside-avoid border-b border-gray-100 align-top">
            <td className="py-1.5 pr-2 font-mono text-[9.5px] text-gray-600 whitespace-nowrap">{p.itemNumber}</td>
            <td className="py-1.5 pr-2 text-gray-900">{p.description}</td>
            <td className="py-1.5 pr-2 text-gray-700 whitespace-nowrap">{p.trade ?? "—"}</td>
            <td className="py-1.5 pr-2 text-gray-700 whitespace-nowrap">{p.responsibleParty ?? "—"}</td>
            <td className={`py-1.5 pr-2 font-medium whitespace-nowrap ${PRIORITY_COLOR[p.priority]}`}>{PRIORITY_LABEL[p.priority]}</td>
            <td className={`py-1.5 pr-2 font-medium whitespace-nowrap ${STATUS_COLOR[p.status]}`}>{PUNCH_STATUS_LABEL[p.status]}</td>
            <td className="py-1.5 pr-2 text-gray-700 whitespace-nowrap">{formatDate(p.dueDate)}</td>
            <td className="py-1.5 text-gray-700 whitespace-nowrap">{formatDate(p.dateCompleted)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function PunchListPrintPage({ params }: PageProps) {
  const { project } = await params;
  const all = project === "all";
  const [items, practice] = await Promise.all([
    listPunchItems(all ? undefined : project),
    getPracticeSettings(),
  ]);
  if (items.length === 0) notFound();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  // Group by project (for "all"), each project's items grouped by location.
  const projectGroups = new Map<string, PunchListItem[]>();
  for (const it of items) {
    const key = it.projectName || it.projectId;
    (projectGroups.get(key) ?? projectGroups.set(key, []).get(key)!).push(it);
  }
  const projects = [...projectGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const docTitle = all ? "Punch List Register" : "Punch List";
  const heading = all ? "Portfolio Snag & Defect Register" : projects[0][0];
  const reportRef = `PL-REG-${all ? "ALL" : project}`;
  const backHref = "/construction-admin/punch-list";

  return (
    // Landscape: eight columns of defect data do not fit a portrait text block.
    // Everything else — margins, footer band, paged preview — is the standard
    // document geometry. This register used to declare 12mm page margins and then
    // pad its sheet by 14, so its preview wrapped at a width the printer never
    // used; and it had no paged preview at all, which is why a register long
    // enough to run to six sheets showed as one endless page.
    <PrintSurface backHref={backHref} orientation="landscape">
      {/* Letterhead */}
      <DocumentLetterhead
        logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
        name={companyName}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{docTitle}</div>
            <div className="mt-1 font-mono text-xs text-gray-600">{reportRef}</div>
            <div className="text-[11px] text-gray-500">Issued {formatDate(new Date().toISOString())}</div>
          </div>
        }
      />

      <h1 className="mt-6 text-lg font-bold text-gray-900">{heading}</h1>
      <Summary items={items} />

      {projects.map(([projectName, projectItems]) => (
        <section key={projectName} className="mt-8">
          {all ? (
            <h2 className="mb-2 border-b border-gray-300 pb-1 text-[12px] font-semibold text-gray-900">
              {projectName}
              <span className="ml-2 font-normal text-gray-400">({projectItems.length} items)</span>
            </h2>
          ) : null}
          {byLocation(projectItems).map(([location, locItems]) => (
            <div key={location} className="mt-4 break-inside-avoid">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{location}</h3>
              <div className="mt-1">
                <ItemsTable items={locItems} />
              </div>
            </div>
          ))}
        </section>
      ))}

      {/* Sign-off */}
      <div className="mt-10 break-inside-avoid border-t border-gray-300 pt-6">
        <div className="grid grid-cols-3 gap-8">
          {["Prepared by (Consultant)", "Acknowledged (Contractor)", "Verified (Owner / Lender)"].map((role) => (
            <div key={role}>
              <div className="h-px w-full bg-gray-400" />
              <div className="mt-1 text-xs text-gray-600">{role}</div>
              <div className="text-[11px] text-gray-400">Name · Signature · Date</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[9px] leading-relaxed text-gray-400">
        Disclaimer: This snag and defect register is issued for construction administration purposes. Items
        remain subject to site verification and final inspection prior to handover. © {companyName}.
      </p>
      <div className="mt-3 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {companyName} · {reportRef} · {docTitle}
      </div>
    </PrintSurface>
  );
}
