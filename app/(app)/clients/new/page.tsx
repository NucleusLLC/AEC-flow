import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("New Client")} · AEC-flow` };
}

export default async function NewClientPage() {
  const t = await getServerT();
  return (
    <div className="w-full space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Clients")}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New Client")}</h2>
        <p className="text-sm text-muted">{t("Add a developer, government body, or private account.")}</p>
      </div>

      <ClientForm />
    </div>
  );
}
