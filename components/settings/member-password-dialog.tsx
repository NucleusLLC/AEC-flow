"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { setMemberPasswordAction } from "@/app/(app)/settings/actions";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import type { Member } from "@/lib/data/settings";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

/**
 * Settings → Members & Roles: set a new password for another member.
 *
 * The checks here are a mirror of `lib/password-policy.ts` for instant feedback
 * only. The real gate — is this actor an administrator, is this member even in
 * their company — runs in `setMemberPasswordAction` on the server; this dialog
 * being reachable proves nothing.
 */
export function MemberPasswordDialog({
  member,
  onClose,
  onDone,
}: {
  member: Member;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const check = validatePasswordConfirmation(password, confirm);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    startTransition(async () => {
      const res = await setMemberPasswordAction(member.id, password);
      // Clear the fields either way — a rejected password should not sit in the DOM.
      setPassword("");
      setConfirm("");
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-fg">{t("Set password")}</h3>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="text-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted">
            {fmt(
              t("Set a new sign-in password for {name} ({email}). Give it to them over a channel you trust, and ask them to change it to something only they know from My Account."),
              { name: member.name, email: member.email },
            )}
          </p>

          <label className="block">
            <span className="text-xs font-medium text-muted">{t("New password")}</span>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={pending}
                placeholder={fmt(t("At least {count} characters"), { count: PASSWORD_MIN_LENGTH })}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? t("Hide password") : t("Show password")}
                className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-muted hover:text-fg"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">{t("Confirm new password")}</span>
            <input
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
              className={inputCls}
            />
          </label>

          {/* Honest about what this does and does not do — see the note in the
              report about NextAuth JWT sessions. */}
          <p className="text-[11px] text-faint">
            {t("This replaces the member's password immediately. It does not sign them out anywhere: a device they are already signed in on stays signed in until that session expires. If the account may be compromised, set the member to Inactive as well.")}
          </p>

          {error ? (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {t(error)}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !password}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {pending ? t("Setting…") : t("Set password")}
          </button>
        </div>
      </div>
    </div>
  );
}
