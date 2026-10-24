import { redirect } from "next/navigation";
import { isCurrentUserFounder } from "@/lib/server/founder";
import { listCompaniesForAdmin } from "@/lib/server/admin";
import { AdminCompanies } from "@/components/admin/admin-companies";
import { SampleFilesPanel } from "@/components/admin/sample-files-panel";
import { listSampleSetCompanies } from "@/lib/samples/admin";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isCurrentUserFounder())) redirect("/dashboard");
  const companies = await listCompaniesForAdmin();
  // Founder-gated again inside; an empty list for anyone else.
  const sampleCompanies = await listSampleSetCompanies();
  const t = await getServerT();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Companies & licenses")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("Every tenant on AEC-flow. Edit a company’s plan, seats, and access window.")}
        </p>
      </div>
      <AdminCompanies companies={companies} />
      <SampleFilesPanel companies={sampleCompanies} />
    </div>
  );
}
