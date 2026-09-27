import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnnotationStudio } from "@/components/drawings/annotation-studio";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Annotate · AEC-flow" };

export default async function AnnotatePage() {
  const t = await getServerT();
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Annotate drawing")}</h2>
          <p className="text-sm text-muted">
            {t("A scratch pad: drop an image, scribble on it, print it. Nothing here is saved.")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("To mark up a drawing that is on the register — with redlines that persist, are attributed, and can be replied to — open the sheet from Drawings and press Review.")}{" "}
            <Link href="/drawings" className="text-brand hover:underline">
              {t("Open Drawings")}
            </Link>
          </p>
        </div>
        <Link
          href="/drawings"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> {t("Back to drawings")}
        </Link>
      </div>
      <AnnotationStudio />
    </div>
  );
}
