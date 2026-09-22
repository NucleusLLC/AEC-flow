import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { redeemEmailVerification } from "@/lib/server/email-verification";
import { clientIpFrom } from "@/lib/account-security/rate-limit-policy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your email · AEC-flow",
  // The token is in this page's URL. Without this, any outbound link or
  // third-party asset loaded from here would hand it over in the Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * Opening the link IS the confirmation — there is no button to press.
 *
 * A GET that changes state is usually a mistake, and it is a deliberate exception
 * here: the whole proof is "this person received our mail and opened it", and a
 * confirmation step in between only loses the people who do not press it. The link
 * is single-use, so a mail scanner that follows it spends the token rather than
 * confirming anything twice — and the account would be confirmed either way.
 */
export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = clientIpFrom((name) => h.get(name) ?? undefined);
  const result = await redeemEmailVerification(token, ip);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-fg">AEC-flow</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
            AEC Management Suite
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center shadow-sm">
          {result.ok ? (
            <>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" aria-hidden="true" />
              <h1 className="mb-1 text-lg font-semibold text-fg">
                {result.already ? "Already confirmed" : "Email confirmed"}
              </h1>
              <p className="text-sm text-muted">
                {result.already
                  ? "This address was confirmed earlier. There is nothing else to do."
                  : "Thank you. Password resets and invitations will reach you at this address."}
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Go to sign in
              </Link>
            </>
          ) : (
            <>
              {/* Every dead state renders the same page: a tampered token, one nobody
                * issued, an expired one and a spent one are indistinguishable here.
                * The distinction exists in the database, where support can see it. */}
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
              <h1 className="mb-1 text-lg font-semibold text-fg">This link cannot be used</h1>
              <p className="text-sm text-muted">
                Confirmation links stop working after a week, and a newer one replaces the
                last straight away. Nothing has changed on your account. Sign in and use
                &ldquo;Resend&rdquo; on the banner to get a fresh link.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-fg hover:bg-surface-2"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
