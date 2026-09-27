import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderForm } from "@/components/orders/order-form";
import { getClients } from "@/lib/data/clients";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("New Order")} · AEC-flow` };
}

export default async function NewOrderPage() {
  const t = await getServerT();
  const clients = await getClients();
  const clientNames = clients.map((c) => c.name);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Orders")}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New Order")}</h2>
        <p className="text-sm text-muted">{t("Create a confirmed engagement, usually from an approved proposal.")}</p>
      </div>

      <OrderForm clients={clientNames} />
    </div>
  );
}
