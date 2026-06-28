import { notFound } from "next/navigation";
import { Calculator } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { ProjectSectionPanel } from "@/components/projects/section-panel";

export default async function ProjectEstimatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProject(id))) notFound();
  return (
    <ProjectSectionPanel
      icon={<Calculator className="h-6 w-6" />}
      title="Estimates"
      description="Cost estimates, take-offs and priced line items feeding the project budget."
      moduleLabel="Estimates"
      href="/estimates"
    />
  );
}
