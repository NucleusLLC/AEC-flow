import type { Metadata } from "next";
import Link from "next/link";
import {
  Calculator,
  CalendarClock,
  FileText,
  FolderKanban,
  HardHat,
  Users,
  Check,
  ArrowRight,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("Join the AEC-flow Beta"),
    description: t(
      "AEC-flow is the management suite for architecture, engineering & construction practices — estimates, schedules, proposals and construction admin in one place. Join the private beta: 6 months free.",
    ),
  };
}

const FEATURES = [
  { icon: Calculator, title: "Estimates", desc: "BOQ-style cost estimates with norms, take-off, rebar and print-ready reports." },
  { icon: CalendarClock, title: "Schedule", desc: "Interactive Gantt programmes with critical path, progress tracking and PDF export." },
  { icon: FileText, title: "Proposals", desc: "Draft, send and track client proposals from first contact to signed." },
  { icon: FolderKanban, title: "Projects", desc: "Run delivery end-to-end — phases, tasks and the team, all in one board." },
  { icon: HardHat, title: "Construction Admin", desc: "RFIs, change orders, site instructions, submittals and progress certificates." },
  { icon: Users, title: "Clients", desc: "A living directory of clients with their estimates, proposals and history." },
];

const PERKS = [
  { title: "6 months free", desc: "Full access to the entire suite while we build — no card required." },
  { title: "Shape the product", desc: "Your bugs and wishes go straight to the team from inside the app." },
  { title: "Early access", desc: "Be first to try new modules the moment they ship." },
];

export default async function BetaPortalPage() {
  const t = await getServerT();
  return (
    <div className="min-h-screen bg-surface-2 text-fg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-brand-fg">
              AF
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-fg">AEC-flow</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("Private Beta")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              {t("Sign in")}
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-fg transition-opacity hover:opacity-90"
            >
              {t("Join the beta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> {t("Now inviting beta testers")}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            {t("The management suite for AEC practices.")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            {t("Estimates, schedules, proposals and construction administration — for architecture, engineering and construction teams, in one place. Get 6 months free as a beta tester.")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-brand-fg transition-opacity hover:opacity-90 sm:w-auto"
            >
              {t("Join the beta — 6 months free")} <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-surface px-6 py-3 text-base font-medium text-fg transition-colors hover:bg-surface-2 sm:w-auto"
            >
              {t("Sign in")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-faint">{t("A beta invite code is required to create an account.")}</p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-fg">{t("Everything a practice runs on")}</h2>
            <p className="mt-3 text-muted">{t("One suite, from first estimate to final certificate.")}</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-fg">{t(f.title)}</h3>
                  <p className="mt-1.5 text-sm text-muted">{t(f.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-fg">{t("Why join the beta")}</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {PERKS.map((p) => (
              <div key={p.title} className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Check className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-fg">{t(p.title)}</h3>
                <p className="mt-1.5 text-sm text-muted">{t(p.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we ask */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-fg">{t("All we ask in return")}</h2>
            <p className="mt-3 text-muted">
              {t("Tell us what's broken and what you wish it did. Every screen has a Bug / Wish button — your feedback goes straight to the team, and shapes what we build next.")}
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <MessageSquarePlus className="h-4 w-4" />
                </span>
                <p className="text-sm text-fg">{t("Share bugs and wishes any time, right inside the app.")}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <p className="text-sm text-fg">{t("Your practice's data is isolated to your own workspace.")}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-8 text-center">
            <h3 className="text-xl font-bold tracking-tight text-fg">{t("Ready to start?")}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
              {t("Create your beta account in under a minute. Invite code required.")}
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-brand-fg transition-opacity hover:opacity-90"
            >
              {t("Join the beta")} <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="mt-3 text-xs text-faint">
              {t("Have an account?")}{" "}
              <Link href="/login" className="font-medium text-brand hover:underline">
                {t("Sign in")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:px-6">
          <div>© AEC-flow · {t("Architecture · Engineering · Construction")}</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-fg">{t("Sign in")}</Link>
            <Link href="/signup" className="hover:text-fg">{t("Join the beta")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
