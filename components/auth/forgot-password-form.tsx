"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestPasswordResetAction(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSentTo(email.trim());
    });
  }

  if (sentTo) {
    // Worded so it is true whether or not the address has an account.
    return (
      <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          If an account exists for <span className="font-medium">{sentTo}</span>, a reset link is on its way.
          It works once and expires in an hour. Check your spam folder if it doesn&rsquo;t arrive.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div>
        <label className={labelCls} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="you@company.com"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
