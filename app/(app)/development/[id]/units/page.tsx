import { notFound } from "next/navigation";
import { UnitCalculator } from "@/components/development/unit-calculator";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentUnitsPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <UnitCalculator projectId={project.id} unitTypes={project.unitTypes} currency={project.currency} />;
}
