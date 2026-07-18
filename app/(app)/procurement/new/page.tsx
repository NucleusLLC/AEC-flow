import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PurchaseOrderForm } from "@/components/procurement/purchase-order-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Purchase Order · AEC-flow" };

export default async function NewPurchaseOrderPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/procurement"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Procurement
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Purchase Order</h2>
        <p className="text-sm text-muted">
          The PO number is assigned on save. Line totals and the order total calculate live.
        </p>
      </div>
      <PurchaseOrderForm projects={options} mode="new" />
    </div>
  );
}
