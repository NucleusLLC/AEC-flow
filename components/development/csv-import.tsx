"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseCsv } from "@/lib/development/csv";

/**
 * Reusable "Import CSV" control. Reads a chosen .csv file, parses it, and hands
 * the raw rows to `onRows`; the caller maps columns to its row type and returns
 * how many were imported. Shows an inline result.
 */
export function CsvImport({ onRows, hint }: { onRows: (rows: string[][]) => number; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const n = onRows(rows);
      setMsg({ ok: true, text: `Imported ${n} row${n === 1 ? "" : "s"}.` });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className={`text-[11px] ${msg.ok ? "text-emerald-700" : "text-amber-700"}`}>{msg.text}</span> : null}
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        title={hint}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"
      >
        <Upload className="h-4 w-4" /> Import CSV
      </button>
    </div>
  );
}
