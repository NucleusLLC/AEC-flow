import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New Client · AEC-flow" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">New Client</h2>
        <p className="text-sm text-muted">Add a developer, government body, or private account.</p>
      </div>

      <ClientForm />
    </div>
  );
}
