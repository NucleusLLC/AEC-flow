import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { PermitSynopsisBlock } from "@/components/building-permits/permit-synopsis";
import { getBuildingPermit } from "@/lib/data/building-permits";
import { militaryDate, permitVersion, ymd } from "@/lib/building-permits/register";
import {
  PROCESS_EVENT_LABEL,
  processSummary,
  type ProcessEvent,
} from "@/lib/building-permits/process-summary";
import { PERMIT_STATUS_LABEL } from "@/lib/building-permits/types";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Permit Process Summary")} · ${t("Print")}` };
}

/**
 * The permit Process Summary: a SITREP on one A4 file, written the military
 * way — synopsis first (AI, on request), then the situation in figures, the
 * actions still open, and one numbered chronology of every version, meeting,
 * letter in and out, approval and milestone.
 *
 * The full file print (../page.tsx) is the record; this is the briefing.
 */
export default async function PermitProcessSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const permit = await getBuildingPermit(id);
  if (!permit) notFound();

  const today = ymd(new Date());
  const t = await getServerT();
  const { facts, timeline, openActions } = processSummary(permit, today);
  const version = permitVersion(permit);
  /** Slot values are English labels (translated) or numbers. */
  const tv = (vars: Record<string, string | number>) =>
    Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));
  const eventText = (e: ProcessEvent) => fmt(t(e.what), tv(e.vars));

  return (
    <CaPrintShell
      backHref={`/design/building-permits/${permit.id}`}
      docTitle={t("Permit Process Summary")}
      refNumber={permit.permitNumber ?? permit.reference}
      statusLabel={t(PERMIT_STATUS_LABEL[permit.status])}
      title={permit.title}
      meta={[
        { label: t("As of"), value: militaryDate(today) },
        { label: t("Version #"), value: version ? `V${version.version}` : "—" },
        { label: t("Authority"), value: permit.authority ?? "—" },
        {
          label: t("Days in process"),
          value: facts.daysInProcess === null ? "—" : String(facts.daysInProcess),
        },
      ]}
      signatures={[
        { role: t("Prepared by"), name: permit.responsibleName ?? "" },
        { role: t("Reviewed by"), name: "" },
      ]}
    >
      <PermitSynopsisBlock permitId={permit.id} />

      <PrintSection title={`1. ${t("Situation")}`}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10.5px]">
          <Fact label={t("Status")} value={t(PERMIT_STATUS_LABEL[permit.status])} />
          <Fact label={t("Our reference")} value={permit.reference} mono />
          <Fact label={t("Building permit #")} value={permit.permitNumber ?? t("Not yet issued")} mono />
          <Fact label={t("Site address")} value={permit.siteAddress} />
          <Fact label={t("Submittal date")} value={militaryDate(permit.submittedAt)} mono />
          <Fact label={t("Target decision")} value={militaryDate(permit.targetDecisionAt)} mono />
          <Fact label={t("Revisions submitted")} value={String(Math.max(0, facts.versions - 1))} mono />
          <Fact label={t("Meetings")} value={String(facts.meetings)} mono />
          <Fact label={t("Letters received")} value={String(facts.lettersIn)} mono />
          <Fact label={t("Letters sent")} value={String(facts.lettersOut)} mono />
          <Fact
            label={t("Approvals decided / pending")}
            value={`${facts.approvalsDecided} / ${facts.approvalsPending}`}
            mono
          />
          <Fact
            label={t("Last event")}
            value={facts.lastEvent ? `${militaryDate(facts.lastEvent.date)} — ${eventText(facts.lastEvent)}` : null}
          />
        </dl>
      </PrintSection>

      <PrintSection title={`2. ${t("Actions open")}`}>
        {openActions.length === 0 ? (
          <Empty>{t("Nothing is owed on this file.")}</Empty>
        ) : (
          <ol className="space-y-0.5 text-[10.5px]">
            {openActions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-7 shrink-0 font-mono text-gray-500">2{String.fromCharCode(97 + i)}.</span>
                <span className="flex-1 text-gray-900">{fmt(t(a.what), tv(a.vars))}</span>
                {a.dueAt ? (
                  <span className={`shrink-0 font-mono ${a.overdue ? "font-semibold text-red-700" : "text-gray-600"}`}>
                    {a.overdue ? t("OVERDUE") : t("Due")} {militaryDate(a.dueAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </PrintSection>

      <PrintSection title={`3. ${t("Chronology")}`}>
        {timeline.length === 0 ? (
          <Empty>{t("No dated events on this file yet.")}</Empty>
        ) : (
          <Table head={[t("Ser."), t("Date"), t("Event"), t("Detail")]}>
            {timeline.map((e, i) => (
              <tr key={i} className="border-b border-gray-200 align-top">
                <Cell mono>{i + 1}</Cell>
                <Cell mono>{militaryDate(e.date)}</Cell>
                <Cell>
                  <span className="font-medium">{t(PROCESS_EVENT_LABEL[e.kind])}</span>
                  <span className="block text-gray-600">{eventText(e)}</span>
                </Cell>
                <Cell>{e.detail ?? "—"}</Cell>
              </tr>
            ))}
          </Table>
        )}
      </PrintSection>

      <PrintSection title={`4. ${t("Meetings")}`}>
        {permit.meetings.length === 0 ? (
          <Empty>{t("No meetings logged.")}</Empty>
        ) : (
          <Table head={[t("Date"), t("Subject"), t("Decisions"), t("Follow-up")]}>
            {[...permit.meetings]
              .sort((a, b) => a.heldAt.localeCompare(b.heldAt))
              .map((m) => (
                <tr key={m.id} className="border-b border-gray-200 align-top">
                  <Cell mono>{militaryDate(m.heldAt)}</Cell>
                  <Cell>{m.subject}</Cell>
                  <Cell>{m.decisions ?? "—"}</Cell>
                  <Cell>{m.followUp ?? "—"}</Cell>
                </tr>
              ))}
          </Table>
        )}
      </PrintSection>

      <PrintSection title={`5. ${t("Correspondence")}`}>
        {permit.correspondence.length === 0 ? (
          <Empty>{t("No letters on this file.")}</Empty>
        ) : (
          <Table head={[t("Date"), t("In / out"), t("Ref."), t("Party"), t("Subject"), t("Reply")]}>
            {[...permit.correspondence]
              .sort((a, b) => (a.letterDate ?? a.receivedAt ?? "").localeCompare(b.letterDate ?? b.receivedAt ?? ""))
              .map((l) => (
                <tr key={l.id} className="border-b border-gray-200 align-top">
                  <Cell mono>{militaryDate(l.letterDate ?? l.receivedAt)}</Cell>
                  <Cell mono>{l.direction === "INCOMING" ? t("IN") : t("OUT")}</Cell>
                  <Cell mono>{l.letterRef ?? "—"}</Cell>
                  <Cell>{l.party ?? "—"}</Cell>
                  <Cell>{l.subject}</Cell>
                  <Cell mono>
                    {l.respondedAt
                      ? fmt(t("Answered {date}"), { date: militaryDate(l.respondedAt) })
                      : l.requiresResponse
                        ? fmt(t("Due {date}"), { date: militaryDate(l.responseDueAt) })
                        : "—"}
                  </Cell>
                </tr>
              ))}
          </Table>
        )}
      </PrintSection>
    </CaPrintShell>
  );
}

function Fact({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 pb-0.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right text-gray-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b border-gray-300 text-left text-gray-500">
          {head.map((h) => (
            <th key={h} className="py-1 pr-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Cell({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`py-1 pr-2 text-gray-800 ${mono ? "font-mono" : ""}`}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] text-gray-500">{children}</p>;
}
