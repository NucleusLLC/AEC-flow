"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { UserPlus, AlertTriangle, Loader2 } from "lucide-react";
import { registerBetaTester } from "@/app/signup/actions";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function SignupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await registerBetaTester({ name, email, company, password, code, agreed });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Account created — sign them straight in.
    const signin = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (signin?.error) {
      // Created but auto sign-in hiccupped — send them to the login page.
      router.replace("/login");
      return;
    }
    router.replace("/");
    router.refresh();
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
        <label className={labelCls} htmlFor="name">Full name</label>
        <input id="name" type="text" autoComplete="name" required value={name}
          onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Jane Smith" />
      </div>

      <div>
        <label className={labelCls} htmlFor="company">Company <span className="text-faint">(optional)</span></label>
        <input id="company" type="text" autoComplete="organization" value={company}
          onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="Acme Architects" />
      </div>

      <div>
        <label className={labelCls} htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" />
      </div>

      <div>
        <label className={labelCls} htmlFor="password">Password <span className="text-faint">(min 8 characters)</span></label>
        <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
      </div>

      <div>
        <label className={labelCls} htmlFor="code">Beta access code</label>
        <input id="code" type="text" required value={code}
          onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="Enter the code you were given" />
      </div>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30" />
        <span>
          I understand my <strong className="font-medium text-fg">6 months of free beta access</strong> comes
          with sharing feedback — reporting bugs and wishes via the in-app Feedback button.
        </span>
      </label>

      <button type="submit" disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Creating your account…" : "Create my beta account"}
      </button>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
