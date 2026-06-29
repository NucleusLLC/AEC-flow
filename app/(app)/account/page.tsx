import Link from "next/link";
import { getServerSession } from "next-auth";
import { LogIn } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAccount } from "@/lib/data/account";
import { AccountForm } from "@/components/account/account-form";

export const metadata = { title: "My Account · AEC-flow" };

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const account = userId ? await getAccount(userId) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">My Account</h2>
        <p className="text-sm text-muted">Update your profile and sign-in password.</p>
      </div>

      {account ? (
        <AccountForm account={account} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <p className="text-sm text-muted">Sign in to manage your account.</p>
          <Link
            href="/login?callbackUrl=/account"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
