import { notFound } from "next/navigation";
import { ScenarioPlanner } from "@/components/development/scenario-planner";
import { getDevelopmentProject } from "@/lib/data/development";
import { computeLandUse, computeUnit, sum } from "@/lib/development/calc";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentScenariosPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();

  const netSellableLand = project.landUse
    ? computeLandUse({ ...project.landUse }).netSellableLand
    : 0;
  const unitCount = sum(project.unitTypes.map((u) => u.quantity)) || 1;
  const totalFloorArea = sum(project.unitTypes.map((u) => computeUnit(u).totalArea * u.quantity));
  const unitArea = totalFloorArea / unitCount;

  return (
    <ScenarioPlanner
      scenarios={project.scenarios}
      netSellableLand={netSellableLand}
      unitArea={unitArea}
      unitCount={unitCount}
      currency={project.currency}
    />
  );
}
