import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

/**
 * Landing panel for a project section whose data lives in a global module
 * (Documents, Drawings, Estimates, Proposals). Until those modules are
 * project-scoped, this gives the workspace a consistent tab and a clear jump-off.
 */
export async function ProjectSectionPanel({
  icon,
  title,
  description,
  moduleLabel,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  moduleLabel: string;
  href: string;
}) {
  const t = await getServerT();
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-fg">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        {fmt(t("Open {module}"), { module: moduleLabel })}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
