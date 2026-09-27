import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { getProjects } from "@/lib/data/projects";
import { getTeam } from "@/lib/data/team";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("New minutes")} · AEC-flow` };
}

export default async function NewMeetingPage() {
  const [projects, team] = await Promise.all([getProjects(), getTeam()]);
  const t = await getServerT();
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    projectNumber: p.projectNumber,
  }));
  const users = team.map((u) => ({ name: u.name }));

  return (
    <div className="w-full space-y-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Meeting Minutes")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New minutes")}</h2>
        <p className="text-sm text-muted">
          {t("Record a meeting with participants, decisions, and follow-up actions.")}
        </p>
      </div>
      <MeetingForm mode="new" projects={projectOptions} users={users} backHref="/meetings" />
    </div>
  );
}
