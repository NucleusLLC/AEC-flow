import type { Metadata } from "next";
import Link from "next/link";
import { isResetTokenUsable } from "@/lib/server/password-reset";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password · AEC-flow",
  // The token is in this page's URL. Without this, following any outbound link or
  // loading any third-party asset from here would hand it over in the Referer.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const usable = await isResetTokenUsable(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-fg">AEC-flow</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
            AEC Management Suite
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
          {usable ? (
            <>
              <h1 className="mb-1 text-lg font-semibold text-fg">Choose a new password</h1>
              <p className="mb-5 text-sm text-muted">You&rsquo;ll be signed in once it&rsquo;s set.</p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <div className="text-center">
              <h1 className="mb-1 text-lg font-semibold text-fg">Link expired</h1>
              <p className="text-sm text-muted">
                This reset link has expired or has already been used. Links work once, for one hour.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90"
              >
                Request a new link
              </Link>
            </div>
          )}
          <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted">
            <Link href="/login" className="font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
