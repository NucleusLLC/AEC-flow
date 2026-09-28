import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialForm } from "@/components/materials/material-form";
import { getProjects } from "@/lib/data/projects";
import { listPurchaseOrders } from "@/lib/data/procurement";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("New Selection")} · AEC-flow` };
}

export default async function NewMaterialPage() {
  const t = await getServerT();
  const [projects, pos] = await Promise.all([getProjects(), listPurchaseOrders()]);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const poOptions = pos.map((p) => ({ id: p.id, poNumber: p.poNumber, vendorName: p.vendorName }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link href="/materials" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        {t("Material Selection")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New Selection")}</h2>
        <p className="text-sm text-muted">{t("The selection tag is assigned on save. Extended cost calculates live.")}</p>
      </div>
      <MaterialForm projects={projectOptions} purchaseOrders={poOptions} mode="new" />
    </div>
  );
}
