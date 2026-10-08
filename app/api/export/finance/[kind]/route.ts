/**
 * Accounting export.
 *
 * GET /api/export/finance/<kind>?from=YYYY-MM-DD&to=YYYY-MM-DD  →  CSV attachment
 *   kind: invoices | invoice-lines | payments | time | expenses | tax
 *
 * Money, rates and other people's hours are not for every member: only the
 * people who approve time and expenses (Admin, Director, the founder — the
 * same `canManagePasswords` gate the finance data layer uses) may download.
 * Scoped to the caller's company by the tenant extension in lib/db.ts, like
 * every other read.
 */
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { listInvoicesForExport } from "@/lib/data/invoices";
import { listApprovedTimeForExport } from "@/lib/data/time-entries";
import { listApprovedExpensesForExport } from "@/lib/data/expenses";
import { buildTable, exportFilename, isExportKind, parseRange, toCsv } from "@/lib/finance/export";

function json(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isExportKind(kind)) return json(404, `Unknown export: ${kind}`);

  let actor;
  try {
    actor = await requireActor();
  } catch {
    return json(401, "You must be signed in.");
  }
  if (!canManagePasswords(actor.role, actor.isFounder)) {
    return json(403, "Only an Admin or a Director can export the accounts.");
  }

  const url = new URL(req.url);
  const parsed = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!parsed.ok) return json(400, parsed.error);
  const { range } = parsed;

  const needsInvoices =
    kind === "invoices" || kind === "invoice-lines" || kind === "payments" || kind === "tax";
  const [invoices, time, expenses] = await Promise.all([
    needsInvoices ? listInvoicesForExport() : Promise.resolve([]),
    kind === "time" ? listApprovedTimeForExport({ from: range.from ?? undefined, to: range.to ?? undefined }) : Promise.resolve([]),
    kind === "expenses" ? listApprovedExpensesForExport({ from: range.from ?? undefined, to: range.to ?? undefined }) : Promise.resolve([]),
  ]);

  const csv = toCsv(buildTable(kind, { invoices, time, expenses }, range));
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(kind, range, today)}"`,
      "Cache-Control": "no-store",
    },
  });
}
