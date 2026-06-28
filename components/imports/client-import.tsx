"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { parseCsv } from "@/lib/csv";
import { importClientsAction, type ImportResult } from "@/app/(app)/imports/actions";

export function ClientImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setParseError(null);
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseCsv(text);
      if (!parsed.length) { setParseError("No data rows found in the file."); return; }
      if (!parsed.some((r) => Object.keys(r).some((k) => k.toLowerCase() === "name"))) {
        setParseError('The file needs a "name" column.');
        return;
      }
      setFileName(file.name);
      setCsvText(text);
      setRows(parsed);
    } catch {
      setParseError("Could not parse the file as CSV.");
    }
  }

  function reset() {
    setFileName(null); setCsvText(""); setRows([]); setResult(null); setParseError(null);
  }

  function runImport() {
    setResult(null);
    startTransition(async () => setResult(await importClientsAction(csvText)));
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
            <Upload className="h-4 w-4" />
            Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {fileName ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <FileSpreadsheet className="h-4 w-4 text-faint" />
              {fileName} · {rows.length} rows
              <button type="button" onClick={reset} className="ml-1 text-faint hover:text-fg" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <span className="text-sm text-faint">A header row with a <code className="text-fg">name</code> column is required.</span>
          )}
        </div>

        {parseError ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {parseError}
          </div>
        ) : null}

        {/* Preview */}
        {rows.length && !result ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-muted">Preview — first {Math.min(5, rows.length)} of {rows.length} rows</div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-2 text-left text-muted">
                    {columns.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {columns.map((c) => <td key={c} className="max-w-[180px] truncate px-2 py-1.5 text-fg">{r[c]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={runImport}
                disabled={pending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {pending ? "Importing…" : `Import ${rows.length} client${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        ) : null}

        {/* Result */}
        {result ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Check className="h-4 w-4 shrink-0" />
              Imported {result.created} of {result.total} clients.{" "}
              <Link href="/clients" className="font-medium underline hover:text-emerald-900">View clients</Link>
            </div>
            {result.failures.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="font-medium">{result.failures.length} row{result.failures.length === 1 ? "" : "s"} skipped:</div>
                <ul className="mt-1 list-inside list-disc">
                  {result.failures.slice(0, 10).map((f, i) => (
                    <li key={i}>Row {f.row} ({f.name}): {f.error}</li>
                  ))}
                  {result.failures.length > 10 ? <li>…and {result.failures.length - 10} more</li> : null}
                </ul>
              </div>
            ) : null}
            <button type="button" onClick={reset} className="text-sm text-muted underline hover:text-fg">Import another file</button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
