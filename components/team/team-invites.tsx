"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, X, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createInviteAction, revokeInviteAction } from "@/app/(app)/team/invite-actions";
import type { UserRole } from "@prisma/client";

type SeatUsage = { used: number; pending: number; limit: number; available: number };
type InviteRow = { id: string; email: string; role: string; token: string; createdAt: string; expiresAt: string | null };

const ROLES: UserRole[] = ["STAFF", "MANAGER", "DIRECTOR", "ADMIN", "VIEWER"];

export function TeamInvites({ seatUsage, invitations }: { seatUsage: SeatUsage; invitations: InviteRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkFor = (token: string) => `${origin}/invite/${token}`;
  const full = seatUsage.available <= 0;

  function copy(text: string, key: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewLink(null);
    start(async () => {
      const res = await createInviteAction(email.trim(), role);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewLink(linkFor(res.token));
      setEmail("");
      router.refresh();
    });
  }

  function revoke(id: string) {
    start(async () => {
      await revokeInviteAction(id);
      router.refresh();
    });
  }

  const pct = seatUsage.limit > 0 ? Math.min(100, Math.round(((seatUsage.used + seatUsage.pending) / seatUsage.limit) * 100)) : 0;
  const field =
    "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Team seats & invites</h3>
          <p className="text-xs text-muted">
            {seatUsage.used} member{seatUsage.used === 1 ? "" : "s"}
            {seatUsage.pending > 0 ? ` · ${seatUsage.pending} pending` : ""} of {seatUsage.limit} seats
            {" · "}
            <span className={full ? "text-rose-600" : "text-emerald-600"}>
              {seatUsage.available} available
            </span>
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full ${full ? "bg-rose-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Invite form */}
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-muted">Invite by email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className={`${field} w-full`}
            disabled={full}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={field} disabled={full}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending || full || !email.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {full ? (
        <p className="mt-2 text-xs text-amber-600">
          All seats are in use. Raise this company&rsquo;s seat limit (founder Admin) or revoke a pending invite.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      {/* Freshly created link (no email is sent — share this link) */}
      {newLink ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-800">Invite created — share this link with them:</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input readOnly value={newLink} className="h-8 flex-1 rounded border border-emerald-200 bg-white px-2 text-xs text-emerald-900" />
            <button
              type="button"
              onClick={() => copy(newLink, "new")}
              className="inline-flex h-8 items-center gap-1 rounded border border-emerald-300 px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {copied === "new" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "new" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Pending invites */}
      {invitations.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted">Pending invites</p>
          <ul className="space-y-1.5">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2/50 px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm text-fg">{inv.email}</span>
                  <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted">{inv.role}</span>
                  {inv.expiresAt ? <span className="ml-2 text-[11px] text-faint">expires {inv.expiresAt}</span> : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(linkFor(inv.token), inv.id)}
                    className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-xs font-medium text-fg hover:bg-surface"
                  >
                    {copied === inv.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === inv.id ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(inv.id)}
                    disabled={pending}
                    className="inline-flex h-7 items-center gap-1 rounded border border-rose-200 px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
