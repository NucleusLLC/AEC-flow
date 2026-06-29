import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClientsView } from "@/components/clients/clients-view";
import { getClients, summarizeClients } from "@/lib/data/clients";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Clients · AEC-flow" };

export default async function ClientsPage() {
  const clients = await getClients();
  const summary = summarizeClients(clients);

  const tiles = [
    { label: "Total Clients", value: String(summary.total), hint: "across all segments" },
    { label: "Active", value: String(summary.active), hint: `${summary.prospects} prospects in pipeline` },
    { label: "Open Pipeline", value: formatCurrencyCompact(summary.pipelineValue), hint: "in live proposals" },
    { label: "Won to Date", value: formatCurrencyCompact(summary.lifetimeValue), hint: "approved proposal value" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Clients</h2>
          <p className="text-sm text-muted">
            Developers, government bodies, and private accounts — and their full proposal-to-project history.
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Client
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t.value}</div>
            <div className="mt-1 text-xs text-faint">{t.hint}</div>
          </Card>
        ))}
      </div>

      <ClientsView clients={clients} />
    </div>
  );
}
