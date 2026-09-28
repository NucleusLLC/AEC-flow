import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { projectReviewRegister } from "@/lib/data/review-register";
import { registerSummary, type RegisterStatus } from "@/lib/drawings/review-register";
import { militaryDate } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Review Register · Print" };

/**
 * The drawing review register, on the practice letterhead.
 *
 * ─── PAGE OVERFLOW ──────────────────────────────────────────────────────────
 * None of it is this route's code, and that is the point. `CaPrintShell` sits
 * on `PrintSurface`, which resolves the sheet geometry once and gives it to
 * both `PageRules` (the `@page` margins and the footer band with `P i of P n`)
 * and `PagedPreview`, whose measuring pass paginates against exactly those
 * numbers. A heading is never stranded at a page foot.
 *
 * What this route must get right is what is ATOMIC. A `PrintSection` is
 * deliberately not: a register of eighty items is taller than a page, and a
 * section that refuses to break would jump whole to the next sheet and leave
 * the first one blank — the Service Proposal bug documented in print-shell.tsx.
 * So the sheet groups flow, and only the individual ROW carries
 * `data-keep-together`: an item split across two pages puts its reference on
 * one and its text on the other, which makes it uncitable, which defeats the
 * register.
 *
 * ─── IT PRINTS THE MOMENT IT WAS BUILT ──────────────────────────────────────
 * Every age on the sheet is measured against `asOf`, and `asOf` is printed. A
 * register saying "42 days" with no date on it is a document that quietly
 * becomes wrong in the reader's hands.
 */
export default async function ReviewRegisterPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; assignee?: string }>;
}) {
  const t = await getServerT();
  const [{ projectId }, query] = await Promise.all([params, searchParams]);

  const wanted = (query.status ?? "OPEN").toUpperCase();
  const status: RegisterStatus | "ALL" =
    wanted === "ALL" || wanted === "RESOLVED" ? (wanted as RegisterStatus | "ALL") : "OPEN";

  const register = await projectReviewRegister(projectId, {
    status,
    assignedTo: query.assignee,
  });
  if (!register) notFound();

  const { totals } = register;
  const scope =
    status === "ALL" ? t("Every item") : status === "OPEN" ? t("Open items only") : t("Resolved items only");

  return (
    <CaPrintShell
      backHref={`/projects/${projectId}`}
      docTitle={t("Review Register")}
      refNumber={register.projectNumber ?? register.projectName}
      statusLabel={scope}
      title={fmt(t("Drawing review register — {project}"), { project: register.projectName })}
      meta={[
        { label: t("Open"), value: String(totals.open) },
        { label: t("Unassigned"), value: String(totals.unassigned) },
        { label: t("Sheets"), value: fmt(t("{count} of {total}"), { count: totals.sheetsWithItems, total: totals.sheets }) },
        { label: t("As at"), value: militaryDate(register.asOf.slice(0, 10)) },
      ]}
      signatures={[
        { role: t("Reviewed by"), name: "" },
        { role: t("Actioned by"), name: "" },
        { role: t("Closed out by"), name: "" },
      ]}
    >
      <p className="mt-2 text-[11px] text-gray-600">{registerSummary(totals)}</p>

      {totals.byAssignee.length > 0 ? (
        <PrintSection title={t("Open items by person")}>
          {/* Short and fixed-length: worth holding together. */}
          <table className="w-full border-collapse text-[10.5px]" data-keep-together>
            <tbody>
              {totals.byAssignee.map((a) => (
                <tr key={a.name} className="border-b border-gray-200 last:border-0">
                  <td className="py-1 pr-2 text-gray-900">{a.name}</td>
                  <td className="w-16 py-1 text-right font-medium text-gray-900">{a.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      ) : null}

      {register.groups.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">
          {t("Nothing matches this filter. That is a result, not an error — the set has been reviewed and there is nothing outstanding on it.")}
        </p>
      ) : (
        register.groups.map((group) => (
          <PrintSection
            key={group.sheet.drawingId}
            title={`${group.sheet.sheetNumber} · ${group.sheet.title || t("Untitled sheet")} · ${fmt(t("Rev {rev}"), { rev: group.sheet.revision })}`}
          >
            {group.items.length === 0 ? (
              <p className="text-[10.5px] text-gray-500">
                {group.unlabelledMarkups === 1
                  ? t("1 redline with no note. Nothing written to action.")
                  : fmt(t("{count} redlines with no note. Nothing written to action."), { count: group.unlabelledMarkups })}
              </p>
            ) : (
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="border-b border-gray-300 text-left text-gray-500">
                    <th className="w-20 py-1 pr-2 font-medium">{t("Ref")}</th>
                    <th className="w-10 py-1 px-2 text-center font-medium">{t("Pg")}</th>
                    <th className="py-1 px-2 font-medium">{t("Item")}</th>
                    <th className="w-28 py-1 px-2 font-medium">{t("Raised by")}</th>
                    <th className="w-28 py-1 px-2 font-medium">{t("With")}</th>
                    <th className="w-14 py-1 px-2 text-right font-medium">{t("Days")}</th>
                    <th className="w-20 py-1 pl-2 font-medium">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    // Atomic: a reference on one page and its text on the next
                    // is an item nobody can cite.
                    <tr
                      key={item.id}
                      data-keep-together
                      className="break-inside-avoid border-b border-gray-200 align-top last:border-0"
                    >
                      <td className="py-1 pr-2 font-mono text-gray-900">{item.ref}</td>
                      <td className="py-1 px-2 text-center text-gray-600">{item.page}</td>
                      <td className="py-1 px-2 text-gray-900">
                        {item.body}
                        {item.kind === "MARKUP" ? (
                          <span className="text-gray-500"> ({t("redline")})</span>
                        ) : null}
                      </td>
                      <td className="py-1 px-2 text-gray-600">{item.authorName}</td>
                      <td className="py-1 px-2 text-gray-600">
                        {item.assignedToName?.trim() || "—"}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-600">
                        {item.ageDays}
                      </td>
                      <td className="py-1 pl-2 text-gray-600">
                        {item.status === "RESOLVED"
                          ? `${t("Resolved")}${item.resolvedByName ? ` · ${item.resolvedByName}` : ""}`
                          : t("Open")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {group.items.length > 0 && group.unlabelledMarkups > 0 ? (
              <p className="mt-1 text-[10px] text-gray-500">
                {group.unlabelledMarkups === 1
                  ? t("Plus 1 redline with no note.")
                  : fmt(t("Plus {count} redlines with no note."), { count: group.unlabelledMarkups })}
              </p>
            ) : null}
          </PrintSection>
        ))
      )}

      <p className="mt-6 text-[10px] text-gray-500">
        {fmt(
          t("References are numbered per sheet in the order items were raised and do not change when the register is filtered — {ref} is {ref} on every copy. Ages are measured to {date}."),
          { ref: "A-101/3", date: militaryDate(register.asOf.slice(0, 10)) },
        )}
      </p>
    </CaPrintShell>
  );
}
