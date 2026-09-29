/**
 * The on-screen preview of a General Document, drawn as the A4 sheet it prints
 * on: 210 × 297 proportions, white paper whatever the app theme, and page
 * margins in proportion (16mm of 210mm each side, as the print route's).
 *
 * The preview used to be a text box as wide as its column, which read as a
 * US Letter page or as no page at all. `aspect-ratio` sets the MINIMUM height
 * here — a longer document grows past one sheet instead of being cut off, and
 * the print route (PrintSurface, A4 portrait) paginates it for real.
 */
export function A4Sheet({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="space-y-1">
      <div
        className="mx-auto w-full max-w-[210mm] bg-white px-[7.6%] py-[7%] font-serif text-[13px] leading-relaxed text-gray-900 shadow-md ring-1 ring-black/10"
        style={{ aspectRatio: "210 / 297" }}
      >
        {children}
      </div>
      {label ? <p className="text-center text-[10px] uppercase tracking-wider text-faint">{label}</p> : null}
    </div>
  );
}
