import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClientForm, type ClientFormValues } from "@/components/clients/client-form";
import { getClient } from "@/lib/data/clients";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  const t = await getServerT();
  return { title: client ? `${fmt(t("Edit {name}"), { name: client.name })} · AEC-flow` : `${t("Edit Client")} · AEC-flow` };
}

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const t = await getServerT();

  const primary = client.addresses.find((a) => a.isPrimary) ?? client.addresses[0];

  const initial: ClientFormValues = {
    name: client.name,
    companyName: client.companyName ?? "",
    contactPerson: client.contactPerson ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    mobile: client.mobile ?? "",
    website: client.website ?? "",
    taxNumber: client.taxNumber ?? "",
    type: client.type,
    status: client.status,
    tags: client.tags.join(", "),
    notes: client.notes ?? "",
    addressLabel: primary?.label ?? "",
    line1: primary?.line1 ?? "",
    city: primary?.city ?? "",
    emirate: primary?.emirate ?? "",
    country: primary?.country ?? "UAE",
  };

  const backHref = `/clients/${client.id}`;

  return (
    <div className="w-full space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {client.name}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Edit client")}</h2>
        <p className="text-sm text-muted">{fmt(t("Update {name}’s details, contact, and address."), { name: client.name })}</p>
      </div>

      <ClientForm mode="edit" clientId={client.id} initial={initial} />
    </div>
  );
}
