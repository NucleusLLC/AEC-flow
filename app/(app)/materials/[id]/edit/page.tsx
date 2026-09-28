import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MaterialForm } from "@/components/materials/material-form";
import { getMaterialSelection } from "@/lib/data/materials";
import { getProjects } from "@/lib/data/projects";
import { listPurchaseOrders } from "@/lib/data/procurement";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Edit Selection")} · AEC-flow` };
}

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, projects, pos] = await Promise.all([
    getMaterialSelection(id),
    getProjects(),
    listPurchaseOrders(),
  ]);
  if (!item) notFound();
  const t = await getServerT();
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const poOptions = pos.map((p) => ({ id: p.id, poNumber: p.poNumber, vendorName: p.vendorName }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/materials/${item.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {item.tag}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{fmt(t("Edit {number}"), { number: item.tag })}</h2>
        <p className="text-sm text-muted">{t("Extended cost recalculates on save.")}</p>
      </div>
      <MaterialForm projects={projectOptions} purchaseOrders={poOptions} mode="edit" initial={item} />
    </div>
  );
}
