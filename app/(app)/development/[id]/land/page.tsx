import { notFound } from "next/navigation";
import { LandCalculator } from "@/components/development/land-calculator";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

const EMPTY_LAND = {
  grossParcelArea: 0, roadArea: 0, sidewalkArea: 0, greenArea: 0, utilityArea: 0,
  drainageArea: 0, commonArea: 0, poolDeckArea: 0, retainedOwnerArea: 0,
  otherNonSellableArea: 0, requiredGreenPct: 0, requiredRoadPct: 0,
};
const EMPTY_ACQ = {
  parcelAcquisitionCost: 0, transferTax: 0, notaryCost: 0, kadasterCost: 0, brokerCommission: 0,
  dueDiligence: 0, appraisal: 0, topographicSurvey: 0, parcelingSurvey: 0, meetbrieven: 0,
  legalSetup: 0, companySetup: 0, taxAdvisor: 0, financingSetup: 0, bankGuarantee: 0, contingencyPct: 0,
};

export default async function DevelopmentLandPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const landUse = project.landUse ?? { id: "", projectId: project.id, ...EMPTY_LAND };
  const acquisition = project.acquisition ?? { id: "", projectId: project.id, ...EMPTY_ACQ };
  return (
    <LandCalculator projectId={project.id} landUse={landUse} acquisition={acquisition} currency={project.currency} lotCount={project.lots.length} />
  );
}
