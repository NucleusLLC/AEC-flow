import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CertForm } from "@/components/construction-admin/cert-form";
import { getProjects } from "@/lib/data/projects";
import { getCertification } from "@/lib/data/ca/certifications";

export const metadata: Metadata = { title: "Edit Certification · AEC-flow" };

export default async function EditCertificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cert, projects] = await Promise.all([getCertification(id), getProjects()]);
  if (!cert) notFound();
  const options = projects.map((p) => ({ id: p.id, name: p.name, value: p.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={`/construction-admin/certifications/${cert.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {cert.certificationNumber}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit Progress Certification</h2>
        <p className="text-sm text-muted">Correct the certification — the payment recommendation recalculates live and saves through the API.</p>
      </div>
      <CertForm projects={options} initial={cert} certId={cert.id} />
    </div>
  );
}
