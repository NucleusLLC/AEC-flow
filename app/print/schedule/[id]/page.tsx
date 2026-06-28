import { notFound } from "next/navigation";
import { getSchedule } from "@/lib/data/schedule-db";
import { SchedulePrint } from "@/components/schedule/schedule-print";
import { getPracticeSettings } from "@/lib/server/practice-config";

export const metadata = { title: "Schedule — Print" };

export default async function SchedulePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schedule = await getSchedule(id);
  if (!schedule) notFound();
  const { logoDataUrl, logo } = await getPracticeSettings();

  const generatedAt = new Date().toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return <SchedulePrint schedule={schedule} generatedAt={generatedAt} logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }} />;
}
