"use client";

import { useMemo, useState } from "react";
import { Calculator, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { parseRange, type ExportKind } from "@/lib/finance/export";

const FILES: { kind: ExportKind; label: string; desc: string }[] = [
  { kind: "invoices", label: "Invoices", desc: "One row per invoice issued in the period: net, tax, total, paid and outstanding." },
  { kind: "invoice-lines", label: "Invoice lines", desc: "Every line of those invoices, with milestone, quantity, rate and tax flag." },
  { kind: "payments", label: "Payments", desc: "Payments received in the period, whatever date the invoice was issued." },
  { kind: "time", label: "Approved time", desc: "Approved hours with the charge and cost rates as they were, and what was invoiced." },
  { kind: "expenses", label: "Approved expenses", desc: "Approved expenses with markup, reimbursement and what was invoiced." },
];

/**
 * The accounting export: five CSV files for one period, for an accountant or a
 * bookkeeping package. Shown only to people who approve time and expenses;
 * the route checks again (app/api/export/finance/[kind]/route.ts).
 */
export function AccountingExport({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const t = useT();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const check = useMemo(() => parseRange(from, to), [from, to]);
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const qs = query.toString() ? `?${query.toString()}` : "";

  const input =
    "h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <section id="accounting" className="scroll-mt-6">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-fg">{t("Accounting export")}</h3>
            <p className="mt-1 text-xs text-muted">
              {t("CSV files for your accountant or bookkeeping software: ISO dates, plain amounts with the currency in its own column, drafts left out.")}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-muted">
                <span className="mb-1 block">{t("Period start")}</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
              </label>
              <label className="text-xs font-medium text-muted">
                <span className="mb-1 block">{t("Period end")}</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
              </label>
            </div>
            {!check.ok ? <p className="mt-2 text-xs text-red-600">{t(check.error)}</p> : null}

            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {FILES.map((f) => (
                <li key={f.kind} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{t(f.label)}</div>
                    <div className="text-xs text-muted">{t(f.desc)}</div>
                  </div>
                  {check.ok ? (
                    <a
                      href={`/api/export/finance/${f.kind}${qs}`}
                      download
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                    >
                      <Download className="h-4 w-4" />
                      {t("Download CSV")}
                    </a>
                  ) : (
                    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-faint">
                      <Download className="h-4 w-4" />
                      {t("Download CSV")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </section>
  );
}
