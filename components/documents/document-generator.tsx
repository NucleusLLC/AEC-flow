"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { FileOutput, Printer, Save, CheckCircle2, AlertTriangle, FolderArchive } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { useModule } from "@/components/shell/module-provider";
import { recordGeneratedDocument } from "@/app/(app)/documents/actions";
import { docsFor, docLabel, SOURCE_LABEL, type SourceSystem } from "@/lib/documents/catalog";
import { cn } from "@/lib/utils";

interface RecordOption {
  id: string;
  label: string;
  sublabel: string;
  version: string | null;
}

function renderUrlFor(source: SourceSystem, recordId: string): string {
  return source === "estimates"
    ? `/print/estimates/${encodeURIComponent(recordId)}`
    : `/print/schedule/${encodeURIComponent(recordId)}`;
}

export function DocumentGenerator({
  estimateRecords,
  scheduleRecords,
  initialSource,
  initialRecordId,
}: {
  estimateRecords: RecordOption[];
  scheduleRecords: RecordOption[];
  initialSource: SourceSystem;
  initialRecordId: string;
}) {
  const { moduleKey, module } = useModule();
  const [source, setSource] = useState<SourceSystem>(initialSource);
  const records = source === "estimates" ? estimateRecords : scheduleRecords;

  const [recordId, setRecordId] = useState<string>(
    initialRecordId && records.some((r) => r.id === initialRecordId)
      ? initialRecordId
      : records[0]?.id ?? "",
  );
  const docs = docsFor(source);
  const [docType, setDocType] = useState<string>(docs.find((d) => d.backed)?.key ?? docs[0].key);
  const [result, setResult] = useState<null | { ok: boolean; msg: string; migration?: boolean }>(null);
  const [pending, startTransition] = useTransition();

  const record = records.find((r) => r.id === recordId) ?? null;
  const doc = docs.find((d) => d.key === docType) ?? docs[0];
  const backed = doc.backed && !!record;

  function switchSource(next: SourceSystem) {
    setSource(next);
    setResult(null);
    const nextRecords = next === "estimates" ? estimateRecords : scheduleRecords;
    setRecordId(nextRecords[0]?.id ?? "");
    const nextDocs = docsFor(next);
    setDocType(nextDocs.find((d) => d.backed)?.key ?? nextDocs[0].key);
  }

  const today = useMemo(
    () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    [],
  );

  const title = record ? `${docLabel(source, docType)} — ${record.label.split(" · ")[0]}` : docLabel(source, docType);

  function openAndPrint() {
    if (!record) return;
    window.open(renderUrlFor(source, record.id), "_blank", "noopener,noreferrer");
  }

  function recordInRegister() {
    if (!record) return;
    setResult(null);
    startTransition(async () => {
      const res = await recordGeneratedDocument({
        sourceSystem: source,
        docType,
        title,
        sourceRecordId: record.id,
        sourceRecordVersion: record.version,
        moduleKey,
      });
      if (res.ok) {
        setResult({ ok: true, msg: "Recorded in the Document Register." });
      } else {
        setResult({ ok: false, msg: res.error, migration: res.needsMigration });
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Document Generator</h1>
        <p className="mt-1 text-sm text-muted">
          Generate documents from Estimates or Schedule. The source data is read as-is — nothing is
          recalculated or modified here.
        </p>
      </div>

      <Card>
        <CardHeader title="1 · Source system" />
        <CardBody className="flex gap-3">
          {(["estimates", "schedule"] as SourceSystem[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchSource(s)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                source === s
                  ? "border-brand bg-brand/10 text-fg"
                  : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {SOURCE_LABEL[s]}
            </button>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="2 · Source record" subtitle={`${records.length} available`} />
        <CardBody>
          {records.length === 0 ? (
            <p className="text-sm text-muted">No {SOURCE_LABEL[source].toLowerCase()} records yet.</p>
          ) : (
            <select
              value={recordId}
              onChange={(e) => {
                setRecordId(e.target.value);
                setResult(null);
              }}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="3 · Document type" />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2">
            {docs.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setDocType(d.key);
                  setResult(null);
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  docType === d.key
                    ? "border-brand bg-brand/10 text-fg"
                    : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <span>{d.label}</span>
                {!d.backed ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    Soon
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Source-version block (spec §12/§13) */}
      <Card>
        <CardHeader title="Document identity" subtitle="Stamped on every generated document" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 font-mono text-xs sm:grid-cols-2">
            <Row k="Source System" v={SOURCE_LABEL[source]} />
            <Row k={`${SOURCE_LABEL[source]} Record`} v={record?.id ?? "—"} />
            <Row
              k={`${SOURCE_LABEL[source]} Version`}
              v={record?.version ?? "n/a (no version mechanism)"}
            />
            <Row k="Generated Through" v="AEC-Flow Document Generator" />
            <Row k="Active Module" v={`Module ${module.number}`} />
            <Row k="Module Version" v={module.version} />
            <Row k="Generation Date" v={today} />
          </dl>
        </CardBody>
      </Card>

      {!backed && record ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{doc.label}</strong> doesn&apos;t have a dedicated renderer yet. You can still
            record the intent, but the printable output isn&apos;t available for this type.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openAndPrint}
          disabled={!backed}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer className="h-4 w-4" /> Open &amp; print
        </button>
        <button
          type="button"
          onClick={recordInRegister}
          disabled={!record || pending}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> {pending ? "Recording…" : "Record in register"}
        </button>
        <Link
          href="/documents/register"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
        >
          <FolderArchive className="h-4 w-4" /> View register
        </Link>
      </div>

      {result ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {result.msg}
            {result.migration ? (
              <span className="mt-1 block font-mono text-xs opacity-80">prisma db push</span>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-fg">{v}</dd>
    </div>
  );
}
