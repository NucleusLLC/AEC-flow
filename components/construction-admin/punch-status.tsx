"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PUNCH_STATUS_LABEL } from "@/lib/ca/labels";
import type { PunchStatus } from "@/lib/ca/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

const STATUS_ORDER: PunchStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "REJECTED"];

export function PunchStatus({
  itemId,
  currentStatus,
  currentVerifiedBy,
}: {
  itemId: string;
  currentStatus: PunchStatus;
  currentVerifiedBy: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PunchStatus>(currentStatus);
  const [verifiedBy, setVerifiedBy] = useState(currentVerifiedBy ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/construction-admin/punch-list/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          verifiedBy: verifiedBy || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) setMsg({ ok: false, text: json.error ?? `Failed (${res.status})` });
      else {
        setMsg({ ok: true, text: "Punch item updated." });
        setNotes("");
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
      <CardHeader title="Update status" subtitle="Track the item through close-out and verification" />
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
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PunchStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PUNCH_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Verified by</label>
            <input
              className={inputCls}
              value={verifiedBy}
              onChange={(e) => setVerifiedBy(e.target.value)}
              placeholder="Inspector / consultant"
              disabled={status !== "VERIFIED"}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Add a note</label>
          <textarea className={`${inputCls} h-auto min-h-[70px] py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save update"}
        </button>
      </CardBody>
    </Card>
  );
}
