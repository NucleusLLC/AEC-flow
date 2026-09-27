import { ShoppingCart, CircleDollarSign, ClipboardList, Boxes, CircleCheck, Clock } from "lucide-react";
import { ModuleDashboard } from "@/components/modules/module-dashboard";
import { StatTile, StatSection } from "@/components/modules/stat-tile";
import { procurementSummary } from "@/lib/data/procurement";
import { materialsSummary } from "@/lib/data/materials";
import { formatCurrency } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Module 2 Dashboard · AEC-flow" };

export default async function ConstructionAdminModuleDashboard() {
  const [po, ms] = await Promise.all([procurementSummary(), materialsSummary()]);
  const t = await getServerT();
  const poMoney = (n: number) => formatCurrency(n, po.currency, { maximumFractionDigits: 0 });
  const msMoney = (n: number) => formatCurrency(n, ms.currency, { maximumFractionDigits: 0 });

  return (
    <ModuleDashboard moduleKey="construction_admin">
      <StatSection title={t("Procurement")}>
        <StatTile icon={ClipboardList} label={t("Purchase orders")} value={String(po.total)} href="/procurement" />
        <StatTile icon={ShoppingCart} label={t("Open")} value={String(po.open)} sub={t("draft · issued · partial")} href="/procurement" />
        <StatTile icon={CircleDollarSign} label={t("Open value")} value={poMoney(po.openValue)} href="/procurement" />
        <StatTile icon={CircleDollarSign} label={t("Received value")} value={poMoney(po.receivedValue)} href="/procurement" />
      </StatSection>

      <StatSection title={t("Material selection")}>
        <StatTile icon={Boxes} label={t("Selections")} value={String(ms.total)} href="/materials" />
        <StatTile icon={Clock} label={t("Pending")} value={String(ms.pending)} sub={t("proposed · submitted")} href="/materials" />
        <StatTile icon={CircleCheck} label={t("Approved+")} value={String(ms.approved)} href="/materials" />
        <StatTile icon={CircleDollarSign} label={t("Selected value")} value={msMoney(ms.selectedValue)} href="/materials" />
      </StatSection>
    </ModuleDashboard>
  );
}
