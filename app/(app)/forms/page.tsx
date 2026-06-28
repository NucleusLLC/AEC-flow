import { Plus } from "lucide-react";
import { FormsView } from "@/components/forms/forms-view";
import { getForms } from "@/lib/data/forms";

export const metadata = { title: "Forms · ZenArch" };

export default async function FormsPage() {
  const forms = await getForms();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Forms</h2>
          <p className="text-sm text-muted">
            Standard site & administration form templates — RFIs, instructions, inspections, variations. Preview any form.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New form
        </button>
      </div>

      <FormsView forms={forms} />
    </div>
  );
}
