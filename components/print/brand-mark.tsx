/**
 * BrandMark — the left side of a document letterhead.
 *
 * Presentational, no hooks, so it renders identically in server print routes and
 * in client preview modals. When the practice has uploaded a logo (saved in
 * Settings → Practice), the logo image is shown; otherwise it falls back to a
 * wordmark of the practice's own name + tagline.
 *
 * The name resolves through `firmName()` so an unconfigured company gets the
 * neutral product wordmark rather than another firm's name — this used to be a
 * hardcoded "ZenArch", which put the founder company's identity on every
 * tenant's documents.
 *
 * The logo is a base64 data URL of arbitrary dimensions, so a plain <img> is the
 * right fit here (next/image needs known sizes and doesn't help in print).
 */
import { firmName } from "@/lib/firm-identity";

export function BrandMark({
  logoDataUrl,
  name,
  tagline = "Architecture · Engineering · Project Management",
  size = 56,
}: {
  logoDataUrl?: string | null;
  name?: string;
  tagline?: string;
  /** Rendered logo height in px (configurable via Settings → Practice → Document Logo). */
  size?: number;
}) {
  const firm = firmName(name);
  if (logoDataUrl) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, arbitrary size, print context */}
        <img src={logoDataUrl} alt={firm} style={{ height: size }} className="max-w-[340px] object-contain" />
      </div>
    );
  }
  return (
    <div>
      <div className="text-2xl font-bold tracking-tight text-gray-900">{firm}</div>
      <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-gray-500">{tagline}</div>
    </div>
  );
}
