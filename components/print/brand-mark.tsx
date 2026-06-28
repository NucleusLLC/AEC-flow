/**
 * BrandMark — the left side of a document letterhead.
 *
 * Presentational, no hooks, so it renders identically in server print routes and
 * in client preview modals. When the practice has uploaded a logo (saved in
 * Settings → Practice), the logo image is shown; otherwise it falls back to the
 * "ZenArch" wordmark + tagline so existing documents look unchanged.
 *
 * The logo is a base64 data URL of arbitrary dimensions, so a plain <img> is the
 * right fit here (next/image needs known sizes and doesn't help in print).
 */
export function BrandMark({
  logoDataUrl,
  name = "ZenArch",
  tagline = "Architecture · Engineering · Project Management",
  size = 56,
}: {
  logoDataUrl?: string | null;
  name?: string;
  tagline?: string;
  /** Rendered logo height in px (configurable via Settings → Practice → Document Logo). */
  size?: number;
}) {
  if (logoDataUrl) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, arbitrary size, print context */}
        <img src={logoDataUrl} alt={name} style={{ height: size }} className="max-w-[340px] object-contain" />
      </div>
    );
  }
  return (
    <div>
      <div className="text-2xl font-bold tracking-tight text-gray-900">{name}</div>
      <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-gray-500">{tagline}</div>
    </div>
  );
}
