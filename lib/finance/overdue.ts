/**
 * The overdue chase list: who owes the practice money past its due date, by
 * client, and the polite reminder to send them. PURE — no database, no clock
 * (`today` is passed in), no formatting decisions the caller cannot override.
 *
 * WHAT COUNTS AS OVERDUE is `receivablesSummary`'s rule (lib/finance/calc.ts),
 * through the same `daysOverdue`: an issued or part-paid invoice with money
 * still outstanding whose due date is before today. Drafts have not been asked
 * for and voids have been withdrawn, so neither is ever chased; a paid invoice
 * whose due date has passed is history, not a debt.
 *
 * ONE GROUP PER CLIENT PER CURRENCY. A client billed in AWG and in USD owes two
 * amounts, not one: a total across currencies is a number with no meaning
 * (docs/finance/SPEC.md §1), so the two are two groups and two reminders.
 *
 * Money through lib/proposals/engine/money.ts only.
 *
 * NOTHING IS SENT. The reminder is text for a person to read, adjust and paste
 * into an email or a WhatsApp message themselves.
 */
import { daysOverdue } from "@/lib/finance/calc";
import { add, fromMajor, toMajor, zero } from "@/lib/proposals/engine/money";
import type { InvoiceStatus } from "@/lib/finance/types";

export type ChaseInvoiceInput = {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  clientId: string | null;
  clientName: string;
  projectName?: string | null;
  issueDate?: string | null;
  dueDate: string | null;
  total: number;
  outstanding: number;
};

export type ChaseInvoice = {
  id: string;
  number: string;
  projectName: string | null;
  issueDate: string | null;
  dueDate: string;
  total: number;
  outstanding: number;
  daysOverdue: number;
};

export type ChaseGroup = {
  /** Stable across renders: the client and the currency. */
  key: string;
  clientId: string | null;
  clientName: string;
  currency: string;
  /** Most overdue first. */
  invoices: ChaseInvoice[];
  outstanding: number;
  /** The oldest invoice's days overdue. */
  maxDaysOverdue: number;
};

export type ChaseCurrencyTotal = { currency: string; outstanding: number; invoices: number; clients: number };

export type OverdueChase = {
  groups: ChaseGroup[];
  /** One per currency, never one across them. */
  totals: ChaseCurrencyTotal[];
};

function clientKey(inv: Pick<ChaseInvoiceInput, "clientId" | "clientName">): string {
  if (inv.clientId) return `id:${inv.clientId}`;
  return `name:${String(inv.clientName ?? "").trim().toLowerCase()}`;
}

/** True when this invoice belongs on the chase list on `today` (YYYY-MM-DD). */
export function isOverdue(inv: ChaseInvoiceInput, today: string): boolean {
  if (inv.status === "DRAFT" || inv.status === "VOID") return false;
  if (fromMajor(inv.outstanding, inv.currency).minor <= 0) return false;
  return daysOverdue({ dueDate: inv.dueDate, outstanding: inv.outstanding }, today) !== null;
}

export function overdueChase(invoices: readonly ChaseInvoiceInput[], today: string): OverdueChase {
  const groups = new Map<string, ChaseGroup>();

  for (const inv of invoices) {
    if (!isOverdue(inv, today)) continue;
    const days = daysOverdue({ dueDate: inv.dueDate, outstanding: inv.outstanding }, today)!;
    const key = `${clientKey(inv)}|${inv.currency}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        clientId: inv.clientId,
        clientName: String(inv.clientName ?? "").trim() || "—",
        currency: inv.currency,
        invoices: [],
        outstanding: 0,
        maxDaysOverdue: 0,
      };
      groups.set(key, group);
    }
    group.invoices.push({
      id: inv.id,
      number: inv.number,
      projectName: inv.projectName ?? null,
      issueDate: inv.issueDate ?? null,
      dueDate: String(inv.dueDate).slice(0, 10),
      total: inv.total,
      outstanding: toMajor(fromMajor(inv.outstanding, inv.currency)),
      daysOverdue: days,
    });
    group.outstanding = toMajor(add(fromMajor(group.outstanding, inv.currency), fromMajor(inv.outstanding, inv.currency)));
    group.maxDaysOverdue = Math.max(group.maxDaysOverdue, days);
  }

  const list = [...groups.values()];
  for (const g of list) {
    g.invoices.sort((a, b) => b.daysOverdue - a.daysOverdue || a.number.localeCompare(b.number));
  }
  // Oldest debt first; then the bigger one, compared only within a currency.
  list.sort(
    (a, b) =>
      b.maxDaysOverdue - a.maxDaysOverdue ||
      (a.currency === b.currency ? b.outstanding - a.outstanding : a.currency.localeCompare(b.currency)) ||
      a.clientName.localeCompare(b.clientName),
  );

  const totals = new Map<string, { outstanding: ReturnType<typeof zero>; invoices: number; clients: number }>();
  for (const g of list) {
    const t = totals.get(g.currency) ?? { outstanding: zero(g.currency), invoices: 0, clients: 0 };
    t.outstanding = add(t.outstanding, fromMajor(g.outstanding, g.currency));
    t.invoices += g.invoices.length;
    t.clients += 1;
    totals.set(g.currency, t);
  }

  return {
    groups: list,
    totals: [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, t]) => ({
        currency,
        outstanding: toMajor(t.outstanding),
        invoices: t.invoices,
        clients: t.clients,
      })),
  };
}

// ── The reminder ───────────────────────────────────────────────────────────

/** The English sentences of the reminder — also the i18n keys. */
export const REMINDER_TEXT = {
  greeting: "Dear {client},",
  opening: "We hope all is well.",
  single:
    "This is a friendly reminder that invoice {number}, due on {dueDate}, still has {amount} outstanding.",
  multiple: "This is a friendly reminder that the following invoices are past their due date:",
  line: "Invoice {number}: {amount} outstanding, due on {dueDate}",
  total: "Total outstanding: {amount}",
  alreadyPaid: "If payment has already been made, thank you, and please disregard this message.",
  request: "Otherwise, we would be grateful if you could arrange payment at your earliest convenience.",
  questions: "If you have any questions about the invoice, just let us know.",
  closing: "Kind regards,",
} as const;

export type ReminderFormat = {
  /** Translate one of REMINDER_TEXT's sentences. Identity by default. */
  t?: (s: string) => string;
  /** Format an amount in its currency, e.g. "AWG 1,250.00". */
  money: (amount: number, currency: string) => string;
  /** Format a YYYY-MM-DD date. Identity by default. */
  date?: (ymd: string) => string;
  /** Who signs it — a person, a practice, or both. Left off when blank. */
  sender?: string | null;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k]! : m));
}

/**
 * The reminder text for one client in one currency — all of that client's
 * overdue invoices, or just the ones passed in `onlyInvoiceIds`.
 *
 * It names the invoice(s), the amount still outstanding (not the original
 * total: a part-paid invoice is chased for the balance) and the due date, and
 * it is polite — it allows that the money may already be on its way.
 */
export function reminderText(
  group: ChaseGroup,
  format: ReminderFormat,
  onlyInvoiceIds?: readonly string[],
): string {
  const t = format.t ?? ((s: string) => s);
  const date = format.date ?? ((s: string) => s);
  const money = (n: number) => format.money(n, group.currency);

  const invoices = onlyInvoiceIds
    ? group.invoices.filter((i) => onlyInvoiceIds.includes(i.id))
    : group.invoices;
  if (invoices.length === 0) return "";

  const parts: string[] = [fill(t(REMINDER_TEXT.greeting), { client: group.clientName }), ""];
  parts.push(t(REMINDER_TEXT.opening));

  if (invoices.length === 1) {
    const inv = invoices[0]!;
    parts.push(
      fill(t(REMINDER_TEXT.single), {
        number: inv.number,
        dueDate: date(inv.dueDate),
        amount: money(inv.outstanding),
      }),
    );
  } else {
    parts.push(t(REMINDER_TEXT.multiple), "");
    let total = zero(group.currency);
    for (const inv of invoices) {
      parts.push(
        `- ${fill(t(REMINDER_TEXT.line), {
          number: inv.number,
          amount: money(inv.outstanding),
          dueDate: date(inv.dueDate),
        })}`,
      );
      total = add(total, fromMajor(inv.outstanding, group.currency));
    }
    parts.push("", fill(t(REMINDER_TEXT.total), { amount: money(toMajor(total)) }));
  }

  parts.push(
    "",
    t(REMINDER_TEXT.alreadyPaid),
    t(REMINDER_TEXT.request),
    t(REMINDER_TEXT.questions),
    "",
    t(REMINDER_TEXT.closing),
  );
  const sender = String(format.sender ?? "").trim();
  if (sender) parts.push(sender);

  return parts.join("\n");
}
