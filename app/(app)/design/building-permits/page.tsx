import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { listBuildingPermits, listPermitAuthorities } from "@/lib/data/building-permits";
import { ymd } from "@/lib/building-permits/register";
import { PermitRegister } from "@/components/building-permits/permit-register";
import { PermitRegisterTiles } from "@/components/building-permits/register-tiles";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Building Permits · AEC-flow" };
}

export default async function BuildingPermitRegisterPage() {
  const [permits, authorities] = await Promise.all([
    listBuildingPermits(),
    listPermitAuthorities(),
  ]);

  // Today as the practice's own calendar day. `ymd` is local-time on purpose:
  // an overdue reply is late because the office day has passed, not because a
  // UTC boundary has.
  const today = ymd(new Date());

  return (
    <div className="w-full space-y-6">
      <Link
        href="/design"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Design Register
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">Building Permits</h2>
          <p className="text-sm text-muted">
            One case file per application — submissions, meetings, letters and approvals.
          </p>
        </div>
        <Link
          href="/design/building-permits/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> New permit
        </Link>
      </div>

      {permits.length === 0 ? (
        // No tiles here: five zeros say nothing a sentence cannot say better.
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">The permit register is empty.</p>
            <p className="mt-1 text-sm text-muted">
              Open a case file the day an application is prepared, so the submission dates and
              letters land somewhere from the start.
            </p>
            <Link
              href="/design/building-permits/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> New permit
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          <PermitRegisterTiles permits={permits} today={today} />
          <PermitRegister permits={permits} authorities={authorities} today={today} />
        </>
      )}
    </div>
  );
}
