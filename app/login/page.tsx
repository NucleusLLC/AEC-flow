import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in · ZenArch" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-fg">ZenArch</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
            AEC Management Suite
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-fg">Sign in</h1>
          <p className="mb-5 text-sm text-muted">Use your ZenArch account to continue.</p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          ZenArch Consultants · Architecture · Engineering · Project Management
        </p>
      </div>
    </div>
  );
}
