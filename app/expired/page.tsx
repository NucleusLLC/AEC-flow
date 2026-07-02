import Link from "next/link";
import { getCurrentCompany } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

export default async function ExpiredPage() {
  const company = await getCurrentCompany();
  const ended = company?.expiresAt
    ? new Date(company.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⏳
        </div>
        <h1 className="text-lg font-semibold text-fg">Your access has ended</h1>
        <p className="mt-2 text-sm text-muted">
          {company?.name ? <span className="font-medium text-fg">{company.name}</span> : "This workspace"}
          {ended ? `’s free access ended on ${ended}.` : "’s access window has ended."} Your data is safe — it’s
          kept and will be right here when you renew.
        </p>
        <a
          href="mailto:greg@zenarch.net?subject=AEC-flow%20access%20renewal"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-fg hover:bg-brand/90"
        >
          Contact us to renew
        </a>
        <Link href="/api/auth/signout" className="mt-3 inline-block text-xs text-faint hover:text-muted">
          Sign out
        </Link>
      </div>
    </div>
  );
}
