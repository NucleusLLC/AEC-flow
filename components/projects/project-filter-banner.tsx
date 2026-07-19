import Link from "next/link";
import { Filter, X } from "lucide-react";

/** Shown atop a register when it's filtered to a single project (?project=…). */
export function ProjectFilterBanner({
  projectName,
  clearHref,
}: {
  projectName: string;
  clearHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2 text-fg">
        <Filter className="h-4 w-4 text-brand" />
        Filtered to <span className="font-semibold">{projectName}</span>
      </span>
      <Link
        href={clearHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        <X className="h-3.5 w-3.5" /> Clear filter
      </Link>
    </div>
  );
}
