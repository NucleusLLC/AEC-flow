import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { TimesheetWeek } from "@/components/finance/timesheet-week";
import { TimeApprovals } from "@/components/finance/time-approvals";
import { RateTable } from "@/components/finance/rate-table";
import { listTimeEntries, listTimekeepers, listWeek } from "@/lib/data/time-entries";
import { getProjects } from "@/lib/data/projects";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { getSystemCurrency } from "@/lib/format";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Time · AEC-flow" };

/**
 * A week of hours.
 *
 * THE WEEK AND THE PERSON COME FROM THE URL, not from client state, so a saved
 * entry comes back from the server on the week it was saved on and a shared
 * link opens on what the sender was looking at.
 *
 * WHOSE hours is decided on the SERVER: `listWeek` ignores a `?user=` that the
 * caller is not entitled to and falls back to their own. A query string is not
 * a permission.
 */
export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; user?: string }>;
}) {
  const params = await searchParams;
  const today = ymd(new Date());
  const [actor, projects] = await Promise.all([requireActor(), getProjects()]);
  const canApprove = canManagePasswords(actor.role, actor.isFounder);

  const week = await listWeek(params.week ?? today, params.user);
  // `listTimekeepers` hands a non-approver only their own row — a colleague's
  // charge-out rate is not public — so this is safe to call for everybody.
  const [people, awaiting] = await Promise.all([
    listTimekeepers(),
    canApprove ? listTimeEntries({ status: "SUBMITTED" }) : Promise.resolve([]),
  ]);

  const person = people.find((p) => p.id === week.userId);
  const currency = getSystemCurrency();

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Time</h2>
        <p className="text-sm text-muted">
          The hours the practice works, what they are worth, and what is ready to be billed.
        </p>
      </div>

      {canApprove ? <TimeApprovals entries={awaiting} currency={currency} /> : null}

      <TimesheetWeek
        start={week.start}
        days={week.days}
        entries={week.entries}
        projects={projects.map((p) => ({ id: p.id, name: `${p.projectNumber} — ${p.name}` }))}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        personName={person?.name ?? actor.name}
        userId={week.userId}
        canLogForOthers={canApprove}
        currency={currency}
        today={today}
      />

      {person && person.chargeOutRate === null ? (
        <Card>
          <CardBody className="py-3 text-sm text-muted">
            No charge-out rate is set for {person.name}, so their hours are worth nothing on this
            screen. {canApprove ? "Set one below." : "Ask a director to set one."} A rate is copied
            onto each entry as it is saved, so it prices the next hour logged, not the ones already
            here.
          </CardBody>
        </Card>
      ) : null}

      {canApprove ? <RateTable people={people} currency={currency} /> : null}
    </div>
  );
}
