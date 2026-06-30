import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  LeaveRequestForm,
  type LeaveFormInitial,
} from "@/components/leave/leave-request-form";
import { getLeaveRequest } from "@/lib/data/leave";
import { getTeam } from "@/lib/data/team";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const request = await getLeaveRequest(id);
  return {
    title: request ? `Edit ${request.userName}'s Leave · AEC-flow` : "Edit Leave · AEC-flow",
  };
}

export default async function EditLeavePage({ params }: PageProps) {
  const { id } = await params;
  const [request, team] = await Promise.all([getLeaveRequest(id), getTeam()]);
  if (!request) notFound();

  const members = team.map((m) => m.name);

  const initial: LeaveFormInitial = {
    id: request.id,
    userName: request.userName,
    type: request.type,
    status: request.status,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason ?? "",
  };

  return (
    <div className="w-full space-y-6">
      <Link
        href="/leave"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Leave
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Edit Leave Request</h2>
        <p className="text-sm text-muted">
          {request.userName} · {request.startDate} → {request.endDate}
        </p>
      </div>

      <LeaveRequestForm members={members} mode="edit" initial={initial} />
    </div>
  );
}
