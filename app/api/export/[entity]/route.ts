/**
 * CSV export of a core dataset, straight from the live database.
 *
 * GET /api/export/<entity>  →  text/csv attachment.
 * Columns are derived generically from the getter's row objects, so this stays
 * correct as the data-layer shapes evolve. Server route (safe to import the
 * Prisma-backed data layers directly).
 */
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getProposals } from "@/lib/data/proposals";
import { getOrders } from "@/lib/data/orders";
import { getTeam } from "@/lib/data/team";
import { getLeaveRequests } from "@/lib/data/leave";
import { requireActor } from "@/lib/server/actor";

const GETTERS: Record<string, () => Promise<unknown[]>> = {
  clients: getClients,
  projects: getProjects,
  proposals: getProposals,
  orders: getOrders,
  team: getTeam,
  leave: getLeaveRequests,
};

export const EXPORTABLE = Object.keys(GETTERS);

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v)
    ? v.join("; ")
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvCell(r[c])).join(","));
  return [header, ...body].join("\r\n");
}

export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  // Checked here as well as in proxy.ts: with AUTH_ENFORCE off, the team
  // export fell back to the founder company's directory for anyone.
  try {
    await requireActor();
  } catch {
    return new Response(JSON.stringify({ error: "You must be signed in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const getter = GETTERS[entity];
  if (!getter) {
    return new Response(JSON.stringify({ error: `Unknown export: ${entity}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rows = (await getter()) as Record<string, unknown>[];
    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
