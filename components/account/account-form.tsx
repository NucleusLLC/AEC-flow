"use client";

import { useState, useTransition } from "react";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { updateProfileAction, changePasswordAction } from "@/app/(app)/account/actions";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import type { AccountProfile } from "@/lib/data/account";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
const labelCls = "block text-xs font-medium text-muted";

function Status({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) return <span className="inline-flex items-center gap-1.5 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> {error}</span>;
  if (saved) return <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600"><Check className="h-4 w-4" /> Saved</span>;
  return null;
}

export function AccountForm({ account }: { account: AccountProfile }) {
  /* ---- Profile ---- */
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone ?? "");
  const [office, setOffice] = useState(account.officeLocation ?? "");
  const [bio, setBio] = useState(account.bio ?? "");
  const [pPending, pStart] = useTransition();
  const [pSaved, setPSaved] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  function saveProfile() {
    setPSaved(false); setPError(null);
    pStart(async () => {
      const res = await updateProfileAction({ name, phone: phone || null, officeLocation: office || null, bio: bio || null });
      if (res.ok) setPSaved(true); else setPError(res.error);
    });
  }

  /* ---- Password ---- */
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwPending, pwStart] = useTransition();
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  function changePw() {
    setPwSaved(false); setPwError(null);
    // Mirror of lib/password-policy for instant feedback. The same rules are
    // re-applied server-side in changeOwnPassword — this is UX, not a control.
    const check = validatePasswordConfirmation(next, confirm);
    if (!check.ok) { setPwError(check.error); return; }
    pwStart(async () => {
      const res = await changePasswordAction(current, next);
      if (res.ok) { setPwSaved(true); setCurrent(""); setNext(""); setConfirm(""); }
      else setPwError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <Card>
        <CardHeader title="Profile" subtitle="Your personal details. Role and department are managed by an admin." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} disabled={pPending} />
          </label>
          <label className="block">
            <span className={labelCls}>Email</span>
            <input value={account.email} className={inputCls} disabled readOnly />
          </label>
          <label className="block">
            <span className={labelCls}>Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} disabled={pPending} placeholder="+971 50 000 0000" />
          </label>
          <label className="block">
            <span className={labelCls}>Office location</span>
            <input value={office} onChange={(e) => setOffice(e.target.value)} className={inputCls} disabled={pPending} placeholder="Dubai" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} disabled={pPending}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60" />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Role: <span className="font-medium text-fg">{account.role}</span></span>
            {account.department ? <span>· Department: <span className="font-medium text-fg">{account.department}</span></span> : null}
            {account.discipline ? <span>· Discipline: <span className="font-medium text-fg">{account.discipline}</span></span> : null}
          </div>
        </CardBody>
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
          <Status saved={pSaved} error={pError} />
          <button type="button" onClick={saveProfile} disabled={pPending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60">
            {pPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader title="Password" subtitle="Change your sign-in password." />
        {account.hasPassword ? (
          <>
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelCls}>Current password</span>
                <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} disabled={pwPending} />
              </label>
              <label className="block">
                <span className={labelCls}>New password</span>
                <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} disabled={pwPending} placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} />
              </label>
              <label className="block">
                <span className={labelCls}>Confirm new password</span>
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} disabled={pwPending} />
              </label>
              {/* Say what actually happens. NextAuth sessions here are JWTs, which stay
                  valid until they expire — implying otherwise would be a lie. */}
              <p className="sm:col-span-2 text-[11px] text-faint">
                A longer passphrase beats a short complicated one — there is no maximum length and no
                required mix of characters. Changing your password here does not sign you out on other
                devices; sessions you have already started stay signed in until they expire.
              </p>
            </CardBody>
            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
              <Status saved={pwSaved} error={pwError} />
              <button type="button" onClick={changePw} disabled={pwPending || !next}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60">
                {pwPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pwPending ? "Updating…" : "Change password"}
              </button>
            </div>
          </>
        ) : (
          // An account with no password hash cannot sign in at all, so in practice
          // nobody sees this. It exists so the state is stated rather than offering a
          // form the server will refuse.
          <CardBody>
            <p className="text-sm text-muted">
              This account has no sign-in password yet. An administrator or director at your company can set
              one from <span className="font-medium text-fg">Settings → Members &amp; Roles</span>.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
