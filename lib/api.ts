/**
 * Generic JSON API helpers for route handlers (shared across all modules).
 *
 * Single source of truth — re-exports the response/error helpers originally
 * written for the Construction-Admin routes so every API route returns a
 * consistent shape: `{ data }` on success, `{ error }` on failure, and a 503
 * (not a silent no-op) when the database is unreachable.
 */
export { ok, created, badRequest, notFound, fail, isConnectionError, n } from "@/lib/ca/api";
