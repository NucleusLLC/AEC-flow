import { ClientImport } from "@/components/imports/client-import";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Import Data · AEC-flow" };

export default async function ImportsPage() {
  const t = await getServerT();
  const [tipBefore, tipAfter] = t(
    "Tip: the column headers from {source} are compatible, so you can export, edit, and re-import.",
  ).split("{source}");
  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Import Clients")}</h2>
        <p className="text-sm text-muted">
          {t("Bulk-add clients from a CSV (e.g. exported from a spreadsheet or another system). Each row becomes a client record in the database.")}
        </p>
      </div>

      <ClientImport />

      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-muted">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{t("Columns")}</h3>
        <ul className="space-y-1">
          <li><code className="text-fg">name</code> — {t("required.")}</li>
          <li><code className="text-fg">companyName</code>, <code className="text-fg">contactPerson</code>, <code className="text-fg">email</code>, <code className="text-fg">phone</code>, <code className="text-fg">website</code>, <code className="text-fg">taxNumber</code>, <code className="text-fg">notes</code> — {t("optional.")}</li>
          <li><code className="text-fg">type</code> — {t("Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (defaults to Private).")}</li>
          <li><code className="text-fg">status</code> — {t("Active / Inactive / Prospect (defaults to Active).")}</li>
          <li><code className="text-fg">tags</code> — {t("separated by")} <code className="text-fg">;</code></li>
        </ul>
        <p className="mt-3 text-xs text-faint">
          {tipBefore}<strong>{t("Data Export")} → {t("Clients")}</strong>{tipAfter}
        </p>
      </div>
    </div>
  );
}
