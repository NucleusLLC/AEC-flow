"use client";

/**
 * The live half of a permit case file: the four numbers, the versions log and
 * the letters.
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
import { PermitCorrespondence } from "@/components/building-permits/permit-correspondence";
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
    </div>
  );
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
