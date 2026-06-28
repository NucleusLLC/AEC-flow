"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { RfiStatus } from "@/lib/ca/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function RfiRespond({ rfiId, initialResponse }: { rfiId: string; initialResponse: string | null }) {
  const router = useRouter();
  const [response, setResponse] = useState(initialResponse ?? "");
  const [responseBy, setResponseBy] = useState("");
  const [status, setStatus] = useState<RfiStatus>("ANSWERED");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/construction-admin/rfis/${rfiId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, responseBy, status }),
      });
      const json = await res.json();
      if (!res.ok) setMsg({ ok: false, text: json.error ?? `Failed (${res.status})` });
      else {
        setMsg({ ok: true, text: "Response saved." });
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
      <CardHeader title="Respond" subtitle="Answer and close out the RFI" />
      <CardBody className="space-y-3">
        {msg ? (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            {msg.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        ) : null}
        <div>
          <label className={labelCls}>Response</label>
          <textarea className={`${inputCls} h-auto min-h-[100px] py-2`} value={response} onChange={(e) => setResponse(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Responded by</label>
            <input className={inputCls} value={responseBy} onChange={(e) => setResponseBy(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Set status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as RfiStatus)}>
              <option value="ANSWERED">Answered</option>
              <option value="CLOSED">Closed</option>
              <option value="OPEN">Open</option>
            </select>
          </div>
        </div>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save response"}
        </button>
      </CardBody>
    </Card>
  );
}
