import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";

/** Root-level 404 for URLs that match no route at all (outside the app shell). */
export default async function RootNotFound() {
  const t = await getServerT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-sm font-semibold tracking-wider text-brand">404</p>
      <h1 className="text-2xl font-semibold text-fg">{t("Page not found")}</h1>
      <p className="max-w-md text-sm text-muted">
        {t("The page you're looking for doesn't exist. Head back to the dashboard to keep working.")}
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        {t("Go to dashboard")}
      </Link>
    </main>
  );
}
