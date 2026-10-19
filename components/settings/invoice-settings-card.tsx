"use client";

/**
 * Settings → Invoicing: the practice's default payment terms, bank details and
 * terms & conditions. Stored per company in the AppConfig blob (no table, no
 * SQL) and read by the new-invoice wizard (default terms) and the printed
 * invoice (bank block, T&C on page 1 or on a second sheet).
 *
 * Read-only for anyone who is not an Admin, a Director or the founder; the
 * action checks the same gate again (app/(app)/settings/actions.ts).
 */

import { useState, useTransition } from "react";
import { Check, Lock, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { saveInvoiceSettingsAction } from "@/app/(app)/settings/actions";
import {
  MAX_BANK_DETAILS_CHARS,
  MAX_TERMS_CHARS,
  MAX_TERMS_DAYS,
  MAX_TERMS_FONT_PT,
  MIN_TERMS_DAYS,
  MIN_TERMS_FONT_PT,
  type InvoiceSettings,
} from "@/lib/finance/invoice-settings";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
const areaCls =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

export function InvoiceSettingsCard({
  initial,
  canSave,
}: {
  initial: InvoiceSettings;
  canSave: boolean;
}) {
  const t = useT();
  const [termsDays, setTermsDays] = useState(String(initial.defaultTermsDays));
  const [bankDetails, setBankDetails] = useState(initial.bankDetails);
  const [termsText, setTermsText] = useState(initial.termsText);
  const [secondPage, setSecondPage] = useState(initial.termsOnSecondPage);
  const [fontSize, setFontSize] = useState(String(initial.termsFontSize));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const disabled = !canSave || pending;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveInvoiceSettingsAction({
        defaultTermsDays: Number(termsDays),
        bankDetails,
        termsText,
        termsOnSecondPage: secondPage,
        termsFontSize: Number(fontSize),
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      // Show what was stored: out-of-range numbers come back clamped.
      setTermsDays(String(res.data.defaultTermsDays));
      setBankDetails(res.data.bankDetails);
      setTermsText(res.data.termsText);
      setSecondPage(res.data.termsOnSecondPage);
      setFontSize(String(res.data.termsFontSize));
      setMsg({ kind: "ok", text: "Invoice settings saved." });
    });
  }

  return (
    <Card>
      <CardHeader
        title={t("Invoice settings")}
        subtitle={t("Payment terms, bank details and terms & conditions printed on every invoice.")}
      />
      <CardBody className="space-y-4">
        {!canSave ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>{t("Only an Admin or a Director can change the practice's settings.")}</span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted">{t("Default payment terms (days)")}</span>
            <input
              type="number"
              min={MIN_TERMS_DAYS}
              max={MAX_TERMS_DAYS}
              step={1}
              value={termsDays}
              disabled={disabled}
              onChange={(e) => setTermsDays(e.target.value)}
              className={`${inputCls} font-mono`}
            />
            <span className="mt-1 block text-[11px] text-faint">
              {t("New invoices are due this many days after the invoice date. Each invoice can still be changed.")}
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">{t("T&C font size (pt)")}</span>
            <input
              type="number"
              min={MIN_TERMS_FONT_PT}
              max={MAX_TERMS_FONT_PT}
              step={1}
              value={fontSize}
              disabled={disabled}
              onChange={(e) => setFontSize(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted">{t("Bank details")}</span>
          <textarea
            rows={4}
            maxLength={MAX_BANK_DETAILS_CHARS}
            value={bankDetails}
            disabled={disabled}
            onChange={(e) => setBankDetails(e.target.value)}
            placeholder={"Aruba Bank N.V.\nIBAN / Account 000000000\nSWIFT ARUBAWAX"}
            className={`${areaCls} font-mono`}
          />
          <span className="mt-1 block text-[11px] text-faint">
            {t("Printed in a box under the totals on the first page.")}
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted">{t("Terms & conditions")}</span>
          <textarea
            rows={8}
            maxLength={MAX_TERMS_CHARS}
            value={termsText}
            disabled={disabled}
            onChange={(e) => setTermsText(e.target.value)}
            className={areaCls}
          />
          <span className="mt-1 block text-[11px] text-faint">
            {t("Printed on every invoice. Leave empty to print none.")}
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={secondPage}
            disabled={disabled}
            onChange={(e) => setSecondPage(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-fg">
            <span className="block">{t("Print the terms & conditions on a second page")}</span>
            <span className="block text-[11px] text-faint">{t("Off: they follow the notes on the first page.")}</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{pending ? t("Saving…") : t("Save invoice settings")}</span>
          </button>
          {msg ? (
            <span
              className={`inline-flex items-center gap-1.5 text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}
            >
              {msg.kind === "ok" ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              <span>{t(msg.text)}</span>
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
