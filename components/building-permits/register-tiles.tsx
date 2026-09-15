/**
 * The register's summary tiles.
 *
 * No "use client": the numbers describe the whole register rather than the
 * filtered view, so they are settled on the server and never flicker while
 * someone types in the search box. Deliberate — a headline figure that moves
 * with a filter is a figure nobody can quote.
 */
import { Card, CardBody } from "@/components/ui/card";
import { registerTotals } from "@/lib/building-permits/register";
import type { BuildingPermitSummaryDTO } from "@/lib/building-permits/types";
import { BadgeCheck, FolderOpen, Hourglass, MailWarning, Stamp } from "lucide-react";

export function PermitRegisterTiles({
  permits,
  today,
}: {
  permits: BuildingPermitSummaryDTO[];
  today: string;
}) {
  const totals = registerTotals(permits, today);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Tile icon={FolderOpen} label="Open files" value={totals.open} />
      <Tile icon={Hourglass} label="Awaiting the authority" value={totals.awaitingAuthority} />
      <Tile icon={Stamp} label="Concept approved" value={totals.conceptApproved} />
      <Tile icon={BadgeCheck} label="Issued" value={totals.issued} />
      {/* The one tile that changes colour. It stays neutral at zero so the red
       * means something the day it appears. */}
      <Tile
        icon={MailWarning}
        label="Overdue replies"
        value={totals.overdueResponses}
        alert={totals.overdueResponses > 0}
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-red-200" : undefined}>
      <CardBody className="px-4 py-3.5">
        <div
          className={`flex items-center gap-2 text-xs font-medium ${
            alert ? "text-red-700" : "text-muted"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <div
          className={`mt-1.5 text-2xl font-semibold tabular-nums ${
            alert ? "text-red-700" : "text-fg"
          }`}
        >
          {value}
        </div>
      </CardBody>
    </Card>
  );
}
