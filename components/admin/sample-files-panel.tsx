"use client";

/**
 * /admin > "Sample files". The founder's push of the complete sample set.
 *
 * The page renders this for the founder only, and the action behind every
 * button checks the founder again. One company per request: this component
 * walks the list, so each company gets its own result line and a long run
 * never depends on one long request.
 *
 * A real run for many companies is only offered after a dry run of the same
 * companies in the same language, and then asks for the word INSTALL.
 * The founder's own company is never part of "all": it has its own button.
 *
 * Every label sits in its own <span>: bare text beside a conditional sibling is
 * what browser page translation breaks React on.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { sampleSetForCompanyAction, type SamplePushResult } from "@/app/(app)/admin/sample-actions";
import type { SampleCompanyRow } from "@/lib/samples/admin";
import { SAMPLE_MODULES, type SampleCounts, type SampleLang } from "@/lib/samples/meta";

const BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const FIELD =
  "h-8 rounded-lg border border-border bg-surface px-2 text-xs text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const LANGUAGE_NAME: Record<SampleLang, string> = { en: "English", es: "Español" };

type RowResult = { mode: "dry" | "install"; result: SamplePushResult } | { mode: "dry" | "install"; running: true };

export function SampleFilesPanel({ companies }: { companies: SampleCompanyRow[] }) {
  const t = useT();
  const router = useRouter();
  const [lang, setLang] = useState<SampleLang>("en");
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [busy, setBusy] = useState(false);
  /** The company whose single install is waiting for its confirmation. */
  const [confirmOne, setConfirmOne] = useState<string | null>(null);
  /** The bulk dry run that was last completed: its language and its companies. */
  const [dryDone, setDryDone] = useState<{ lang: SampleLang; ids: string[] } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [typed, setTyped] = useState("");

  /** "All beta companies without one": never the founder company. */
  const targets = useMemo(
    () => companies.filter((c) => !c.isFounder && c.plan === "BETA" && !c.sample.installed),
    [companies],
  );
  const targetIds = targets.map((c) => c.id);
  const dryMatches =
    dryDone !== null && dryDone.lang === lang && dryDone.ids.join("|") === targetIds.join("|") && targetIds.length > 0;

  async function runOne(company: SampleCompanyRow, mode: "dry" | "install") {
    setResults((r) => ({ ...r, [company.id]: { mode, running: true } }));
    let result: SamplePushResult;
    try {
      result = await sampleSetForCompanyAction({
        companyId: company.id,
        lang,
        mode,
        // Only this company's own button can reach the founder company.
        allowFounderCompany: company.isFounder,
        confirm: mode === "install" ? "INSTALL" : undefined,
      });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : "The request failed." };
    }
    setResults((r) => ({ ...r, [company.id]: { mode, result } }));
  }

  async function single(company: SampleCompanyRow, mode: "dry" | "install") {
    setBusy(true);
    setConfirmOne(null);
    await runOne(company, mode);
    setBusy(false);
    if (mode === "install") router.refresh();
  }

  async function all(mode: "dry" | "install") {
    setBusy(true);
    setConfirmAll(false);
    setTyped("");
    for (const c of targets) await runOne(c, mode);
    setBusy(false);
    if (mode === "dry") setDryDone({ lang, ids: targetIds });
    else {
      setDryDone(null);
      router.refresh();
    }
  }

  const countsLine = (counts: SampleCounts) =>
    SAMPLE_MODULES.filter((m) => (counts[m.key] ?? 0) > 0)
      .map((m) => `${t(m.label)} ${counts[m.key]}`)
      .join(" · ");

  return (
    <div className="space-y-3" data-testid="sample-files-panel">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Sample files")}</h2>
        <p className="mt-1 text-sm text-muted">
          <span>
            {t("Push the complete sample project into a company. A dry run reports exactly what would be created and writes nothing. A company with no sample set and no projects is one whose signup seeding failed.")}
          </span>
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <span>{t("Sample language")}</span>
            <select
              className={FIELD}
              value={lang}
              disabled={busy}
              onChange={(e) => setLang(e.target.value === "es" ? "es" : "en")}
              data-testid="sample-push-lang"
            >
              <option value="en">{LANGUAGE_NAME.en}</option>
              <option value="es">{LANGUAGE_NAME.es}</option>
            </select>
          </label>
          <button type="button" className={BTN} disabled={busy || targets.length === 0} onClick={() => all("dry")} data-testid="sample-push-dry-all">
            <span>{fmt(t("Dry run for all beta companies without one ({count})"), { count: targets.length })}</span>
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || !dryMatches}
            onClick={() => setConfirmAll(true)}
            data-testid="sample-push-install-all"
          >
            <span>{fmt(t("Install for all beta companies without one ({count})"), { count: targets.length })}</span>
          </button>
          {!dryMatches && targets.length > 0 ? (
            <span className="text-xs text-faint">{t("Run the dry run first; the real run unlocks after it.")}</span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-faint">
          <span>{t("The founder company is never part of a run for all. Install it there with its own button.")}</span>
        </p>

        {confirmAll ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="sample-push-confirm">
            <p>
              <span>
                {fmt(t("This writes the {language} sample set into {count} companies. It adds records beside their own data and changes nothing else. Type INSTALL to confirm."), {
                  language: LANGUAGE_NAME[lang],
                  count: targets.length,
                })}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className={FIELD}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="INSTALL"
                aria-label="INSTALL"
                data-testid="sample-push-confirm-input"
              />
              <button type="button" className={BTN_PRIMARY} disabled={typed.trim() !== "INSTALL" || busy} onClick={() => all("install")} data-testid="sample-push-confirm-go">
                <span>{t("Confirm install")}</span>
              </button>
              <button type="button" className={BTN} onClick={() => { setConfirmAll(false); setTyped(""); }}>
                <span>{t("Cancel")}</span>
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">{t("Company")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Own data")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Sample set")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Last run")}</th>
                <th className="px-5 py-2.5 text-right font-medium">{t("Manage")}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const r = results[c.id];
                const res = r && "result" in r ? r.result : null;
                return (
                  <tr key={c.id} className="border-b border-border/60 align-top" data-testid={`sample-row-${c.id}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-fg">
                        <span>{c.name}</span>
                        {c.isFounder ? (
                          <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">FOUNDER</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-faint">
                        <span>{c.plan}</span>
                        <span>{" · "}</span>
                        <span>{fmt(t("since {date}"), { date: c.createdAt })}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      <span>{fmt(t("{clients} clients · {projects} projects"), { clients: c.clients, projects: c.projects })}</span>
                      {c.projects === 0 ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{t("no projects")}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {c.sample.installed ? (
                        <div>
                          <span className="font-medium text-emerald-600">{t("Installed")}</span>
                          <div className="text-xs text-faint">
                            <span>{`${LANGUAGE_NAME[c.sample.lang]} · v${c.sample.version} · ${c.sample.createdAt.slice(0, 10)}`}</span>
                          </div>
                          <div className="text-xs text-faint">
                            <span>{fmt(t("{count} records"), { count: c.sample.total })}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-rose-600">{t("No sample set")}</span>
                      )}
                    </td>
                    <td className="max-w-[340px] px-3 py-3 text-xs" data-testid={`sample-result-${c.id}`}>
                      {r && "running" in r ? <span className="text-muted">{t("Working…")}</span> : null}
                      {res && !res.ok ? (
                        <span className="text-rose-600">{fmt(t("Failed: {error}"), { error: res.error })}</span>
                      ) : null}
                      {res && res.ok && res.status === "would-install" ? (
                        <span className="text-fg">
                          <span className="font-medium">{fmt(t("Dry run: would create {count} records."), { count: res.total })}</span>
                          <span className="block text-faint">{countsLine(res.counts)}</span>
                        </span>
                      ) : null}
                      {res && res.ok && res.status === "installed" ? (
                        <span className="text-emerald-600">
                          <span className="font-medium">{fmt(t("Installed: {count} records created."), { count: res.total })}</span>
                          <span className="block text-faint">{countsLine(res.counts)}</span>
                        </span>
                      ) : null}
                      {res && res.ok && res.status === "already" ? (
                        <span className="text-muted">{t("Already has a sample set; nothing to do.")}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {confirmOne === c.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-xs text-fg">
                            {c.isFounder
                              ? t("This is the founder company. Install the sample set here?")
                              : fmt(t("Install the {language} sample set here?"), { language: LANGUAGE_NAME[lang] })}
                          </span>
                          <div className="flex gap-1.5">
                            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => single(c, "install")} data-testid={`sample-confirm-${c.id}`}>
                              <span>{t("Confirm install")}</span>
                            </button>
                            <button type="button" className={BTN} onClick={() => setConfirmOne(null)}>
                              <span>{t("Cancel")}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <button type="button" className={BTN} disabled={busy || c.sample.installed} onClick={() => single(c, "dry")} data-testid={`sample-dry-${c.id}`}>
                            <span>{t("Dry run")}</span>
                          </button>
                          <button type="button" className={BTN} disabled={busy || c.sample.installed} onClick={() => setConfirmOne(c.id)} data-testid={`sample-install-${c.id}`}>
                            <span>{t("Install")}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
