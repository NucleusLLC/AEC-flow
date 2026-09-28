import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PermitForm } from "@/components/building-permits/permit-form";
import { getBuildingPermit } from "@/lib/data/building-permits";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Edit building permit")} · AEC-flow` };
}

export default async function EditBuildingPermitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const permit = await getBuildingPermit(id);
  if (!permit) notFound();
  const name = permit.permitNumber ?? permit.reference;
  const t = await getServerT();

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
        <h2 className="text-xl font-semibold text-fg">{fmt(t("Edit {name}"), { name })}</h2>
        <p className="text-sm text-muted">{permit.title}</p>
      </div>
      <PermitForm mode="edit" initial={permit} />
    </div>
  );
}
