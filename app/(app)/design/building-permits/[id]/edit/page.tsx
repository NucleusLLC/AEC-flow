import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PermitForm } from "@/components/building-permits/permit-form";
import { getBuildingPermit } from "@/lib/data/building-permits";

export const metadata: Metadata = { title: "Edit Building Permit · AEC-flow" };

export default async function EditBuildingPermitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const permit = await getBuildingPermit(id);
  if (!permit) notFound();
  const name = permit.permitNumber ?? permit.reference;

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/design/building-permits/${permit.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {name}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {name}</h2>
        <p className="text-sm text-muted">{permit.title}</p>
      </div>
      <PermitForm mode="edit" initial={permit} />
    </div>
  );
}
