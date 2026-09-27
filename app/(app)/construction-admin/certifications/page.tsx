import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { CertList } from "@/components/construction-admin/cert-list";
import { listCertifications } from "@/lib/data/ca/certifications";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Certifications · AEC-flow" };

export default async function CertificationsPage() {
  const t = await getServerT();
  const certifications = await listCertifications();
  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Progress Certifications & Bank Draws")}</h2>
          <p className="text-sm text-muted">{t("Voortgangsverklaring — certify percent complete and recommended payment.")}</p>
        </div>
        <Link href="/construction-admin/certifications/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          {t("New Certification")}
        </Link>
      </div>
      <CaSubNav />
      <CertList certifications={certifications} />
    </div>
  );
}
