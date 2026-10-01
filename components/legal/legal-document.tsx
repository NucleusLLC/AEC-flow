import Link from "next/link";
import type { ReactNode } from "react";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { LEGAL, LEGAL_PATHS, formatVersionDate } from "@/lib/legal/policy";

/**
 * The page around the Terms and the Privacy Policy. Public: no app shell, no
 * session. The chrome follows the reader's language; the document itself is
 * English, and says so, because a translation of a legal text that nobody has
 * reviewed would be a second, unchecked version of it.
 */
export async function LegalDocument({
  title,
  version,
  intro,
  children,
}: {
  title: string;
  version: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const [t, locale] = await Promise.all([getServerT(), getServerLocale()]);
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <Link href="/login" className="text-2xl font-bold tracking-tight text-fg">
            AEC-flow
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href={LEGAL_PATHS.terms} className="text-muted hover:text-fg hover:underline">
              {t("Terms of Service")}
            </Link>
            <Link href={LEGAL_PATHS.privacy} className="text-muted hover:text-fg hover:underline">
              {t("Privacy Policy")}
            </Link>
          </nav>
        </div>

        <article
          className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-sm leading-relaxed text-fg shadow-sm sm:p-10"
        >
          <h1 lang="en" className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-xs text-muted">
            {fmt(t("Last updated {date}"), { date: formatVersionDate(version, locale) })}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("This document is in English, and the English text is the one that applies.")}
          </p>
          <div lang="en">
            <div className="mt-6 rounded-lg border border-border bg-surface-2 p-4 text-sm">{intro}</div>
            <div className="mt-8 space-y-8">{children}</div>
          </div>
        </article>

        <p className="mt-6 text-center text-xs text-faint">
          {LEGAL.product} · {LEGAL.operator} ·{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-fg hover:underline">
            {LEGAL.contactEmail}
          </a>{" "}
          ·{" "}
          <Link href="/login" className="hover:text-fg hover:underline">
            {t("Back to sign in")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** One numbered section of a legal document. */
export function Clause({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A plain bulleted list in a clause. */
export function Points({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-muted">{children}</ul>;
}

/** The contact address, as a link. */
export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-brand hover:underline">
      {LEGAL.contactEmail}
    </a>
  );
}
