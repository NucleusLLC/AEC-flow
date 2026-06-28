import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="max-w-md text-sm text-muted">{description}</p>
        <span className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Coming soon
        </span>
      </Card>
    </div>
  );
}
