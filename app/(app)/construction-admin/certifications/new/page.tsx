import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CertForm } from "@/components/construction-admin/cert-form";
import { getProjects } from "@/lib/data/projects";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New Certification · AEC-flow" };

export default async function NewCertificationPage() {
  const t = await getServerT();
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name, value: p.value }));
  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/certifications" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Certifications")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New Progress Certification")}</h2>
        <p className="text-sm text-muted">{t("Certify percent complete; the payment recommendation calculates live and saves through the API.")}</p>
      </div>
      <CertForm projects={options} />
    </div>
  );
}
