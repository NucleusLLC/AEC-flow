import Link from "next/link";
import { getInvitationByToken } from "@/lib/data/invitations";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInvitationByToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        {!info ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl">✕</div>
            <h1 className="text-lg font-semibold text-fg">Invite not valid</h1>
            <p className="mt-2 text-sm text-muted">
              This invitation has expired, been revoked, or already been used.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-fg">
              Join <span className="text-brand">{info.companyName}</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              You&rsquo;ve been invited as <span className="font-medium text-fg">{info.email}</span>. Set your name and a
              password to join.
            </p>
            <AcceptInviteForm token={token} email={info.email} />
          </>
        )}
      </div>
    </div>
  );
}
