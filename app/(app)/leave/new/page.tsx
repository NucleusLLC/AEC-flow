import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { getTeam } from "@/lib/data/team";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Request Leave · AEC-flow" };

export default async function NewLeavePage() {
  const team = await getTeam();
  const t = await getServerT();
  const members = team.map((m) => m.name);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/leave"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Leave")}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Request Leave")}</h2>
        <p className="text-sm text-muted">{t("Submit a leave request for approval.")}</p>
      </div>

      <LeaveRequestForm members={members} />
    </div>
  );
}
