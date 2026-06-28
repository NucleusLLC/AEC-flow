"use client";

import { useState } from "react";
import { Save, Check, AlertTriangle } from "lucide-react";

/**
 * Reusable Save button + inline status banner for the editable dev tabs.
 * `build()` returns the request to send; the DB-down case surfaces the API's
 * 503 message (writes never silently no-op).
 */
export function SaveControl({
  method = "PUT",
  url,
  build,
  label = "Save",
}: {
  method?: "PUT" | "PATCH";
  url: string;
  build: () => unknown;
  label?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(build()) });
      const json = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: json.error ?? `Failed (${res.status})` });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg ? (
        <span className={`inline-flex items-center gap-1.5 text-xs ${msg.ok ? "text-emerald-700" : "text-amber-700"}`}>
          {msg.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {msg.text}
        </span>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}
