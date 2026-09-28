import Link from "next/link";
import { getCurrentCompany } from "@/lib/server/tenant";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const dynamic = "force-dynamic";

export default async function ExpiredPage() {
  const company = await getCurrentCompany();
  const t = await getServerT();
  const locale = await getServerLocale();
  const who = company?.name ?? t("This workspace");
  const ended = company?.expiresAt
    ? new Date(company.expiresAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⏳
        </div>
        <h1 className="text-lg font-semibold text-fg">{t("Your access has ended")}</h1>
        <p className="mt-2 text-sm text-muted">
          {ended
            ? fmt(t("{name}’s free access ended on {date}."), { name: who, date: ended })
            : fmt(t("{name}’s access window has ended."), { name: who })}{" "}
          {t("Your data is safe — it’s kept and will be right here when you renew.")}
        </p>
        <a
          href="mailto:greg@zenarch.net?subject=AEC-flow%20access%20renewal"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-fg hover:bg-brand/90"
        >
          {t("Contact us to renew")}
        </a>
        <Link href="/api/auth/signout" className="mt-3 inline-block text-xs text-faint hover:text-muted">
          {t("Sign out")}
        </Link>
      </div>
    </div>
  );
}
