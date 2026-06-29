// Print routes render letterhead documents for the browser's print / Save-as-PDF
// dialog and read per-request data from the database. Force dynamic rendering so
// they are NEVER statically prerendered during `next build` — otherwise a
// param-less page like /print/overview runs its DB getters at build time, which
// requires the database to be reachable during the build and fails the deploy
// when it isn't (e.g. env not yet configured on the host). Mirrors the
// `export const dynamic = "force-dynamic"` guard already used by the (app) group.
export const dynamic = "force-dynamic";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
