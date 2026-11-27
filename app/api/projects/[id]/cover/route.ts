/**
 * GET /api/projects/<id>/cover — the project's cover image (set by "Import from
 * MEPflow"), streamed from the private drawings bucket.
 *
 * Signed in only (proxy.ts + requireActor). The project is looked up through the
 * tenant extension, so another practice's id answers 404 exactly like a project
 * with no cover. Only JPEG / PNG are ever stored (lib/data/boq-import.ts sniffs
 * the bytes), and the type sent is taken from the key, never from the object.
 */
import { requireActor } from "@/lib/server/actor";
import { getProjectCoverKey } from "@/lib/data/boq-import";
import { downloadObject, isStorageConfigured } from "@/lib/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const key = await getProjectCoverKey(id);
  if (!key || !isStorageConfigured()) return new Response("Not found", { status: 404 });
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".jpg") ? "image/jpeg" : null;
  if (!type) return new Response("Not found", { status: 404 });
  const bytes = await downloadObject(key, MAX_BYTES).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": type,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
