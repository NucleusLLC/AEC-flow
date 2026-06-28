import { ListPageSkeleton } from "@/components/loading/skeletons";

/**
 * Group-level loading fallback for every /(app) route. Next renders this while
 * an async server page resolves. Individual routes may add their own
 * `loading.tsx` later — Next uses the closest one.
 */
export default function Loading() {
  return <ListPageSkeleton />;
}
