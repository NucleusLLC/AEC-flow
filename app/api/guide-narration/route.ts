/**
 * GUIDE NARRATION manifest: is the Estimates guide read aloud in this language,
 * and which version of each step's clip is current.
 *
 * Signed-in users of any practice (the narration is a platform setting). The
 * answer holds no secret: an on/off flag and, per step, a short hash that goes
 * into the clip URL so that a changed text or voice is a new URL. Anything that
 * goes wrong answers "off": the guide then runs silent, exactly as without
 * narration.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NARRATION_OFF } from "@/lib/guide-narration/timing";
import { getNarrationManifest } from "@/lib/server/guide-narration";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const lang = new URL(request.url).searchParams.get("lang");
  let manifest = NARRATION_OFF;
  try {
    manifest = await getNarrationManifest(lang);
  } catch {
    // getNarrationManifest does not throw; this is the belt to its braces.
  }
  return NextResponse.json(manifest, { headers: { "cache-control": "private, no-store" } });
}
