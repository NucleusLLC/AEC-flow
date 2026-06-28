import { ClientImport } from "@/components/imports/client-import";

export const metadata = { title: "Import Data · ZenArch" };

export default function ImportsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Import Clients</h2>
        <p className="text-sm text-muted">
          Bulk-add clients from a CSV (e.g. exported from a spreadsheet or another system). Each
          row becomes a client record in the database.
        </p>
      </div>

      <ClientImport />

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-muted">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Columns</h3>
        <ul className="space-y-1">
          <li><code className="text-fg">name</code> — required.</li>
          <li><code className="text-fg">companyName</code>, <code className="text-fg">contactPerson</code>, <code className="text-fg">email</code>, <code className="text-fg">phone</code>, <code className="text-fg">website</code>, <code className="text-fg">taxNumber</code>, <code className="text-fg">notes</code> — optional.</li>
          <li><code className="text-fg">type</code> — Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (defaults to Private).</li>
          <li><code className="text-fg">status</code> — Active / Inactive / Prospect (defaults to Active).</li>
          <li><code className="text-fg">tags</code> — separated by <code className="text-fg">;</code></li>
        </ul>
        <p className="mt-3 text-xs text-faint">
          Tip: the column headers from <strong>Data Export → Clients</strong> are compatible, so you can export, edit, and re-import.
        </p>
      </div>
    </div>
  );
}
