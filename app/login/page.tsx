import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { getServerT } from "@/lib/i18n/server";
import { LEGAL_PATHS } from "@/lib/legal/policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Sign in")} · AEC-flow` };
}

export default async function LoginPage() {
  const t = await getServerT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-fg">AEC-flow</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
            {t("AEC Management Suite")}
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-fg">{t("Sign in")}</h1>
          <p className="mb-5 text-sm text-muted">{t("Use your AEC-flow account to continue.")}</p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted">
            {t("New to AEC-flow?")}{" "}
            <Link href="/signup" className="font-medium text-brand hover:underline">
              {t("Join the beta — 6 months free")}
            </Link>
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            <Link href="/beta-portal" className="hover:text-fg hover:underline">
              {t("Learn more about the beta")}
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          AEC-flow · {t("Architecture · Engineering · Project Management")}
        </p>
        <p className="mt-2 text-center text-xs text-faint">
          <Link href={LEGAL_PATHS.terms} className="hover:text-fg hover:underline">{t("Terms of Service")}</Link>
          {" · "}
          <Link href={LEGAL_PATHS.privacy} className="hover:text-fg hover:underline">{t("Privacy Policy")}</Link>
        </p>
      </div>
    </div>
  );
}
