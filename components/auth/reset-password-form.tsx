"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/app/reset-password/[token]/actions";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Mirrored for instant feedback only; the server re-checks before anything is written.
    const local = validatePasswordConfirmation(password, confirmation);
    if (!local.ok) {
      setError(local.error);
      return;
    }
    start(async () => {
      const res = await resetPasswordAction(token, password, confirmation);
      if (!res.ok) {
        setError(res.error);
        setExpired(!!res.expired);
        return;
      }
      const s = await signIn("credentials", { email: res.email, password, redirect: false });
      if (s?.error) {
        router.replace("/login?reset=1");
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {error}
            {expired ? (
              <>
                {" "}
                <Link href="/forgot-password" className="font-medium underline">
                  Request a new link
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <label className={labelCls} htmlFor="password">
          New password <span className="text-faint">(min {PASSWORD_MIN_LENGTH} characters)</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="confirmation">Confirm new password</label>
        <input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
