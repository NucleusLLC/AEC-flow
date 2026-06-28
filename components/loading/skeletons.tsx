import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Pulsing placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-border/70", className)} />;
}

/** Page heading (title + subtitle). */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-3.5 w-80 max-w-full" />
    </div>
  );
}

/** Row of summary stat tiles. */
export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </Card>
      ))}
    </div>
  );
}

/** Generic table card placeholder. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-9 w-56" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-3.5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Default fallback for list-style pages (header + tiles + table). */
export function ListPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeaderSkeleton />
      <StatTilesSkeleton />
      <TableSkeleton />
    </div>
  );
}
