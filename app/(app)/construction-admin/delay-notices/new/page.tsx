import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DelayNoticeForm } from "@/components/construction-admin/delay-notice-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Delay Notice · AEC-flow" };

export default async function NewDelayNoticePage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/construction-admin/delay-notices" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Delay Notices
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Delay Notice</h2>
        <p className="text-sm text-muted">Record a notice of delay; it is saved through the API and added to the register.</p>
      </div>
      <DelayNoticeForm projects={options} />
    </div>
  );
}
