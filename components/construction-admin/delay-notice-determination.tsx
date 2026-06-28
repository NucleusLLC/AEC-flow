"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DELAY_STATUS_LABEL } from "@/lib/ca/labels";
import type { DelayStatus } from "@/lib/ca/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

const STATUS_ORDER: DelayStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "CLOSED"];

export function DelayNoticeDetermination({
  noticeId,
  currentStatus,
  currentApprovedDays,
}: {
  noticeId: string;
  currentStatus: DelayStatus;
  currentApprovedDays: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DelayStatus>(currentStatus);
  const [approvedDays, setApprovedDays] = useState<number>(currentApprovedDays);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/construction-admin/delay-notices/${noticeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvedDays }),
      });
      const json = await res.json();
      if (!res.ok) setMsg({ ok: false, text: json.error ?? `Failed (${res.status})` });
      else {
        setMsg({ ok: true, text: "Delay notice updated." });
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Determination" subtitle="Review the claim and certify the extension of time" />
      <CardBody className="space-y-3">
        {msg ? (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            {msg.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as DelayStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{DELAY_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Approved days</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={approvedDays}
              onChange={(e) => setApprovedDays(Number(e.target.value))}
            />
          </div>
        </div>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save determination"}
        </button>
      </CardBody>
    </Card>
  );
}
