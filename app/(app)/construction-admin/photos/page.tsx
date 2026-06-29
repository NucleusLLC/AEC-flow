import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { PhotoContactSheet } from "@/components/construction-admin/photo-contact-sheet";

export const metadata = { title: "Photos · AEC-flow" };

export default function PhotosPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Site Photos</h2>
        <p className="text-sm text-muted">
          Build a printable photo contact sheet — upload site photos, lay them out, and print to A4/A3 or save as PDF.
        </p>
      </div>
      <CaSubNav />
      <PhotoContactSheet />
    </div>
  );
}
