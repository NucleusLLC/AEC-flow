import type { Metadata } from "next";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { listBuildingPermits } from "@/lib/data/building-permits";
import {
  bandPermits,
  filterPermits,
  isResponseOverdue,
  lapsedMonths,
  militaryDate,
  permitVersion,
  registerTotals,
  sortPermits,
  ymd,
} from "@/lib/building-permits/register";
import {
  describePermitPrintScope,
  parsePermitPrintQuery,
  type PermitPrintQuery,
} from "@/lib/building-permits/print-filter";
import {
  PERMIT_STATUS_LABEL,
  type BuildingPermitSummaryDTO,
} from "@/lib/building-permits/types";

export const metadata: Metadata = { title: "Building Permit Register · Print" };

/**
 * The printed register.
 *
 * It calls the SAME pure functions as the screen (filter, sort, band, version,
 * lapsed months, military dates), and reads its filters back out of the query
 * string the screen built, so the sheet on the desk is the list that was on
 * screen — same rows, same order, same groups.
 *
 * Landscape by default: seven columns of case-file data do not fit a portrait
 * text block. `?orientation=portrait` prints the same register narrower, which
 * is what a two-hole punch file wants.
 */
export default async function BuildingPermitRegisterPrintPage({
  searchParams,
}: {
  searchParams: Promise<PermitPrintQuery>;
}) {
  const request = parsePermitPrintQuery(await searchParams);
  const [permits, practice, firm] = await Promise.all([
    listBuildingPermits(),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);

  const today = ymd(new Date());
  const rows = sortPermits(
    filterPermits(permits, {
      status: request.status,
      permitType: request.permitType,
      authority: request.authority,
      q: request.q,
    }),
    request.sort,
    request.dir,
  );
  const bands = bandPermits(rows, request.band, (s) => PERMIT_STATUS_LABEL[s]);
  const totals = registerTotals(rows, today);
  const scope = describePermitPrintScope(request);

  return (
    <PrintSurface
      backHref="/design/building-permits"
      backLabel="Building Permits"
      orientation={request.orientation}
      density="compact"
    >
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline="Architecture · Engineering · Project Management"
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              Building Permit Register
            </div>
            <div className="mt-1 font-mono text-xs text-gray-600">BP-REG</div>
            <div className="text-[11px] text-gray-500">Issued {militaryDate(today)}</div>
          </div>
        }
      />

      <h1 className="mt-6 text-lg font-bold text-gray-900">{scope}</h1>
      <p className="mt-1 text-[11px] text-gray-500">
        {rows.length} {rows.length === 1 ? "permit" : "permits"} · {totals.open} open ·{" "}
        {totals.awaitingAuthority} awaiting the authority · {totals.issued} issued
        {totals.overdueResponses > 0 ? ` · ${totals.overdueResponses} overdue reply` : ""}
        {totals.overdueResponses > 1 ? "s" : ""}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">No permit matches these filters.</p>
      ) : (
        bands.map((band) => (
          <section key={band.key} className="mt-6">
            {request.band !== "none" ? (
              <h2 className="mb-1 border-b border-gray-300 pb-1 text-[11px] font-semibold text-gray-900">
                {band.label || "Ungrouped"}
                <span className="ml-2 font-normal text-gray-400">
                  ({band.permits.length})
                </span>
              </h2>
            ) : null}
            <RegisterTable permits={band.permits} today={today} />
          </section>
        ))
      )}

      <p className="mt-8 text-[9px] leading-relaxed text-gray-400">
        Lapsed months run from the submittal date to the permit ready date, or to the date of issue
        of this register while the permit is still with the authority. © {firm.name}.
      </p>
    </PrintSurface>
  );
}

/**
 * `<thead>` repeats on every sheet by default in print, which is the whole point
 * of keeping the register as one table per band rather than one table per page.
 */
function RegisterTable({
  permits,
  today,
}: {
  permits: BuildingPermitSummaryDTO[];
  today: string;
}) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b border-gray-300 text-left text-gray-500">
          <th className="py-1 pr-2 font-medium">Building permit #</th>
          <th className="py-1 px-2 font-medium">Permit</th>
          <th className="py-1 px-2 text-center font-medium">Version #</th>
          <th className="py-1 px-2 font-medium">Submittal date</th>
          <th className="py-1 px-2 font-medium">Correspondence</th>
          <th className="py-1 px-2 text-right font-medium">Lapsed (months)</th>
          <th className="py-1 pl-2 font-medium">Permit ready date</th>
        </tr>
      </thead>
      <tbody>
        {permits.map((p) => {
          const version = permitVersion(p);
          const lapsed = lapsedMonths(p, today);
          const overdue = isResponseOverdue(p, today);
          return (
            <tr key={p.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1 pr-2">
                <div className="font-mono text-gray-900">{p.permitNumber ?? "Not yet issued"}</div>
                <div className="font-mono text-[9px] text-gray-400">{p.reference}</div>
              </td>
              <td className="py-1 px-2">
                <div className="text-gray-900">{p.title}</div>
                <div className="text-[9px] text-gray-500">
                  {[PERMIT_STATUS_LABEL[p.status], p.projectName ?? p.siteAddress]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              <td className="py-1 px-2 text-center font-mono text-gray-900">
                {version ? `V${version.version}` : "—"}
              </td>
              <td className="py-1 px-2 font-mono text-gray-700">
                {militaryDate(p.submittedAt)}
              </td>
              <td className="py-1 px-2">
                {p.letters.length === 0 ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <ul>
                    {p.letters.map((l) => (
                      <li key={l.id} className="text-[9px] text-gray-700">
                        <span className="font-mono">
                          {l.direction === "INCOMING" ? "IN" : "OUT"} {militaryDate(l.letterDate)}
                        </span>{" "}
                        {l.letterRef ?? l.subject}
                        {l.pdf ? " (PDF)" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {p.openResponseDueAt ? (
                  <div
                    className={`text-[9px] font-semibold ${
                      overdue ? "text-red-700" : "text-gray-700"
                    }`}
                  >
                    Reply {overdue ? "overdue" : "due"} {militaryDate(p.openResponseDueAt)}
                  </div>
                ) : null}
              </td>
              <td className="py-1 px-2 text-right font-mono text-gray-900">
                {lapsed ? lapsed.months.toFixed(1) : "—"}
                {lapsed?.running ? <span className="text-gray-400"> …</span> : null}
              </td>
              <td className="py-1 pl-2 font-mono text-gray-700">
                {p.issuedAt
                  ? militaryDate(p.issuedAt)
                  : p.targetDecisionAt
                    ? `Target ${militaryDate(p.targetDecisionAt)}`
                    : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
