import { notFound } from "next/navigation";
import { SetupForm } from "@/components/development/setup-form";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }> };

export default async function DevelopmentSetupPage({ params }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  return <SetupForm project={project} />;
}
