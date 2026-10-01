"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, FileText, Loader2, X } from "lucide-react";
import { acceptTermsAction } from "@/app/(app)/account/actions";
import { useT } from "@/components/i18n/language-provider";
import { LEGAL_PATHS, type TermsStatus } from "@/lib/legal/policy";

/**
 * "Please read and accept the Terms", across the top of the app, for an
 * account whose recorded acceptance is missing (made before the pages
 * existed) or out of date (a version changed since).
 *
 * Like the email-confirmation banner it asks and does not block: during the
 * beta a record of acceptance is worth having, but not worth locking a
 * practice out of its own work. Hidden for the session by the ×; gone for good
 * once accepted, because the server stops rendering it.
 */
export function AcceptTermsBanner({ status }: { status: Exclude<TermsStatus, "current"> }) {
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();

  if (hidden) return null;

  const accept = () =>
    start(async () => {
      setError(null);
      const res = await acceptTermsAction();
      if (res.ok) setDone(true);
      else setError(res.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand/30 bg-brand/10 px-4 py-2 text-sm text-fg">
      <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0">
        {status === "never"
          ? t("AEC-flow now has Terms of Service and a Privacy Policy. Please read them and accept.")
          : t("The Terms of Service or the Privacy Policy have changed. Please read and accept the new version.")}{" "}
        <Link href={LEGAL_PATHS.terms} target="_blank" className="font-medium text-brand hover:underline">
          {t("Terms of Service")}
        </Link>
        {" · "}
        <Link href={LEGAL_PATHS.privacy} target="_blank" className="font-medium text-brand hover:underline">
          {t("Privacy Policy")}
        </Link>
      </span>
      {done ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-brand">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("Accepted — thank you")}
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={accept}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand px-2.5 text-xs font-semibold text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {t("I accept")}
        </button>
      )}
      {error ? <span className="text-xs text-red-700 dark:text-red-300">{t(error)}</span> : null}
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={t("Hide until next time")}
        className="ml-auto shrink-0 rounded p-1 hover:bg-brand/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
