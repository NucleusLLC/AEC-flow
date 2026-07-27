/**
 * DocumentLetterhead — the shared header for every printed / PDF document.
 *
 * Arranges the practice logo (BrandMark) and a document-specific `details` block
 * according to the org-wide logo placement configured in Settings → Practice
 * (position: left | center | right, and size in px). Presentational, no hooks, so
 * it renders identically in server print routes and client preview modals.
 *
 * When a caller passes no logo — preview modals nested inside client-only views —
 * it falls back to the identity seeded by <FirmIdentityInit>, so a preview shows
 * the same uploaded logo the printed document will carry. Each field falls back
 * independently, so passing only a data URL still inherits the configured
 * position and size.
 */
import { BrandMark } from "@/components/print/brand-mark";
import { firmLogo } from "@/lib/firm-identity";

export type LetterheadLogo = {
  dataUrl?: string | null;
  position?: "left" | "center" | "right";
  size?: number;
};

export function DocumentLetterhead({
  logo,
  details,
  name,
  tagline,
  borderClass = "border-b-2 border-gray-900 pb-5",
}: {
  logo?: LetterheadLogo;
  /** Document-specific block (title, ref number, date, …) shown beside/below the logo. */
  details?: React.ReactNode;
  name?: string;
  tagline?: string;
  borderClass?: string;
}) {
  const resolved = firmLogo(logo);
  const position = resolved.position;
  const mark = <BrandMark logoDataUrl={resolved.dataUrl} size={resolved.size} name={name} tagline={tagline} />;

  if (position === "center") {
    return (
      <div className={borderClass}>
        <div className="flex justify-center">{mark}</div>
        {details ? <div className="mt-3 flex items-start justify-between gap-4">{details}</div> : null}
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-4 ${position === "right" ? "flex-row-reverse" : ""} ${borderClass}`}>
      {mark}
      {details}
    </div>
  );
}
