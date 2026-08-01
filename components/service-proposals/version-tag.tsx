import { versionDisplay } from "@/lib/proposals/versioning";

/**
 * The proposal version, in Bright Turquoise (#08E8DE) — one definition so the app, the list
 * and the printed document cannot drift apart.
 *
 * The colour is set literally rather than through a theme token because it was asked for by
 * name. `print-color-adjust: exact` keeps it on paper: browsers drop background and light
 * text when printing unless told not to.
 *
 * Renders nothing when the proposal has no version, rather than inventing one.
 */
export const VERSION_COLOR = "#08E8DE";

export function VersionTag({
  label,
  className = "",
  title,
}: {
  label: string | null | undefined;
  className?: string;
  title?: string;
}) {
  const text = versionDisplay(label);
  if (!text) return null;
  return (
    <span
      className={`font-semibold tabular-nums ${className}`}
      style={{ color: VERSION_COLOR, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      title={title}
    >
      {text}
    </span>
  );
}
