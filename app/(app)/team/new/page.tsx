import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemberForm } from "@/components/team/member-form";

export const metadata = { title: "Add Member · AEC-flow" };

export default function NewMemberPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
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

      <MemberForm />
    </div>
  );
}
