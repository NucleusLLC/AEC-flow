import Link from "next/link";
import { getServerSession } from "next-auth";
import { LogIn, Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAccount, getBetaMembership } from "@/lib/data/account";
import { AccountForm } from "@/components/account/account-form";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("My Account")} · AEC-flow` };
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const account = userId ? await getAccount(userId) : null;
  const beta = userId ? await getBetaMembership(userId) : null;
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("My Account")}</h2>
        <p className="text-sm text-muted">{t("Update your profile and sign-in password.")}</p>
      </div>

      {beta?.betaTester ? (
        <div className="rounded-[var(--radius-card)] border border-brand/20 bg-brand/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Sparkles className="h-4 w-4 text-brand" />
            {t("Beta tester")}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {beta.betaAccessUntil
              ? fmt(t("Your free beta access runs until {date}."), { date: formatLongDate(beta.betaAccessUntil) })
              : t("Thanks for testing AEC-flow.")}{" "}
            {t("Keep the feedback coming via the Feedback button on any screen.")}
          </p>
        </div>
      ) : null}

      {account ? (
        <AccountForm account={account} />
      ) : (
        <div className="card-surface flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <p className="text-sm text-muted">{t("Sign in to manage your account.")}</p>
          <Link
            href="/login?callbackUrl=/account"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <LogIn className="h-4 w-4" />
            {t("Sign in")}
          </Link>
        </div>
      )}
    </div>
  );
}
