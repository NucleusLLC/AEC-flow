import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BoqImport } from "@/components/imports/boq-import";
import { getImportPriceBook, listImportTargets } from "@/lib/data/boq-import";
import { currencyOptions, getSystemCurrency } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Import from MEPflow · AEC-flow" };

/**
 * Estimates › Import from MEPflow. A cadgen.boq/1 file (the Pool & Jacuzzi
 * generator's "AEC-flow cost estimate / purchase order" export) becomes a draft
 * cost estimate with one section per category, or a draft purchase order.
 */
export default async function ImportFromMepflowPage() {
  const [{ projects, clients }, priceBook, t] = await Promise.all([listImportTargets(), getImportPriceBook(), getServerT()]);
  const currencies = currencyOptions(["USD", "AWG", "ANG", "EUR", "AED"]).filter((c, i, a) => a.indexOf(c) === i);
  return (
    <div className="w-full max-w-6xl space-y-5">
      <Link href="/estimates" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Cost Estimation")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Import from MEPflow")}</h2>
        <p className="text-sm text-muted">
          {t("Turn a MEPflow bill of quantities into a draft cost estimate — one section per category, priced from your price book where the codes match — or into a draft purchase order.")}
        </p>
      </div>
      <BoqImport
        projects={projects}
        clients={clients}
        priceBook={priceBook}
        currencies={currencies}
        defaultCurrency={getSystemCurrency()}
      />
    </div>
  );
}
