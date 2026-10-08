/**
 * The tax report's body: both bases per currency, the invoices and payments
 * behind them, and the notes. Rendered on the screen (/finance/tax) and on the
 * printed sheet (/print/finance/tax) from the same report object, so the two
 * cannot disagree.
 *
 * No hooks and no "use client": both callers are server components and hand in
 * their own translate function.
 *
 * Military look: olive bars and capital labels, dates as "15 SEP 2026".
 */
import { fmt } from "@/lib/i18n/format";
import { formatCurrency } from "@/lib/format";
import { militaryDate } from "@/lib/building-permits/register";
import type { CurrencyTotals, TaxNote, TaxReport } from "@/lib/finance/tax-report";

type T = (key: string) => string;

const OLIVE = "#4b5320";
const OLIVE_2 = "#5c6633";
const SAND = "#e4e8dc";
const LIME = "#c5d18a";

function amount(n: number, currency: string): string {
  return formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionBar({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="break-after-avoid rounded-t-md px-3 py-2" style={{ background: OLIVE, color: SAND }}>
      <div className="text-xs font-bold uppercase tracking-[0.18em]">{title}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: LIME }}>{sub}</div>
    </div>
  );
}

function taxLabel(t: T, name: string | null, percent: number): string {
  return `${name ?? t("Unnamed tax")} ${percent}%`;
}

function CurrencyBlock({ t, c, basis }: { t: T; c: CurrencyTotals; basis: "invoiced" | "received" }) {
  const th = "px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider";
  const num = "px-2 py-1 text-right font-mono tabular-nums";
  return (
    <div className="break-inside-avoid border border-t-0 px-3 py-3" style={{ borderColor: OLIVE_2 }} data-testid={`tax-${basis}-${c.currency}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold uppercase tracking-widest" style={{ color: OLIVE }}>{c.currency}</div>
        <div className="text-[11px] uppercase tracking-wider text-gray-600">
          {fmt(basis === "invoiced" ? t("{count} invoices") : t("{count} payments"), { count: c.count })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          { k: "net", label: t("Turnover excl. tax"), v: c.net },
          { k: "tax", label: t("Tax"), v: c.tax },
          { k: "gross", label: basis === "invoiced" ? t("Invoiced incl. tax") : t("Received incl. tax"), v: c.gross },
        ].map((x) => (
          <div key={x.k} className="rounded-md border px-2 py-1.5" style={{ borderColor: LIME, background: SAND }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: OLIVE_2 }}>{x.label}</div>
            <div className="font-mono text-sm font-bold tabular-nums text-gray-900" data-testid={`tax-${basis}-${c.currency}-${x.k}`}>
              {amount(x.v, c.currency)}
            </div>
          </div>
        ))}
      </div>
      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr style={{ background: SAND, color: OLIVE }}>
            <th className={th}>{t("Tax")}</th>
            <th className={th}>{t("Mode")}</th>
            <th className={`${th} text-right`}>{basis === "invoiced" ? t("Invoices") : t("Payments")}</th>
            <th className={`${th} text-right`}>{t("Taxable base")}</th>
            <th className={`${th} text-right`}>{t("Tax")}</th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((l) => (
            <tr key={l.key} className="border-b border-gray-200">
              <td className="px-2 py-1 font-semibold text-gray-900">{taxLabel(t, l.name, l.percent)}</td>
              <td className="px-2 py-1 text-gray-700">{l.mode === "INCLUSIVE" ? t("Included in price") : t("Added to price")}</td>
              <td className={num}>{l.count}</td>
              <td className={num}>{amount(l.base, c.currency)}</td>
              <td className={`${num} font-semibold text-gray-900`}>{amount(l.tax, c.currency)}</td>
            </tr>
          ))}
          {c.untaxed !== 0 ? (
            <tr className="border-b border-gray-200 text-gray-600">
              <td className="px-2 py-1" colSpan={3}>{t("No tax charged")}</td>
              <td className={num}>{amount(c.untaxed, c.currency)}</td>
              <td className={num}>{amount(0, c.currency)}</td>
            </tr>
          ) : null}
          <tr className="border-t-2" style={{ borderColor: OLIVE }}>
            <td className="px-2 py-1 font-bold uppercase tracking-wider" colSpan={3} style={{ color: OLIVE }}>{t("Total")}</td>
            <td className={`${num} font-bold`}>{amount(c.net, c.currency)}</td>
            <td className={`${num} font-bold`}>{amount(c.tax, c.currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function noteText(t: T, n: TaxNote): string {
  const vars = { number: n.invoiceNumber, amount: n.amount === undefined ? "" : amount(n.amount, n.currency) };
  switch (n.kind) {
    case "no-tax":
      return fmt(t("{number}: no tax on this invoice. {amount} counted as untaxed turnover; no rate was imputed."), vars);
    case "zero-tax":
      return fmt(t("{number}: a tax rate is set but no line is taxable, so its tax is zero."), vars);
    case "unnamed-tax":
      return fmt(t("{number}: tax charged without a name."), vars);
    case "void":
      return fmt(t("{number}: voided, left out of every total."), vars);
    case "void-payment":
      return fmt(t("{number}: payment of {amount} on a voided invoice, left out."), vars);
    case "overpaid":
      return fmt(t("{number}: paid {amount} more than the invoice total; the excess carries no tax."), vars);
    case "no-total":
      return fmt(t("{number}: payment on an invoice with no total; no tax could be taken from it."), vars);
  }
}

export function TaxReportView({ t, report }: { t: T; report: TaxReport }) {
  const th = "px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider";
  const num = "px-2 py-1 text-right font-mono tabular-nums";
  return (
    <div className="space-y-6 text-gray-900">
      <section className="break-inside-auto">
        <SectionBar
          title={t("Invoiced basis")}
          sub={t("Invoices issued in the period, by issue date. Drafts and voided invoices are left out.")}
        />
        {report.invoiced.length === 0 ? (
          <div className="border border-t-0 px-3 py-4 text-sm text-gray-600" style={{ borderColor: OLIVE_2 }}>
            {t("No invoices were issued in this period.")}
          </div>
        ) : (
          report.invoiced.map((c) => <CurrencyBlock key={c.currency} t={t} c={c} basis="invoiced" />)
        )}
      </section>

      <section>
        <SectionBar
          title={t("Received basis")}
          sub={t("Payments received in the period, by payment date. The tax in each payment is its invoice’s tax, pro rata to what was paid.")}
        />
        {report.received.length === 0 ? (
          <div className="border border-t-0 px-3 py-4 text-sm text-gray-600" style={{ borderColor: OLIVE_2 }}>
            {t("No payments were received in this period.")}
          </div>
        ) : (
          report.received.map((c) => <CurrencyBlock key={c.currency} t={t} c={c} basis="received" />)
        )}
      </section>

      <section data-testid="tax-notes">
        <SectionBar title={t("Notes")} sub={t("What the totals above do not show on their own.")} />
        <ul className="list-disc space-y-1 border border-t-0 px-3 py-3 pl-7 text-[12px]" style={{ borderColor: OLIVE_2 }}>
          {report.excluded.drafts + report.excluded.voids > 0 ? (
            <li>
              {fmt(t("Left out of the invoiced basis: {drafts} draft(s) and {voids} voided invoice(s) dated in the period."), {
                drafts: report.excluded.drafts,
                voids: report.excluded.voids,
              })}
            </li>
          ) : null}
          {report.notes.map((n, i) => (
            <li key={`${n.kind}-${n.invoiceId}-${i}`}>{noteText(t, n)}</li>
          ))}
          <li className="text-gray-600">
            {t("Each currency is totalled on its own; nothing is converted. The figures are summed from what each invoice stores; this report applies no tax rules of its own.")}
          </li>
        </ul>
      </section>

      <section>
        <SectionBar title={t("Invoices issued")} sub={t("Invoiced basis, line by line.")} />
        <div className="overflow-x-auto border border-t-0" style={{ borderColor: OLIVE_2 }}>
          <table className="w-full border-collapse text-[11px]" data-testid="tax-invoices">
            <thead>
              <tr style={{ background: SAND, color: OLIVE }}>
                <th className={th}>{t("Date")}</th>
                <th className={th}>{t("Invoice")}</th>
                <th className={th}>{t("Client")}</th>
                <th className={th}>{t("Tax")}</th>
                <th className={`${th} text-right`}>{t("Net")}</th>
                <th className={`${th} text-right`}>{t("Tax")}</th>
                <th className={`${th} text-right`}>{t("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map((r) => (
                <tr key={r.id} className="break-inside-avoid border-b border-gray-200">
                  <td className="px-2 py-1 font-mono">{militaryDate(r.issueDate)}</td>
                  <td className="px-2 py-1 font-mono">{r.number}</td>
                  <td className="px-2 py-1">{r.clientName}</td>
                  <td className="px-2 py-1">{r.taxPercent > 0 ? taxLabel(t, r.taxName, r.taxPercent) : t("No tax charged")}</td>
                  <td className={num}>{amount(r.net, r.currency)}</td>
                  <td className={num}>{amount(r.tax, r.currency)}</td>
                  <td className={num}>{amount(r.gross, r.currency)}</td>
                </tr>
              ))}
              {report.invoices.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-gray-600" colSpan={7}>{t("No invoices were issued in this period.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionBar title={t("Payments received")} sub={t("Received basis, payment by payment.")} />
        <div className="overflow-x-auto border border-t-0" style={{ borderColor: OLIVE_2 }}>
          <table className="w-full border-collapse text-[11px]" data-testid="tax-payments">
            <thead>
              <tr style={{ background: SAND, color: OLIVE }}>
                <th className={th}>{t("Date")}</th>
                <th className={th}>{t("Invoice")}</th>
                <th className={th}>{t("Client")}</th>
                <th className={th}>{t("Tax")}</th>
                <th className={`${th} text-right`}>{t("Net")}</th>
                <th className={`${th} text-right`}>{t("Tax")}</th>
                <th className={`${th} text-right`}>{t("Received")}</th>
              </tr>
            </thead>
            <tbody>
              {report.payments.map((r, i) => (
                <tr key={`${r.invoiceId}-${r.paidAt}-${i}`} className="break-inside-avoid border-b border-gray-200">
                  <td className="px-2 py-1 font-mono">{militaryDate(r.paidAt)}</td>
                  <td className="px-2 py-1 font-mono">{r.invoiceNumber}</td>
                  <td className="px-2 py-1">{r.clientName}</td>
                  <td className="px-2 py-1">{r.taxPercent > 0 ? taxLabel(t, r.taxName, r.taxPercent) : t("No tax charged")}</td>
                  <td className={num}>{amount(r.net, r.currency)}</td>
                  <td className={num}>{amount(r.tax, r.currency)}</td>
                  <td className={num}>{amount(r.gross, r.currency)}</td>
                </tr>
              ))}
              {report.payments.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-gray-600" colSpan={7}>{t("No payments were received in this period.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
