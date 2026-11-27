/** Client-safe shapes for "Import from MEPflow" (the data layer is lib/data/boq-import.ts, server-only). */
export type ImportTargetProject = { id: string; number: string; name: string; client: string | null };
export type ImportTargetClient = { id: string; name: string };
