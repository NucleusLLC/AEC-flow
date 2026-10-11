"use client";

/**
 * Settings > Practice > "Sample files". Each practice installs or removes its
 * own sample set. Drawn for everyone who can open Settings; the buttons work
 * for an Admin or a Director only, and the actions behind them check that
 * again on the server and take the company from the session, never from here.
 *
 * Every label sits in its own <span>: bare text beside a conditional sibling is
 * what browser page translation breaks React on.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Trash2, X } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { installOwnSampleSetAction, removeOwnSampleSetAction } from "@/app/(app)/settings/sample-actions";
import type { SampleSetStatus } from "@/lib/samples/install";
import type { SampleLang } from "@/lib/samples/meta";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const FIELD =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Msg = { kind: "ok" | "err"; text: string; detail?: string } | null;

/** The language names are written in their own language on purpose. */
const LANGUAGE_NAME: Record<SampleLang, string> = { en: "English", es: "Español" };

export function SampleFilesCard({
  initial,
  canManage,
  defaultLang,
}: {
  initial: SampleSetStatus;
  canManage: boolean;
  defaultLang: SampleLang;
}) {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<SampleSetStatus>(initial);
  const [lang, setLang] = useState<SampleLang>(defaultLang);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [working, start] = useTransition();

  function install() {
    setMsg(null);
    start(async () => {
      const res = await installOwnSampleSetAction(lang);
      if (!res.ok) {
        setMsg({ kind: "err", text: t("The sample files could not be installed. Nothing was added."), detail: res.error });
        return;
      }
      setStatus({
        installed: true,
        version: status.installed ? status.version : 0,
        lang: res.lang,
        createdAt: status.installed ? status.createdAt : new Date().toISOString(),
        counts: res.counts,
        total: res.total,
      });
      setMsg({
        kind: "ok",
        text:
          res.status === "already"
            ? t("The sample files were already installed.")
            : fmt(t("Sample files installed: {count} records."), { count: res.total }),
      });
      router.refresh();
    });
  }

  function remove() {
    setMsg(null);
    setConfirming(false);
    start(async () => {
      const res = await removeOwnSampleSetAction();
      if (!res.ok) {
        setMsg({ kind: "err", text: t("The sample files could not be removed. Nothing was deleted."), detail: res.error });
        return;
      }
      setStatus({ installed: false });
      const kept = res.status === "removed" ? res.kept.length : 0;
      setMsg({
        kind: "ok",
        text:
          kept > 0
            ? fmt(t("Sample files removed. {count} sample records were kept because your own records are linked to them."), { count: kept })
            : t("Sample files removed."),
      });
      router.refresh();
    });
  }

  // The stored ISO day, as written: the same text on the server and in the browser.
  const installedOn = status.installed ? status.createdAt.slice(0, 10) : "";

  return (
    <Card>
      <CardHeader
        title={t("Sample files")}
        subtitle={t("One complete sample project that runs through every module, so you can see a finished example of each. Every sample record is marked SAMPLE.")}
        action={
          status.installed ? (
            <Badge tone="green">
              <span>{t("Installed")}</span>
            </Badge>
          ) : (
            <Badge tone="neutral">
              <span>{t("Not installed")}</span>
            </Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">
          <span>
            {t("It adds a client, a project, a service proposal, an estimate, a schedule, tasks, meeting minutes, a building permit, construction records, a purchase order, material selections, design deliverables, a letter, a contract and a paid invoice with its time and expense.")}
          </span>
        </p>
        <p className="text-sm text-muted">
          <span>
            {t("Removing deletes the sample records, including any changes you made to them. Your own records are never touched, and a sample record that your own records are linked to is kept.")}
          </span>
        </p>
        <p className="text-xs text-faint">
          <span>
            {t("While installed, the sample invoice, payment, time and expense are counted in your finance figures (invoice totals, tax report, profitability).")}
          </span>
        </p>

        {status.installed ? (
          <p className="text-sm text-fg" data-testid="sample-files-status">
            <span>
              {fmt(t("Installed on {date} in {language}: {count} records."), {
                date: installedOn,
                language: LANGUAGE_NAME[status.lang],
                count: status.total,
              })}
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {!status.installed ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-muted">
                <span>{t("Sample language")}</span>
                <select
                  className={FIELD}
                  value={lang}
                  disabled={!canManage || working}
                  onChange={(e) => setLang(e.target.value === "es" ? "es" : "en")}
                  data-testid="sample-files-lang"
                >
                  <option value="en">{LANGUAGE_NAME.en}</option>
                  <option value="es">{LANGUAGE_NAME.es}</option>
                </select>
              </label>
              <button type="button" className={BTN} disabled={!canManage || working} onClick={install} data-testid="sample-files-install">
                <FolderPlus className="h-4 w-4" />
                <span>{working ? t("Installing…") : t("Install sample files")}</span>
              </button>
            </>
          ) : null}

          {status.installed && !confirming ? (
            <button type="button" className={BTN} disabled={!canManage || working} onClick={() => setConfirming(true)} data-testid="sample-files-remove">
              <Trash2 className="h-4 w-4" />
              <span>{working ? t("Removing…") : t("Remove sample files")}</span>
            </button>
          ) : null}

          {status.installed && confirming ? (
            <>
              <span className="text-sm text-fg">{t("Delete every sample record, with any changes made to them?")}</span>
              <button type="button" className={BTN} disabled={working} onClick={remove} data-testid="sample-files-remove-confirm">
                <Trash2 className="h-4 w-4" />
                <span>{t("Yes, remove them")}</span>
              </button>
              <button type="button" className={BTN} disabled={working} onClick={() => setConfirming(false)}>
                <span>{t("Cancel")}</span>
              </button>
            </>
          ) : null}
        </div>

        {!canManage ? (
          <p className="text-xs text-faint">
            <span>{t("Only an Admin or a Director can install or remove the sample files.")}</span>
          </p>
        ) : null}

        {msg ? (
          <p
            className={msg.kind === "ok" ? "flex items-start gap-1.5 text-sm text-emerald-600" : "flex items-start gap-1.5 text-sm text-rose-600"}
            role="status"
            data-testid="sample-files-message"
          >
            {msg.kind === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              <span>{msg.text}</span>
              {msg.detail ? <span className="block text-xs">{msg.detail}</span> : null}
            </span>
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
