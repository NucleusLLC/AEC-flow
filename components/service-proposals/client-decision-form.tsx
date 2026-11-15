"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { submitProposalDecisionAction } from "@/app/p/[token]/actions";
import { translate, type Lang } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import type { FormIssues } from "@/lib/proposals/acceptance";

const input =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none";
const label = "text-xs font-medium text-gray-600";

/**
 * The client's Accept / Decline form on the public acceptance page (app/p/[token]).
 *
 * It speaks the PROPOSAL's language, handed in by the page, not the viewer's cookie: the
 * client has never set one, and the form they sign belongs with the document above it.
 * Every check is repeated on the server (lib/proposals/acceptance.ts); this form only
 * collects the answer and shows what the server said.
 */
export function ClientDecisionForm({
  token,
  lang,
  practiceName,
}: {
  token: string;
  lang: Lang;
  practiceName: string;
}) {
  const t = (s: string) => translate(lang, s);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"accept" | "decline">("accept");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<FormIssues>({});

  function submit(decision: "ACCEPTED" | "DECLINED", form: HTMLFormElement) {
    const data = new FormData(form);
    const raw: Record<string, unknown> = {};
    data.forEach((v, k) => {
      if (typeof v === "string") raw[k] = v;
    });
    setError(null);
    setIssues({});
    start(async () => {
      const res = await submitProposalDecisionAction(token, decision, raw);
      if (res.ok || res.invalid) {
        // Re-render from the server: the confirmation, or the generic dead-link page.
        router.refresh();
        return;
      }
      setError(res.error);
      setIssues(res.issues ?? {});
    });
  }

  const fieldError = (k: string) =>
    issues[k] ? <p className="mt-1 text-xs text-red-600">{issues[k]}</p> : null;

  if (mode === "decline") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit("DECLINED", e.currentTarget);
        }}
      >
        <h2 className="text-base font-semibold text-gray-900">{t("Decline this proposal")}</h2>
        <div>
          <label htmlFor="d-name" className={label}>{t("Your name (optional)")}</label>
          <input id="d-name" name="name" autoComplete="name" maxLength={120} className={`${input} mt-1`} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="d-reason" className={label}>{t("Reason (optional)")}</label>
          <textarea
            id="d-reason"
            name="reason"
            rows={4}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
          {fieldError("reason")}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
            {pending ? t("Sending…") : t("Decline proposal")}
          </button>
          <button type="button" onClick={() => setMode("accept")} className="text-sm text-gray-600 underline">
            {t("Back to accepting")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit("ACCEPTED", e.currentTarget);
      }}
    >
      <h2 className="text-base font-semibold text-gray-900">{t("Accept this proposal")}</h2>
      <p className="text-sm text-gray-600">
        {t("By accepting, you agree to the scope, fees and terms set out in the proposal above.")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="a-name" className={label}>{t("Full name")}</label>
          <input id="a-name" name="name" required autoComplete="name" maxLength={120} className={`${input} mt-1`} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="a-title" className={label}>{t("Position (optional)")}</label>
          <input id="a-title" name="title" autoComplete="organization-title" maxLength={120} className={`${input} mt-1`} />
          {fieldError("title")}
        </div>
        <div>
          <label htmlFor="a-company" className={label}>{t("Company (optional)")}</label>
          <input id="a-company" name="company" autoComplete="organization" maxLength={160} className={`${input} mt-1`} />
          {fieldError("company")}
        </div>
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm text-gray-900">
          <input type="checkbox" name="onBehalf" required className="mt-0.5 h-4 w-4" />
          <span>{t("I accept this proposal on behalf of the client, and I am authorised to do so.")}</span>
        </label>
        {fieldError("onBehalf")}
      </div>
      <div>
        <label htmlFor="a-signature" className={label}>{t("Signature")}</label>
        <input
          id="a-signature"
          name="signature"
          required
          autoComplete="off"
          maxLength={120}
          className={`${input} mt-1 font-serif text-lg italic`}
        />
        <p className="mt-1 text-xs text-gray-500">{t("Type your full name to sign.")}</p>
        {fieldError("signature")}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
          {pending ? t("Sending…") : t("Accept proposal")}
        </button>
        <button type="button" onClick={() => setMode("decline")} className="text-sm text-gray-600 underline">
          {t("Decline instead")}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {fmt(t("Your name, the time, your IP address and browser are recorded with your answer and shared with {practice}."), {
          practice: practiceName,
        })}
      </p>
    </form>
  );
}
