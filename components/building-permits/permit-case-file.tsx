"use client";

/**
 * The live half of a permit case file: the four numbers, the versions log, the
 * letters, the staged approvals and the meeting minutes.
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
import { PermitApprovals } from "@/components/building-permits/permit-approvals";
import { PermitCorrespondence } from "@/components/building-permits/permit-correspondence";
import { PermitMeetings } from "@/components/building-permits/permit-meetings";
import { PermitVersions } from "@/components/building-permits/permit-versions";
import { lapsedMonths, militaryDate, permitVersion } from "@/lib/building-permits/register";
import type { BuildingPermitDTO } from "@/lib/building-permits/types";
import { permitSnapshotAction } from "@/app/(app)/design/building-permits/actions";

export function PermitCaseFile({
  initial,
  today,
}: {
  initial: BuildingPermitDTO;
  today: string;
}) {
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
      setStaleError(`${res.error} Reload the page to see the current file.`);
    }
  }, [permit.id]);

  const version = permitVersion(permit);
  const lapsed = lapsedMonths(permit, today);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Version #" value={version ? `V${version.version}` : "—"} />
        <Stat label="Submittal date" value={militaryDate(permit.submittedAt)} />
        <Stat
          label="Lapsed (months)"
          value={lapsed ? lapsed.months.toFixed(1) : "—"}
          note={lapsed ? (lapsed.running ? "running" : "final") : undefined}
        />
        <Stat
          label="Permit ready date"
          value={militaryDate(permit.issuedAt)}
          tone={permit.issuedAt ? "green" : undefined}
        />
      </div>

      {staleError ? <p className="text-sm text-red-600">{staleError}</p> : null}

      <Card>
        <CardHeader
          title="Versions"
          subtitle="V1 is the first submittal; each resubmission is the next version."
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
            title="Correspondence"
            subtitle="Every letter to and from the authority, with its PDF."
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
            title="Approvals"
            subtitle="Concept first, then the stages the authority signs off one at a time."
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
            title="Meetings"
            subtitle="Minutes of meetings about this permit — not the client meeting register."
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

      <Card>
        <CardHeader title="Case file" />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts(permit).map((f) => (
            <div
              key={f.label}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm"
            >
              <span className="text-muted">{f.label}</span>
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
