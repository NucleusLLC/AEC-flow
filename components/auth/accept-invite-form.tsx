"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { acceptInviteAction } from "@/app/invite/[token]/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { LEGAL_PATHS } from "@/lib/legal/policy";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await acceptInviteAction(token, name, password, acceptedTerms);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const s = await signIn("credentials", { email, password, redirect: false });
      if (s?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  const field =
    "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t("Email")}</label>
        <input value={email} readOnly className={`${field} cursor-not-allowed opacity-70`} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t("Your name")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={field} autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t("Password")}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={fmt(t("At least {count} characters"), { count: PASSWORD_MIN_LENGTH })}
          className={field}
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30" />
        <span>
          {t("I agree to the Terms of Service and the Privacy Policy.")}
          <span className="mt-1 block">
            <Link href={LEGAL_PATHS.terms} target="_blank" className="font-medium text-brand hover:underline">{t("Terms of Service")}</Link>
            {" · "}
            <Link href={LEGAL_PATHS.privacy} target="_blank" className="font-medium text-brand hover:underline">{t("Privacy Policy")}</Link>
          </span>
        </span>
      </label>
      {error ? <p className="text-xs text-rose-600">{t(error)}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
      >
        {pending ? t("Joining…") : t("Join company")}
      </button>
    </form>
  );
}
