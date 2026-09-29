import { notFound } from "next/navigation";
import { getSchedule } from "@/lib/data/schedule-db";
import { SchedulePrint } from "@/components/schedule/schedule-print";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getServerLocale, getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("Schedule")} — ${t("Print")}` };
}

export default async function SchedulePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schedule = await getSchedule(id);
  if (!schedule) notFound();
  const { logoDataUrl, logo, footer } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  const locale = await getServerLocale();

  const generatedAt = new Date().toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return <SchedulePrint schedule={schedule} generatedAt={generatedAt} logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }} companyName={companyName} footerText={footer.text} />;
}
