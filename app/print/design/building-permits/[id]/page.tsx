import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getBuildingPermit } from "@/lib/data/building-permits";
import { lapsedMonths, militaryDate, permitVersion, ymd } from "@/lib/building-permits/register";
import {
  APPROVAL_STAGE_LABEL,
  DOCUMENT_CATEGORY_LABEL,
  APPROVAL_STATUS_LABEL,
  CORRESPONDENCE_DIRECTION_LABEL,
  PERMIT_STATUS_LABEL,
  PERMIT_TYPE_LABEL,
  SUBMISSION_METHOD_LABEL,
} from "@/lib/building-permits/types";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Building Permit File")} · ${t("Print")}` };
}

/**
 * One permit file on paper: the dates, every version, every letter, the staged
 * approvals and the meetings — the answer to "what exactly did we send, and
 * when?", which is a question asked after a dispute rather than before one.
 *
 * A PDF cannot travel on paper, so a letter that has one is marked "PDF on
 * file"; the file itself stays in the private bucket.
 */
export default async function BuildingPermitFilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const permit = await getBuildingPermit(id);
  if (!permit) notFound();

  const today = ymd(new Date());
  const t = await getServerT();
  const version = permitVersion(permit);
  const lapsed = lapsedMonths(permit, today);
  // A letter's PDF is printed with its letter; these are the loose files.
  const looseFiles = permit.documents.filter((d) => !d.correspondenceId);

  return (
    <CaPrintShell
      backHref={`/design/building-permits/${permit.id}`}
      docTitle={t("Building Permit File")}
      refNumber={permit.permitNumber ?? permit.reference}
      statusLabel={t(PERMIT_STATUS_LABEL[permit.status])}
      title={permit.title}
      meta={[
        { label: t("Building permit #"), value: permit.permitNumber ?? t("Not yet issued") },
        { label: t("Version #"), value: version ? `V${version.version}` : "—" },
        { label: t("Submittal date"), value: militaryDate(permit.submittedAt) },
        {
          // The label follows the value: a sheet that says "Permit ready date:
          // 6.4 months lapsed" reads as a date nobody can parse.
          label: permit.issuedAt ? t("Permit ready date") : t("Lapsed (months)"),
          value: permit.issuedAt
            ? militaryDate(permit.issuedAt)
            : lapsed
              ? lapsed.running ? fmt(t("{months} (running)"), { months: lapsed.months.toFixed(1) }) : lapsed.months.toFixed(1)
              : "—",
        },
      ]}
      signatures={[
        { role: t("Prepared by"), name: permit.responsibleName ?? "" },
        { role: t("Checked by"), name: "" },
        { role: t("Authority"), name: permit.authorityContact ?? "" },
      ]}
    >
      <PrintSection title={t("The file")}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10.5px]">
          <Fact label={t("Our reference")} value={permit.reference} mono />
          <Fact label={t("Type")} value={t(PERMIT_TYPE_LABEL[permit.permitType])} />
          <Fact label={t("Authority")} value={permit.authority} />
          <Fact label={t("Applicant")} value={permit.applicantName} />
          <Fact label={t("Site address")} value={permit.siteAddress} />
          <Fact label={t("Parcel")} value={permit.parcelNumber} mono />
          <Fact label={t("Project")} value={permit.projectName} />
          <Fact label={t("Acknowledged")} value={militaryDate(permit.acknowledgedAt)} mono />
          <Fact label={t("Concept approval")} value={militaryDate(permit.conceptApprovalAt)} mono />
          <Fact label={t("Concept approval ref.")} value={permit.conceptApprovalRef} mono />
          <Fact label={t("Decision")} value={militaryDate(permit.decisionAt)} mono />
          <Fact label={t("Expires")} value={militaryDate(permit.expiresAt)} mono />
          <Fact
            label={t("Lapsed (months)")}
            value={lapsed ? (lapsed.running ? fmt(t("{months} (running)"), { months: lapsed.months.toFixed(1) }) : lapsed.months.toFixed(1)) : "—"}
            mono
          />
          <Fact label={t("Target decision")} value={militaryDate(permit.targetDecisionAt)} mono />
          <Fact label={t("Revision due")} value={militaryDate(permit.revisionDueAt)} mono />
        </dl>
        {permit.description ? (
          <p className="mt-3 whitespace-pre-line text-[10.5px] text-gray-800">
            {permit.description}
          </p>
        ) : null}
      </PrintSection>

      <PrintSection title={t("Versions")}>
        {permit.submissions.length === 0 ? (
          <Empty>{t("No version logged.")}</Empty>
        ) : (
          <Table head={[t("Version #"), t("Submittal date"), t("Method"), t("Receipt #"), t("Received by"), t("What went in")]}>
            {permit.submissions.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-200 align-top">
                <Cell mono>V{i + 1}</Cell>
                <Cell mono>{militaryDate(s.submittedAt)}</Cell>
                <Cell>{t(SUBMISSION_METHOD_LABEL[s.method])}</Cell>
                <Cell mono>{s.receiptNumber ?? "—"}</Cell>
                <Cell>{s.receivedBy ?? "—"}</Cell>
                <Cell>{s.contents ?? "—"}</Cell>
              </tr>
            ))}
          </Table>
        )}
      </PrintSection>

      <PrintSection title={t("Correspondence")}>
        {permit.correspondence.length === 0 ? (
          <Empty>{t("No letters on this file.")}</Empty>
        ) : (
          <Table head={[t("Date"), t("Direction"), t("Ref."), t("Party"), t("Subject"), t("Reply"), t("File")]}>
            {permit.correspondence.map((l) => (
              <tr key={l.id} className="border-b border-gray-200 align-top">
                <Cell mono>{militaryDate(l.letterDate ?? l.receivedAt)}</Cell>
                <Cell>{t(CORRESPONDENCE_DIRECTION_LABEL[l.direction])}</Cell>
                <Cell mono>{l.letterRef ?? "—"}</Cell>
                <Cell>{l.party ?? "—"}</Cell>
                <Cell>
                  {l.subject}
                  {l.summary ? (
                    <div className="text-[9px] text-gray-500">{l.summary}</div>
                  ) : null}
                </Cell>
                <Cell mono>
                  {l.respondedAt
                    ? fmt(t("Answered {date}"), { date: militaryDate(l.respondedAt) })
                    : l.requiresResponse
                      ? fmt(t("Due {date}"), { date: militaryDate(l.responseDueAt) })
                      : "—"}
                </Cell>
                <Cell>{l.pdf ? t("PDF on file") : "—"}</Cell>
              </tr>
            ))}
          </Table>
        )}
      </PrintSection>

      {permit.approvals.length > 0 ? (
        <PrintSection title={t("Approvals")}>
          <Table head={[t("Stage"), t("Status"), t("Decided"), t("Ref."), t("Valid until"), t("Conditions")]}>
            {permit.approvals.map((a) => (
              <tr key={a.id} className="border-b border-gray-200 align-top">
                <Cell>{t(APPROVAL_STAGE_LABEL[a.stage])}</Cell>
                <Cell>{t(APPROVAL_STATUS_LABEL[a.status])}</Cell>
                <Cell mono>{militaryDate(a.decidedAt)}</Cell>
                <Cell mono>{a.refNumber ?? "—"}</Cell>
                <Cell mono>{militaryDate(a.validUntil)}</Cell>
                <Cell>{a.conditions ?? "—"}</Cell>
              </tr>
            ))}
          </Table>
        </PrintSection>
      ) : null}

      {permit.meetings.length > 0 ? (
        <PrintSection title={t("Meetings")}>
          {permit.meetings.map((m) => (
            <div key={m.id} className="mt-2 break-inside-avoid text-[10.5px]">
              <div className="font-semibold text-gray-900">
                <span className="font-mono">{militaryDate(m.heldAt)}</span> · {m.subject}
                {m.location ? <span className="font-normal text-gray-500"> · {m.location}</span> : null}
              </div>
              {m.attendees ? <div className="text-[9px] text-gray-500">{m.attendees}</div> : null}
              {m.minutes ? (
                <p className="mt-0.5 whitespace-pre-line text-gray-800">{m.minutes}</p>
              ) : null}
              {m.decisions ? (
                <p className="mt-0.5 whitespace-pre-line text-gray-800">
                  <span className="text-gray-500">{t("Decisions:")} </span>
                  {m.decisions}
                </p>
              ) : null}
            </div>
          ))}
        </PrintSection>
      ) : null}

      {looseFiles.length > 0 ? (
        <PrintSection title={t("Files on the case")}>
          <Table head={[t("Name"), t("Category"), t("Date"), t("Where it is")]}>
            {looseFiles.map((d) => (
              <tr key={d.id} className="border-b border-gray-200 align-top">
                <Cell>{d.name}</Cell>
                <Cell>{t(DOCUMENT_CATEGORY_LABEL[d.category])}</Cell>
                <Cell mono>{militaryDate(d.documentDate)}</Cell>
                {/* A file cannot travel on paper: say where it is instead. */}
                <Cell>{d.storageKey ? (d.filename ?? t("In the case file")) : (d.externalUrl ?? "—")}</Cell>
              </tr>
            ))}
          </Table>
        </PrintSection>
      ) : null}

      {permit.notes ? (
        <PrintSection title={t("Notes")}>
          <p className="whitespace-pre-line text-[10.5px] text-gray-800">{permit.notes}</p>
        </PrintSection>
      ) : null}
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
