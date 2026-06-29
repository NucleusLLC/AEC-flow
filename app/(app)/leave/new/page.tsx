import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { getTeam } from "@/lib/data/team";

export const metadata = { title: "Request Leave · AEC-flow" };

export default async function NewLeavePage() {
  const team = await getTeam();
  const members = team.map((m) => m.name);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/leave"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Leave
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Request Leave</h2>
        <p className="text-sm text-muted">Submit a leave request for approval.</p>
      </div>

      <LeaveRequestForm members={members} />
    </div>
  );
}
