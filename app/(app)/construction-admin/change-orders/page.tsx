import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { ChangeOrderRegister } from "@/components/construction-admin/change-order-register";
import { listChangeOrders } from "@/lib/data/ca/change-orders";

export const metadata = { title: "Change Orders · AEC-flow" };

export default async function ChangeOrdersPage() {
  const changeOrders = await listChangeOrders();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Change Order Register</h2>
          <p className="text-sm text-muted">Meerwerk / Minderwerk — scope, cost and schedule changes against the contract.</p>
        </div>
        <Link
          href="/construction-admin/change-orders/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Change Order
        </Link>
      </div>
      <CaSubNav />
      <ChangeOrderRegister changeOrders={changeOrders} />
    </div>
  );
}
