/**
 * Open one stored permit document — a letter's PDF, above all.
 *
 * A plain link target, so the register can put the PDF one click away without a
 * client round trip: this resolves the document through the tenant-scoped data
 * layer, mints a five-minute signed URL and redirects to it. The signed URL is
 * never stored and never rendered into a page, so a copied register link keeps
 * requiring a signed-in member of the practice.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPermitDocumentUrl } from "@/lib/data/building-permits";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  // The proxy already gates this path, but the tenant scope reads the company
  // off the session — with no session there is no scope, so refuse outright.
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return new NextResponse("Sign in to open this document.", { status: 401 });
  }

  const { documentId } = await params;
  try {
    const url = await getPermitDocumentUrl(documentId);
    if (!url) return new NextResponse("That document is not available.", { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
  } catch {
    return new NextResponse("The document could not be opened. Try again.", { status: 502 });
  }
}
