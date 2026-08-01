import { versionDisplay } from "@/lib/proposals/versioning";
import { VERSION_COLOR } from "@/lib/version";

/**
 * The proposal version, in Bright Turquoise (#08E8DE) — one definition so the app, the list
 * and the printed document cannot drift apart.
 *
 * The colour comes from lib/version (VERSION_COLOR), the same constant the sidebar's
 * deployed-build label uses, so every version in the product is the one colour. `print-color-adjust: exact` keeps it on paper: browsers drop background and light
 * text when printing unless told not to.
 *
 * Renders nothing when the proposal has no version, rather than inventing one.
 */
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
