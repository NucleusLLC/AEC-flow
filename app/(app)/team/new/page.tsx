import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemberForm } from "@/components/team/member-form";
import { requireActor } from "@/lib/server/actor";
import { canChangeMemberAccess } from "@/lib/team/member-write-policy";

export const metadata = { title: "Add Member · AEC-flow" };

export default async function NewMemberPage() {
  const actor = await requireActor().catch(() => null);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Team
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Add Team Member</h2>
        <p className="text-sm text-muted">Add a new member to the studio directory.</p>
      </div>

      <MemberForm canChangeAccess={actor ? canChangeMemberAccess(actor) : false} />
    </div>
  );
}
