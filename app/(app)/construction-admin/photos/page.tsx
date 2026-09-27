import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { PhotoContactSheet } from "@/components/construction-admin/photo-contact-sheet";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Photos · AEC-flow" };

export default async function PhotosPage() {
  const t = await getServerT();
  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Site Photos")}</h2>
        <p className="text-sm text-muted">
          {t("Build a printable photo contact sheet — upload site photos, lay them out, and print to A4/A3 or save as PDF.")}
        </p>
      </div>
      <CaSubNav />
      <PhotoContactSheet />
    </div>
  );
}
