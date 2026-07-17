import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in · AEC-flow" };

export default function LoginPage() {
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
          <h1 className="mb-1 text-lg font-semibold text-fg">Sign in</h1>
          <p className="mb-5 text-sm text-muted">Use your AEC-flow account to continue.</p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted">
            New to AEC-flow?{" "}
            <Link href="/signup" className="font-medium text-brand hover:underline">
              Join the beta — 6 months free
            </Link>
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            <Link href="/beta-portal" className="hover:text-fg hover:underline">
              Learn more about the beta
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          AEC-flow · Architecture · Engineering · Project Management
        </p>
      </div>
    </div>
  );
}
