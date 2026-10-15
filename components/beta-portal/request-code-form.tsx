"use client";

import { useId, useState } from "react";
import { requestBetaCode } from "@/app/beta-portal/actions";
import { useT } from "@/components/i18n/language-provider";

const inputCls = "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function RequestCodeForm() {
  const t = useT();
  const id = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await requestBetaCode({ email });
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch {
      setError(t("Could not request your code. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-4 max-w-sm space-y-3 text-left">
      {sent ? <p role="status" className="text-sm text-muted">{t("If that address can receive mail, your code is on its way. Check spam too.")}</p> : <>
        <div>
          <label htmlFor={id} className={labelCls}>{t("Work email")}</label>
          <input id={id} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputCls} />
        </div>
        <button type="submit" disabled={loading} className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60">
          {loading ? t("Requesting your code…") : t("Request your code")}
        </button>
      </>}
      {error ? <p role="alert" className="text-sm text-red-600">{t(error)}</p> : null}
    </form>
  );
}
