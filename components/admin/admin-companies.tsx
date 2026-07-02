"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { updateCompanyLicense } from "@/app/(app)/admin/actions";
import type { AdminCompanyRow } from "@/lib/server/admin";

const PLANS = ["BETA", "STARTER", "PRO", "ENTERPRISE"];

function addMonthsISO(base: string | null, months: number): string {
  const from = base ? new Date(`${base}T00:00:00`) : new Date();
  from.setMonth(from.getMonth() + months);
  return from.toISOString().slice(0, 10);
}

export function AdminCompanies({ companies }: { companies: AdminCompanyRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-5 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 font-medium text-center">Users / seats</th>
              <th className="px-3 py-2.5 font-medium">Access until</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <Row key={c.id} company={c} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Row({ company }: { company: AdminCompanyRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(company.plan);
  const [seats, setSeats] = useState(company.seatLimit);
  const [expiry, setExpiry] = useState<string>(company.expiresAt ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const expired = !company.isFounder && company.expiresAt != null && company.expiresAt < new Date().toISOString().slice(0, 10);

  function save(next?: Partial<{ plan: string; seats: number; expiry: string }>) {
    setError(null);
    const payload = {
      id: company.id,
      plan: next?.plan ?? plan,
      seatLimit: next?.seats ?? seats,
      expiresAt: (next?.expiry ?? expiry) || null,
      modules: company.modules,
    };
    start(async () => {
      const res = await updateCompanyLicense(payload);
      if (!res.ok) setError(res.error);
      else {
        if (next?.plan) setPlan(next.plan);
        if (next?.expiry !== undefined) setExpiry(next.expiry ?? "");
        router.refresh();
        setOpen(false);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-border/60">
        <td className="px-5 py-3">
          <div className="font-medium text-fg">
            {company.name}
            {company.isFounder ? (
              <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">FOUNDER</span>
            ) : null}
          </div>
          <div className="text-xs text-faint">since {company.createdAt}</div>
        </td>
        <td className="px-3 py-3 text-muted">{company.plan}</td>
        <td className="px-3 py-3 text-center text-muted">
          {company.userCount} / {company.seatLimit}
        </td>
        <td className="px-3 py-3 text-muted">{company.isFounder ? "—" : company.expiresAt ?? "never"}</td>
        <td className="px-3 py-3">
          <span
            className={
              company.isFounder
                ? "text-emerald-600"
                : expired
                  ? "text-rose-600"
                  : "text-emerald-600"
            }
          >
            {company.isFounder ? "Owner" : expired ? "Expired" : "Active"}
          </span>
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
          >
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border/60 bg-surface-2/40">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Plan</span>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg">
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Seats</span>
                <input type="number" min={1} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="h-9 w-24 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">Access until (blank = never)</span>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg" />
              </label>
              <button type="button" disabled={pending} onClick={() => save()} className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => save({ expiry: addMonthsISO(expiry || null, 6) })} className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-fg hover:bg-surface disabled:opacity-50">
                  +6 months
                </button>
                <button type="button" disabled={pending} onClick={() => save({ expiry: new Date().toISOString().slice(0, 10) })} className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  Suspend now
                </button>
              </div>
            </div>
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
