import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password · AEC-flow" };

export default function ForgotPasswordPage() {
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
          <h1 className="mb-1 text-lg font-semibold text-fg">Forgot your password?</h1>
          <p className="mb-5 text-sm text-muted">
            Enter the email you sign in with and we&rsquo;ll send you a link to choose a new one.
          </p>
          <ForgotPasswordForm />
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
