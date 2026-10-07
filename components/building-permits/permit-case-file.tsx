"use client";

/**
 * The live half of a permit case file: the four numbers, the DEADLINES, the
 * versions log, the letters, the staged approvals, the meeting minutes and the loose files.
 *
 * WHY THIS COMPONENT OWNS THE DATA. Everything here changes as the user works,
 * and `router.refresh()` after a write does not reliably repaint this page —
 * measured: a saved letter stayed invisible until a reload, while the row was
 * already in the database. A list that does not show what was just saved reads
 * as a failed save, so this component re-reads the file through
 * `permitSnapshotAction` after every write and renders what comes back. The
 * server page still provides the first render (no loading flash, no waterfall).
 *
 * The four numbers are computed with the same pure functions as the register, so
 * the case file and the list cannot disagree.
 */

import { useCallback, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { PermitApprovals } from "@/components/building-permits/permit-approvals";
import { PermitDeadlines } from "@/components/building-permits/permit-deadlines";
import { PermitCorrespondence } from "@/components/building-permits/permit-correspondence";
import { PermitDocuments } from "@/components/building-permits/permit-documents";
import { PermitMeetings } from "@/components/building-permits/permit-meetings";
import { PermitVersions } from "@/components/building-permits/permit-versions";
import { lapsedMonths, militaryDate, permitVersion } from "@/lib/building-permits/register";
import type { BuildingPermitDTO } from "@/lib/building-permits/types";
import { permitSnapshotAction } from "@/app/(app)/design/building-permits/actions";
import { useT } from "@/components/i18n/language-provider";

export function PermitCaseFile({
  initial,
  today,
}: {
  initial: BuildingPermitDTO;
  today: string;
}) {
  const t = useT();
  const [permit, setPermit] = useState(initial);
  const [staleError, setStaleError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await permitSnapshotAction(permit.id);
    if (res.ok) {
      setPermit(res.permit);
      setStaleError(null);
    } else {
      // The write itself already succeeded; say what is actually wrong rather
      // than leaving a stale screen that looks like nothing happened.
      setStaleError(`${t(res.error)} ${t("Reload the page to see the current file.")}`);
    }
  }, [permit.id, t]);

  const version = permitVersion(permit);
  const lapsed = lapsedMonths(permit, today);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("Version #")} value={version ? `V${version.version}` : "—"} />
        <Stat label={t("Submittal date")} value={militaryDate(permit.submittedAt)} />
        <Stat
          label={t("Lapsed (months)")}
          value={lapsed ? lapsed.months.toFixed(1) : "—"}
          note={lapsed ? (lapsed.running ? t("running") : t("final")) : undefined}
        />
        <Stat
          label={t("Permit ready date")}
          value={militaryDate(permit.issuedAt)}
          tone={permit.issuedAt ? "green" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* The message carries a signed-in link to the printed file, not an
          * attachment — see the note in components/email/email-button.tsx. */}
        <EmailButton
          subject={`Building permit ${permit.permitNumber ?? permit.reference} — ${permit.title}`}
          attachment={`${permit.permitNumber ?? permit.reference} — Permit file`}
          label={t("Email this file")}
          relatedType="building-permit"
          relatedId={permit.id}
          linkPath={`/print/design/building-permits/${permit.id}`}
          defaultBody={[
            `Building permit ${permit.permitNumber ?? "(number not yet issued)"} — ${permit.title}.`,
            version ? `Version V${version.version}, submitted ${militaryDate(permit.submittedAt)}.` : null,
            lapsed
              ? `${lapsed.months.toFixed(1)} months lapsed${lapsed.running ? " and counting" : ""}.`
              : null,
            permit.issuedAt ? `Permit ready ${militaryDate(permit.issuedAt)}.` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>

      {staleError ? <p className="text-sm text-red-600">{staleError}</p> : null}

      <PermitDeadlines
        permitId={permit.id}
        deadlines={permit.deadlines}
        today={today}
        onChanged={reload}
      />

      <Card>
        <CardHeader
          title={t("Versions")}
          subtitle={t("V1 is the first submittal; each resubmission is the next version.")}
        />
        <CardBody>
          <PermitVersions
            permitId={permit.id}
            submissions={permit.submissions}
            today={today}
            onChanged={reload}
          />
        </CardBody>
      </Card>

      <div id="correspondence" className="scroll-mt-6">
        <Card>
          <CardHeader
            title={t("Correspondence")}
            subtitle={t("Every letter to and from the authority, with its PDF.")}
          />
          <CardBody>
            <PermitCorrespondence
              permitId={permit.id}
              letters={permit.correspondence}
              today={today}
              onChanged={reload}
            />
          </CardBody>
        </Card>
      </div>
      <div id="approvals" className="scroll-mt-6">
        <Card>
          <CardHeader
            title={t("Approvals")}
            subtitle={t("Concept first, then the stages the authority signs off one at a time.")}
          />
          <CardBody>
            <PermitApprovals
              permitId={permit.id}
              approvals={permit.approvals}
              today={today}
              onChanged={reload}
            />
          </CardBody>
        </Card>
      </div>

      <div id="meetings" className="scroll-mt-6">
        <Card>
          <CardHeader
            title={t("Meetings")}
            subtitle={t("Minutes of meetings about this permit — not the client meeting register.")}
          />
          <CardBody>
            <PermitMeetings
              permitId={permit.id}
              meetings={permit.meetings}
              today={today}
              onChanged={reload}
            />
          </CardBody>
        </Card>
      </div>

      <div id="documents" className="scroll-mt-6">
        <Card>
          <CardHeader
            title={t("Files")}
            subtitle={t("The stamped form, receipts, photos — anything on the case that is not a letter.")}
          />
          <CardBody>
            <PermitDocuments
              permitId={permit.id}
              documents={permit.documents}
              today={today}
              onChanged={reload}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("Case file")} />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts(permit).map((f) => (
            <div
              key={f.label}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm"
            >
              <span className="text-muted">{t(f.label)}</span>
              <span className={`text-right text-fg ${f.mono ? "font-mono text-xs" : ""}`}>
                {f.value}
              </span>
            </div>
          ))}
          {permit.description ? (
            <p className="whitespace-pre-line text-sm text-fg sm:col-span-2">{permit.description}</p>
          ) : null}
          {permit.notes ? (
            <p className="whitespace-pre-line text-sm text-muted sm:col-span-2">{permit.notes}</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * The file's own fields. Here rather than on the server page because some of
 * them are written by the sections above — recording a decided concept approval
 * fills in the file's concept approval date — and a fact card that only updates
 * on reload contradicts the table that just changed it.
 */
function facts(permit: BuildingPermitDTO): { label: string; value: string; mono?: boolean }[] {
  return [
    { label: "Authority", value: permit.authority ?? "—" },
    { label: "Applicant", value: permit.applicantName ?? "—" },
    { label: "Site address", value: permit.siteAddress ?? "—" },
    { label: "Parcel", value: permit.parcelNumber ?? "—", mono: true },
    { label: "Project", value: permit.projectName ?? "—" },
    { label: "Concept approval", value: militaryDate(permit.conceptApprovalAt), mono: true },
    { label: "Concept approval ref.", value: permit.conceptApprovalRef ?? "—", mono: true },
    { label: "Target decision", value: militaryDate(permit.targetDecisionAt), mono: true },
    { label: "Revision due", value: militaryDate(permit.revisionDueAt), mono: true },
    { label: "Expires", value: militaryDate(permit.expiresAt), mono: true },
  ];
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "green";
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div
          className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
            tone === "green" ? "text-green-700 dark:text-green-400" : "text-fg"
          }`}
        >
          {value}
        </div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
