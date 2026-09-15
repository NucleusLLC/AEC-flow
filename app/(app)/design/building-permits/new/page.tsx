import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PermitForm } from "@/components/building-permits/permit-form";

export const metadata: Metadata = { title: "New Building Permit · AEC-flow" };

export default function NewBuildingPermitPage() {
  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/design/building-permits"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Building Permits
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New building permit</h2>
        <p className="text-sm text-muted">
          Leave the reference blank and the next BP number is assigned on save. Versions and
          letters are added on the case file once it exists.
        </p>
      </div>
      <PermitForm mode="new" />
    </div>
  );
}
