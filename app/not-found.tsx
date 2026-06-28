import Link from "next/link";

/** Root-level 404 for URLs that match no route at all (outside the app shell). */
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-sm font-semibold tracking-wider text-brand">404</p>
      <h1 className="text-2xl font-semibold text-fg">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist. Head back to the dashboard to keep working.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
