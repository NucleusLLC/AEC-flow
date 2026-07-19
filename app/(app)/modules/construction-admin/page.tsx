import { ShoppingCart, CircleDollarSign, ClipboardList, Boxes, CircleCheck, Clock } from "lucide-react";
import { ModuleDashboard } from "@/components/modules/module-dashboard";
import { StatTile, StatSection } from "@/components/modules/stat-tile";
import { procurementSummary } from "@/lib/data/procurement";
import { materialsSummary } from "@/lib/data/materials";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Module 2 Dashboard · AEC-flow" };

export default async function ConstructionAdminModuleDashboard() {
  const [po, ms] = await Promise.all([procurementSummary(), materialsSummary()]);
  const poMoney = (n: number) => formatCurrency(n, po.currency, { maximumFractionDigits: 0 });
  const msMoney = (n: number) => formatCurrency(n, ms.currency, { maximumFractionDigits: 0 });

  return (
    <ModuleDashboard moduleKey="construction_admin">
      <StatSection title="Procurement">
        <StatTile icon={ClipboardList} label="Purchase orders" value={String(po.total)} href="/procurement" />
        <StatTile icon={ShoppingCart} label="Open" value={String(po.open)} sub="draft · issued · partial" href="/procurement" />
        <StatTile icon={CircleDollarSign} label="Open value" value={poMoney(po.openValue)} href="/procurement" />
        <StatTile icon={CircleDollarSign} label="Received value" value={poMoney(po.receivedValue)} href="/procurement" />
      </StatSection>

      <StatSection title="Material selection">
        <StatTile icon={Boxes} label="Selections" value={String(ms.total)} href="/materials" />
        <StatTile icon={Clock} label="Pending" value={String(ms.pending)} sub="proposed · submitted" href="/materials" />
        <StatTile icon={CircleCheck} label="Approved+" value={String(ms.approved)} href="/materials" />
        <StatTile icon={CircleDollarSign} label="Selected value" value={msMoney(ms.selectedValue)} href="/materials" />
      </StatSection>
    </ModuleDashboard>
  );
}
