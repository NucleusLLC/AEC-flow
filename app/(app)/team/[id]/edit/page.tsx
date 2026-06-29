import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MemberForm, type MemberFormValues } from "@/components/team/member-form";
import { getTeamMember } from "@/lib/data/team";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await getTeamMember(id);
  return { title: member ? `Edit ${member.name} · AEC-flow` : "Edit Member · AEC-flow" };
}

export default async function EditMemberPage({ params }: PageProps) {
  const { id } = await params;
  const member = await getTeamMember(id);
  if (!member) notFound();

  const initial: MemberFormValues = {
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone ?? "",
    role: member.role,
    discipline: member.discipline ?? "",
    department: member.department,
    status: member.status,
    capacity: member.capacity,
    officeLocation: member.officeLocation ?? "",
    joiningDate: member.joiningDate ?? "",
    utilisation: member.utilisation,
    bio: member.bio,
    skills: member.skills.join(", "),
    annualLeaveTotal: member.annualLeaveTotal,
    annualLeaveTaken: member.annualLeaveTaken,
  };

  const backHref = `/team/${member.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {member.name}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Edit Team Member</h2>
        <p className="text-sm text-muted">Update {member.name}&rsquo;s details in the studio directory.</p>
      </div>

      <MemberForm mode="edit" initial={initial} />
    </div>
  );
}
