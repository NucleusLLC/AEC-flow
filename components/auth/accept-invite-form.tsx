"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { acceptInviteAction } from "@/app/invite/[token]/actions";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await acceptInviteAction(token, name, password);
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
        <label className="mb-1 block text-xs font-medium text-muted">Email</label>
        <input value={email} readOnly className={`${field} cursor-not-allowed opacity-70`} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={field} autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={field}
        />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join company"}
      </button>
    </form>
  );
}
