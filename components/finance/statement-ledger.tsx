/**
 * One currency's Statement of Account ledger: opening balance, each invoice as
 * a debit and each payment as a credit with the running balance, the closing
 * balance, and the ageing of what is owed at the end date.
 *
 * Shared by the statement screen and its printed sheet so the two cannot show
 * different figures. Server-renderable (no hooks): the caller hands in its own
 * translate function.
 */
import Link from "next/link";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { fmt } from "@/lib/i18n/format";
import { AGEING_BUCKETS, type Statement } from "@/lib/finance/receivables";

const BUCKET_LABEL: Record<string, string> = {
  "1-30": "1–30",
  "31-60": "31–60",
  "61-90": "61–90",
  "90+": "90+",
};

export function StatementLedger({
  statement: s,
  t,
  variant,
}: {
  statement: Statement;
  t: (key: string) => string;
  variant: "screen" | "print";
}) {
  const print = variant === "print";
  const money = (n: number) =>
    formatCurrency(n, s.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const c = print
    ? {
        table: "w-full border-collapse text-[10px]",
        head: "border-b border-gray-400 text-left text-[9px] uppercase tracking-wide text-gray-500",
        row: "break-inside-avoid border-b border-gray-200 align-top",
        muted: "text-gray-500",
        strong: "text-gray-900",
        rule: "border-t border-gray-900",
        cell: "py-1 px-1.5",
        link: "",
        strip: "mt-3 grid grid-cols-6 gap-0 border border-gray-300 text-[9px] break-inside-avoid",
        stripCell: "border-r border-gray-300 px-1.5 py-1 last:border-r-0",
        late: "text-gray-900 font-semibold",
      }
    : {
        table: "w-full min-w-[860px] text-sm",
        head: "text-left text-[11px] uppercase tracking-wide text-faint",
        row: "border-b border-border/60 align-top even:bg-surface-2/40",
        muted: "text-muted",
        strong: "text-fg",
        rule: "border-t-2 border-border",
        cell: "py-2 px-3",
        link: "text-brand hover:underline",
        strip: "mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs sm:grid-cols-6",
        stripCell: "bg-surface px-3 py-2",
        late: "text-red-600 font-semibold",
      };

  const bal = (n: number) => (n < 0 ? `${money(-n)} ${t("CR")}` : money(n));

  return (
    <div>
      <div className={print ? "overflow-visible" : "overflow-x-auto pb-1"}>
        <table className={c.table}>
          <thead>
            <tr className={c.head}>
              <th className={`${c.cell} font-medium`}>{t("Date")}</th>
              <th className={`${c.cell} font-medium`}>{t("Detail")}</th>
              <th className={`${c.cell} font-medium`}>{t("Reference")}</th>
              <th className={`${c.cell} font-medium`}>{t("Due")}</th>
              <th className={`${c.cell} text-right font-medium`}>{t("Debit")}</th>
              <th className={`${c.cell} text-right font-medium`}>{t("Credit")}</th>
              <th className={`${c.cell} text-right font-medium`}>{t("Balance")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className={c.row}>
              <td className={`${c.cell} whitespace-nowrap font-mono ${c.muted}`}>{militaryDate(s.from)}</td>
              <td className={`${c.cell} font-semibold uppercase ${c.strong}`} colSpan={5}>
                {t("Opening balance")}
              </td>
              <td className={`${c.cell} text-right font-mono font-semibold tabular-nums ${c.strong}`}>
                {bal(s.opening)}
              </td>
            </tr>
            {s.entries.map((e, i) => (
              <tr key={`${e.kind}-${e.invoiceId}-${i}`} className={c.row}>
                <td className={`${c.cell} whitespace-nowrap font-mono ${c.muted}`}>{militaryDate(e.date)}</td>
                <td className={`${c.cell} ${c.strong}`}>
                  {e.kind === "invoice" ? t("Invoice") : t("Payment")}{" "}
                  {print ? (
                    <span className="font-mono">{e.invoiceNumber}</span>
                  ) : (
                    <Link href={`/finance/invoices/${e.invoiceId}`} className={`font-mono text-xs ${c.link}`}>
                      {e.invoiceNumber}
                    </Link>
                  )}
                </td>
                <td className={`${c.cell} font-mono ${c.muted}`}>{e.reference ?? ""}</td>
                <td className={`${c.cell} whitespace-nowrap font-mono ${c.muted}`}>
                  {e.kind === "invoice" ? militaryDate(e.dueDate) : ""}
                </td>
                <td className={`${c.cell} text-right font-mono tabular-nums ${c.strong}`}>
                  {e.debit ? money(e.debit) : ""}
                </td>
                <td className={`${c.cell} text-right font-mono tabular-nums ${c.strong}`}>
                  {e.credit ? money(e.credit) : ""}
                </td>
                <td className={`${c.cell} text-right font-mono tabular-nums ${c.strong}`}>{bal(e.balance)}</td>
              </tr>
            ))}
            {s.entries.length === 0 ? (
              <tr className={c.row}>
                <td className={`${c.cell} ${c.muted}`} colSpan={7}>
                  {t("No invoices or payments in this period.")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className={`${c.rule} break-inside-avoid`}>
              <td className={`${c.cell} whitespace-nowrap font-mono ${c.muted}`}>{militaryDate(s.to)}</td>
              <td className={`${c.cell} font-semibold uppercase ${c.strong}`} colSpan={3}>
                {t("Closing balance")}
              </td>
              <td className={`${c.cell} text-right font-mono tabular-nums ${c.muted}`}>{money(s.debits)}</td>
              <td className={`${c.cell} text-right font-mono tabular-nums ${c.muted}`}>{money(s.credits)}</td>
              <td className={`${c.cell} text-right font-mono font-bold tabular-nums ${c.strong}`}>
                {bal(s.closing)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={c.strip}>
        {AGEING_BUCKETS.map((b) => (
          <div key={b} className={c.stripCell}>
            <div className={`uppercase tracking-wide ${c.muted}`}>
              {b === "current" ? t("Current") : fmt(t("{count} days"), { count: BUCKET_LABEL[b] })}
            </div>
            <div
              className={`font-mono tabular-nums ${
                s.ageing[b] > 0 && (b === "61-90" || b === "90+") ? c.late : c.strong
              }`}
            >
              {money(s.ageing[b])}
            </div>
          </div>
        ))}
        <div className={c.stripCell}>
          <div className={`uppercase tracking-wide ${c.muted}`}>{t("Total due")}</div>
          <div className={`font-mono font-bold tabular-nums ${c.strong}`}>{money(s.owed)}</div>
        </div>
      </div>
      {s.credit > 0 ? (
        <p className={`mt-1 text-[11px] ${c.muted}`}>
          {fmt(t("Unallocated credit of {amount} (paid beyond what was billed)."), { amount: money(s.credit) })}
        </p>
      ) : null}
    </div>
  );
}
