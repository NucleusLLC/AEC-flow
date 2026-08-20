import { ListPageSkeleton } from "@/components/loading/skeletons";

/**
 * Group-level loading fallback for every /(app) route. Next renders this while
 * an async server page resolves. Individual routes may add their own
 * `loading.tsx` later — Next uses the closest one.
 *
 * WHY THERE IS NO PERCENTAGE HERE, AND WHY THAT IS DELIBERATE
 * ----------------------------------------------------------
 * <ProgressLoader /> (components/ui/progress-loader.tsx) was added for the
 * estimate open, and opening a PROJECT — /projects → /projects/[id] — is the
 * other wait people complain about. It does not get a bar, on purpose.
 *
 * A project is opened by navigating to a server-rendered route. Next hands this
 * component no signal at all about that navigation: not how many queries the
 * page has issued, not how many have returned, not how many bytes of the RSC
 * stream have arrived. `useLinkStatus()` offers one bit — pending or not — and
 * one bit cannot be a percentage. Anything shown here would therefore be a
 * timer dressed up as progress, which is exactly the thing the estimate loader
 * exists to stop doing.
 *
 * A skeleton is the honest answer: it says "this shape is coming" and claims
 * nothing about how far along it is. It also animates, so it never reads as
 * frozen.
 *
 * If a route-level percentage is ever genuinely wanted, the honest route is to
 * make the page stream its sections (Suspense boundary per section) and count
 * boundaries as they resolve — real stages, same as the estimate loader. That
 * is a page-structure change, not a loading-UI change.
 */
export default function Loading() {
  return <ListPageSkeleton />;
}
