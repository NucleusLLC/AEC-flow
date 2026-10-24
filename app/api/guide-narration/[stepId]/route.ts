/**
 * GUIDE NARRATION audio: the MP3 read aloud while one guide card is lit.
 *
 * The request names a guide STEP; it never carries text. The text is looked up
 * on the server from the guide's own fixed content, so this cannot be used as a
 * text-to-speech proxy on the platform's Fish Audio account. Anything that is
 * not a step of the guide is a 404.
 *
 * Signed-in users only, of any practice. The clip comes from the private cache
 * (made once, on the first play, then never from Fish Audio again) and is sent
 * through this handler, so the bucket stays private and no signed URL exists.
 *
 * No clip (no key, switched off, Fish Audio or storage unavailable) is a 204,
 * not an error: the guide plays the card silently. The reason is one
 * `[aecflow-error]` line in the function logs (docs/ERRORS.md).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNarrationClip } from "@/lib/server/guide-narration";

export const dynamic = "force-dynamic";
// The first play of a step waits for Fish Audio; a long card takes several seconds.
export const maxDuration = 60;

const SILENT = { status: 204, headers: { "cache-control": "private, no-store" } } as const;

export async function GET(request: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const { stepId } = await params;
  const query = new URL(request.url).searchParams;

  let result: Awaited<ReturnType<typeof getNarrationClip>>;
  try {
    result = await getNarrationClip(query.get("lang"), stepId);
  } catch {
    // getNarrationClip does not throw; never let narration become an error.
    return new NextResponse(null, SILENT);
  }
  if (!result.ok) {
    return result.reason === "not-a-step" ? new NextResponse(null, { status: 404 }) : new NextResponse(null, SILENT);
  }

  // The URL carries the clip's version: when it matches, these bytes can never
  // change under that URL and the browser may keep them for good. Private:
  // behind sign-in, so never in a shared cache.
  const current = query.get("v") === result.version;
  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(result.bytes.byteLength),
      "cache-control": current ? "private, max-age=31536000, immutable" : "private, no-cache",
      etag: `"${result.version}"`,
      "x-content-type-options": "nosniff",
      "x-guide-narration": result.from,
    },
  });
}
