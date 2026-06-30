import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Join the Beta · AEC-flow" };

const PERKS = [
  "6 months of free access to the full suite",
  "Help shape the product — your bugs & wishes go straight to the team",
  "Early access to new modules as they ship",
];

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4 py-10">
      <div className="grid w-full max-w-4xl gap-8 md:grid-cols-2 md:items-center">
        {/* Pitch */}
        <div className="hidden md:block">
          <div className="text-2xl font-bold tracking-tight text-fg">AEC-flow</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
            AEC Management Suite
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-fg">
            Join the AEC-flow Beta
          </h1>
          <p className="mt-3 text-sm text-muted">
            Get <strong className="text-fg">6 months free</strong> while we build. In return, we
            ask one thing: tell us what&apos;s broken and what you wish it did — right inside the app.
          </p>
          <ul className="mt-6 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-fg">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div>
          <div className="mb-6 text-center md:hidden">
            <div className="text-2xl font-bold tracking-tight text-fg">AEC-flow</div>
            <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted">
              AEC Management Suite
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-fg">Create your beta account</h2>
            <p className="mb-5 text-sm text-muted">
              6 months free · feedback welcome anytime.
            </p>
            <SignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}
