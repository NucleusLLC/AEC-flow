/**
 * Open (or, with ?download=1, save) one expense's receipt.
 *
 * A plain link target, like the permit document route: this resolves the
 * expense through the tenant-scoped data layer, checks the person may see it —
 * whoever recorded it, or an administrator — mints a five-minute signed URL and
 * redirects to it. The signed URL is never stored and never rendered into a
 * page, so a copied link keeps requiring a signed-in member of the practice who
 * is allowed to see that receipt.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReceiptUrl } from "@/lib/data/expenses";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // The proxy already gates this path, but the tenant scope reads the company
  // off the session — with no session there is no scope, so refuse outright.
  const session = await getServerSession(authOptions);
  const t = await getServerT();
  if (!session?.user?.companyId) {
    return new NextResponse(t("Sign in to open this receipt."), { status: 401 });
  }

  const { id } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  try {
    const url = await getReceiptUrl(id, { download });
    if (!url) return new NextResponse(t("That receipt is not available."), { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
  } catch {
    return new NextResponse(t("The receipt could not be opened. Try again."), { status: 502 });
  }
}
