import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";

/** Friendly 404 for unmatched /(app) routes and `notFound()` calls. */
export default async function NotFound() {
  const t = await getServerT();
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Compass className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-fg">{t("Page not found")}</h2>
        <p className="max-w-md text-sm text-muted">
          {t("The record or page you're looking for doesn't exist or may have been moved.")}
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Back to dashboard")}
        </Link>
      </Card>
    </div>
  );
}
