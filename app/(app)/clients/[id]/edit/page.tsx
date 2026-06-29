import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClientForm, type ClientFormValues } from "@/components/clients/client-form";
import { getClient } from "@/lib/data/clients";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client ? `Edit ${client.name} · AEC-flow` : "Edit Client · AEC-flow" };
}

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const primary = client.addresses.find((a) => a.isPrimary) ?? client.addresses[0];

  const initial: ClientFormValues = {
    name: client.name,
    companyName: client.companyName ?? "",
    contactPerson: client.contactPerson ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {client.name}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Edit client</h2>
        <p className="text-sm text-muted">Update {client.name}&apos;s details, contact, and address.</p>
      </div>

      <ClientForm mode="edit" clientId={client.id} initial={initial} />
    </div>
  );
}
