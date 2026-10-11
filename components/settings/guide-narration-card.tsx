"use client";

/**
 * Settings > Integrations > "Guide narration (Fish Audio)". Founder only: the
 * page renders this card for nobody else, and every action behind it checks
 * the founder again on the server.
 *
 * The API key is write-only. This component never receives it: `status` says
 * set / not set and carries the last four characters.
 *
 * Every label sits in its own <span>: bare text beside a conditional sibling is
 * what browser page translation breaks React on.
 */
import { useRef, useState, useTransition } from "react";
import { Check, Play, Trash2, Volume2, X } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import {
  clearGuideNarrationCacheAction,
  clearGuideNarrationKeyAction,
  saveGuideNarrationKeyAction,
  saveGuideNarrationSettingsAction,
  testGuideNarrationVoiceAction,
} from "@/app/(app)/settings/narration-actions";
import type { NarrationStatus } from "@/lib/guide-narration/config";
import { narrationClipUrl, parseNarrationManifest } from "@/lib/guide-narration/timing";
import { NARRATION_LANGUAGES, NARRATION_MODELS, isVoiceId } from "@/lib/guide-narration/voices";

/** The language this card configures. Another language is another entry in voices.ts and a selector here. */
const LANG = "es";
const CUSTOM = "custom";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const FIELD =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Msg = { kind: "ok" | "err"; text: string; detail?: string } | null;

export function GuideNarrationCard({ initial }: { initial: NarrationStatus }) {
  const t = useT();
  const language = NARRATION_LANGUAGES[LANG];
  const [status, setStatus] = useState<NarrationStatus>(initial);
  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [model, setModel] = useState<string>(initial.model);
  const savedVoice = initial.voices[LANG] ?? language.defaultVoice;
  const listed = (id: string) => language.voices.some((v) => v.id === id);
  const [choice, setChoice] = useState<string>(listed(savedVoice) ? savedVoice : CUSTOM);
  const [custom, setCustom] = useState(listed(savedVoice) ? "" : savedVoice);
  const [msg, setMsg] = useState<Msg>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [working, startWork] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voice = (choice === CUSTOM ? custom : choice).trim().toLowerCase();
  const voiceValid = isVoiceId(voice);
  const dirty = enabled !== status.enabled || model !== status.model || (voiceValid && voice !== status.voices[LANG]);
  const fromEnv = status.source === "env";

  const saveKey = () => {
    if (!key.trim() || saving) return;
    setMsg(null);
    startSave(async () => {
      const res = await saveGuideNarrationKeyAction(key);
      if (res.ok) {
        setStatus(res.status);
        setKey("");
        setMsg({ kind: "ok", text: "API key saved." });
      } else setMsg({ kind: "err", text: res.error });
    });
  };

  const removeKey = () => {
    if (saving) return;
    setMsg(null);
    startSave(async () => {
      const res = await clearGuideNarrationKeyAction();
      if (res.ok) {
        setStatus(res.status);
        setMsg({ kind: "ok", text: "API key removed." });
      } else setMsg({ kind: "err", text: res.error });
    });
  };

  const saveSettings = () => {
    if (saving || !voiceValid) return;
    setMsg(null);
    startSave(async () => {
      const res = await saveGuideNarrationSettingsAction({ enabled, model, lang: LANG, voice });
      if (res.ok) {
        setStatus(res.status);
        setMsg({ kind: "ok", text: "Narration settings saved." });
      } else setMsg({ kind: "err", text: res.error });
    });
  };

  const testVoice = () => {
    if (testing || !voiceValid) return;
    setMsg(null);
    audioRef.current?.pause();
    startTest(async () => {
      const res = await testGuideNarrationVoiceAction({ lang: LANG, voice, model });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error, detail: res.detail });
        return;
      }
      try {
        const audio = new Audio(res.audio);
        audioRef.current = audio;
        await audio.play();
        setMsg({ kind: "ok", text: "Sample played." });
      } catch {
        setMsg({ kind: "err", text: "The browser blocked playback." });
      }
    });
  };

  const clearCache = () => {
    if (working) return;
    setMsg(null);
    setProgress(null);
    startWork(async () => {
      const res = await clearGuideNarrationCacheAction();
      setMsg(res.ok ? { kind: "ok", text: "Cached audio cleared." } : { kind: "err", text: res.error });
    });
  };

  // Ask for every clip once, one at a time, so the first listener never waits
  // for Fish Audio. Each request is the same one the guide makes.
  const generateAll = () => {
    if (working) return;
    setMsg(null);
    startWork(async () => {
      let done = 0;
      let failed = 0;
      try {
        const manifest = parseNarrationManifest(
          await (await fetch(`/api/guide-narration?lang=${LANG}`, { cache: "no-store" })).json(),
        );
        const clips = Object.entries(manifest.clips);
        if (!manifest.enabled || clips.length === 0) {
          setMsg({ kind: "err", text: "Narration is off or has no key, so there is nothing to generate." });
          return;
        }
        setProgress({ done: 0, total: clips.length });
        for (const [stepId, version] of clips) {
          const response = await fetch(narrationClipUrl(LANG, stepId, version));
          if (response.status === 200) done += 1;
          else failed += 1;
          setProgress({ done: done + failed, total: clips.length });
          // The first failure pauses Fish Audio for a while on the server; stop asking.
          if (failed > 0) break;
        }
      } catch {
        failed += 1;
      }
      setMsg(
        failed === 0
          ? { kind: "ok", text: "All clips are ready." }
          : { kind: "err", text: "Some clips could not be generated. Check the key and the Fish Audio credit." },
      );
    });
  };

  return (
    <div data-guide-narration-card="">
    <Card>
      <CardHeader
        title={t("Guide narration (Fish Audio)")}
        subtitle={t("Reads the Estimates interactive guide aloud. One setting for the whole platform: every practice hears the same voice.")}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
          <Volume2 className="h-4 w-4 shrink-0 text-brand" />
          {status.configured ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-sm text-fg" data-narration-key="set">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{t("Key configured")}</span>
              {status.last4 ? (
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-muted" data-narration-last4="">
                  {`••••${status.last4}`}
                </code>
              ) : null}
              <Badge tone={fromEnv ? "blue" : "green"}>{fromEnv ? t("from environment") : t("saved")}</Badge>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted" data-narration-key="unset">
              <X className="h-4 w-4 text-faint" />
              <span>{t("No API key configured — the guide runs silent.")}</span>
            </span>
          )}
        </div>

        {fromEnv ? (
          <p className="text-xs text-muted">
            <span>{t("A key in the FISH_AUDIO_API_KEY environment variable is in use. A key saved here takes precedence.")}</span>
          </p>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-muted">{t("Fish Audio API key")}</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveKey();
            }}
            placeholder="••••••••"
            autoComplete="off"
            data-narration-key-input=""
            className={cn(FIELD, "font-mono")}
          />
          <span className="mt-1 block text-[11px] text-faint">
            {t("Saved on the server and never sent back to the browser. Get a key from fish.audio → Developers → API keys.")}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveKey}
            disabled={saving || !key.trim()}
            data-narration-save-key=""
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{saving ? t("Saving…") : t("Save key")}</span>
          </button>
          {status.source === "saved" ? (
            <button type="button" onClick={removeKey} disabled={saving} data-narration-remove-key="" className={cn(BTN, "text-red-600 hover:bg-red-50")}>
              <Trash2 className="h-4 w-4" />
              <span>{t("Remove")}</span>
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              data-narration-enabled=""
              className="h-4 w-4 rounded border-border"
            />
            <span>{t("Narrate the guide")}</span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">{t("Voice (Spanish)")}</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)} data-narration-voice="" className={FIELD}>
              {language.voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {`${v.name} — ${t(v.note)}`}
                </option>
              ))}
              <option value={CUSTOM}>{t("Other voice (reference id)")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">{t("Model")}</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} data-narration-model="" className={FIELD}>
              {NARRATION_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted">{t("Voice reference id")}</span>
            <input
              type="text"
              value={choice === CUSTOM ? custom : choice}
              onChange={(e) => setCustom(e.target.value)}
              readOnly={choice !== CUSTOM}
              spellCheck={false}
              autoComplete="off"
              data-narration-voice-id=""
              className={cn(FIELD, "font-mono", choice !== CUSTOM && "text-muted")}
            />
            {!voiceValid ? (
              <span className="mt-1 block text-[11px] text-red-600">{t("A voice reference id is 32 characters (0-9, a-f).")}</span>
            ) : null}
          </label>

          <p className="text-[11px] text-faint sm:col-span-2">
            <span>{t("The free model needs no API credit; the paid models need credit on the Fish Audio account.")}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || !voiceValid || !dirty}
            data-narration-save=""
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{saving ? t("Saving…") : t("Save settings")}</span>
          </button>
          <button type="button" onClick={testVoice} disabled={testing || !voiceValid || !status.configured} data-narration-test="" className={BTN}>
            <Play className="h-4 w-4" />
            <span>{testing ? t("Testing…") : t("Test voice")}</span>
          </button>
          <button type="button" onClick={generateAll} disabled={working || !status.configured || status.cache === "none"} data-narration-generate="" className={BTN}>
            <Volume2 className="h-4 w-4" />
            <span>{t("Generate all clips")}</span>
          </button>
          <button type="button" onClick={clearCache} disabled={working || status.cache === "none"} data-narration-clear="" className={BTN}>
            <Trash2 className="h-4 w-4" />
            <span>{t("Clear cached audio")}</span>
          </button>
          {progress ? (
            <span className="text-xs tabular-nums text-muted" data-narration-progress="">
              {`${progress.done} / ${progress.total}`}
            </span>
          ) : null}
        </div>

        <p className="text-[11px] text-faint" data-narration-cache={status.cache}>
          <span>
            {status.cache === "bucket"
              ? t("Clips are kept in the private file storage and made once; later plays never call Fish Audio.")
              : status.cache === "disk"
                ? t("Clips are kept in a local folder (development).")
                : t("File storage is not connected, so clips cannot be kept and the guide runs silent.")}
          </span>
        </p>

        {msg ? (
          <p className={cn("text-sm", msg.kind === "ok" ? "text-emerald-700" : "text-red-600")} data-narration-msg={msg.kind}>
            <span>{t(msg.text)}</span>
            {msg.detail ? <span className="mt-0.5 block text-xs opacity-80">{msg.detail}</span> : null}
          </p>
        ) : null}
      </CardBody>
    </Card>
    </div>
  );
}
