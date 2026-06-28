import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChangeOrderForm } from "@/components/construction-admin/change-order-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Change Order · ZenArch" };

export default async function NewChangeOrderPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name, value: p.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/construction-admin/change-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Change Orders
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Change Order</h2>
        <p className="text-sm text-muted">
          Capture costs and markups — the total and revised contract value calculate live and are
          saved through the API.
        </p>
      </div>
      <ChangeOrderForm projects={options} mode="new" />
    </div>
  );
}
