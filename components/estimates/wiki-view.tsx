"use client";

import { useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { Search, BookOpen, Plus, Trash2, Pencil, Check, ImagePlus, ImageOff, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WikiArticle } from "@/lib/data/estimating-wiki";
import { aiFetchWikiArticle } from "@/app/(app)/estimates/wiki-actions";
import { saveWikiAction } from "@/app/(app)/estimates/actions";
import { WikiIllustration, WIKI_ILLO_KEYS } from "./wiki-illustrations";

export function WikiView({ initial }: { initial: WikiArticle[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [articles, setArticles] = useState<WikiArticle[]>(initial);
  const [wikiSaving, setWikiSaving] = useState(false);
  const [wikiSaveMsg, setWikiSaveMsg] = useState<"saved" | string | null>(null);
  async function saveWiki() {
    setWikiSaving(true);
    setWikiSaveMsg(null);
    const res = await saveWikiAction(articles);
    setWikiSaving(false);
    setWikiSaveMsg(res.ok ? "saved" : res.error);
  }
  const [editing, setEditing] = useState<string[]>([]);
  const seq = useRef(1);
  // AI-Fetch: generate a draft article from a topic, then open it in edit mode for review.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAiFetch] = useTransition();

  const cats = ["All", ...articles.reduce<string[]>((a, w) => (a.includes(w.category) ? a : [...a, w.category]), [])];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return articles.filter((w) => {
      if (cat !== "All" && w.category !== cat) return false;
      if (!term) return true;
      return (
        w.title.toLowerCase().includes(term) ||
        w.summary.toLowerCase().includes(term) ||
        w.tags.some((t) => t.includes(term)) ||
        w.facts.some((f) => f.label.toLowerCase().includes(term) || f.value.toLowerCase().includes(term))
      );
    });
  }, [articles, q, cat]);

  const isEditing = (id: string) => editing.includes(id);
  const toggleEdit = (id: string) => setEditing((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const patch = (id: string, p: Partial<WikiArticle>) => setArticles((a) => a.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const remove = (id: string) => {
    setArticles((a) => a.filter((w) => w.id !== id));
    setEditing((e) => e.filter((x) => x !== id));
  };
  const addNew = () => {
    const id = `wk-new-${seq.current++}`;
    setArticles((a) => [{ id, title: "New article", category: "Custom", tags: [], summary: "", facts: [{ label: "", value: "" }], body: "" }, ...a]);
    setEditing((e) => [...e, id]);
    setCat("All");
    setQ("");
  };
  const aiFetch = () => {
    if (!aiTopic.trim() || aiPending) return;
    setAiError(null);
    startAiFetch(async () => {
      const res = await aiFetchWikiArticle(aiTopic);
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const id = `wk-ai-${seq.current++}`;
      const facts = res.article.facts.length ? res.article.facts : [{ label: "", value: "" }];
      setArticles((a) => [{ id, ...res.article, facts }, ...a]);
      setEditing((e) => [...e, id]); // open the AI draft in edit mode for review
      setCat("All");
      setQ("");
      setAiTopic("");
      setAiError(null);
      setAiOpen(false);
    });
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <BookOpen className="h-4 w-4 text-brand" /> Estimating Wiki
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search norms, coverage, rules of thumb…" className="h-8 w-64 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
        <div className="flex flex-col items-stretch gap-1.5">
          <button type="button" onClick={addNew} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90">
            <Plus className="h-4 w-4" /> Add New
          </button>
          <button type="button" onClick={() => { setAiOpen((v) => !v); setAiError(null); }} aria-expanded={aiOpen} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-brand/5 px-3 text-xs font-medium text-brand hover:bg-brand/10">
            <Sparkles className="h-4 w-4" /> AI-Fetch
          </button>
          <button type="button" onClick={saveWiki} disabled={wikiSaving} title={typeof wikiSaveMsg === "string" && wikiSaveMsg !== "saved" ? wikiSaveMsg : undefined} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {wikiSaving ? "Saving…" : wikiSaveMsg === "saved" ? "Saved ✓" : wikiSaveMsg ? "Save failed" : "Save"}
          </button>
        </div>

        {aiOpen ? (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-3">
            <Sparkles className="h-4 w-4 shrink-0 text-brand" />
            <input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") aiFetch(); }}
              autoFocus
              placeholder="Topic — e.g. “Tiling adhesive & grout coverage” or “Rebar density per m³”"
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30"
            />
            <button type="button" onClick={aiFetch} disabled={aiPending || !aiTopic.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60">
              <Sparkles className="h-4 w-4" /> {aiPending ? "Fetching…" : "Fetch"}
            </button>
            <button type="button" onClick={() => { setAiOpen(false); setAiError(null); }} aria-label="Close AI-Fetch" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-faint hover:text-fg">
              <X className="h-4 w-4" />
            </button>
            {aiError ? (
              <p className="w-full text-xs text-red-400">{aiError}</p>
            ) : (
              <p className="w-full text-[11px] text-faint">AI drafts an estimating reference (coverage, ratios, norms) and opens it in edit mode for you to review before keeping.</p>
            )}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cat === c ? "bg-brand text-brand-fg" : "border border-border bg-surface text-muted hover:text-fg"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((w) =>
          isEditing(w.id) ? (
            <WikiEditCard key={w.id} article={w} patch={patch} remove={remove} onDone={() => toggleEdit(w.id)} />
          ) : (
            <WikiCard key={w.id} article={w} onEdit={() => toggleEdit(w.id)} onDelete={() => remove(w.id)} />
          ),
        )}
      </div>
      {!filtered.length ? <Card className="px-4 py-10 text-center text-sm text-muted">No articles match your search.</Card> : null}
    </div>
  );
}

function WikiCard({ article, onEdit, onDelete }: { article: WikiArticle; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="group flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{article.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone="slate">{article.category}</Badge>
          <button type="button" onClick={onEdit} aria-label="Edit article" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} aria-label="Delete article" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{article.summary}</p>
      <ArticleIllustration article={article} className="mt-3" />
      <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
        {article.facts.map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <dt className="text-xs text-muted">{f.label}</dt>
            <dd className="text-xs font-semibold tabular-nums text-fg">{f.value}</dd>
          </div>
        ))}
      </dl>
      {article.body ? <p className="mt-3 text-[11px] leading-relaxed text-faint">{article.body}</p> : null}
    </Card>
  );
}

/** Renders an article's illustration: an uploaded image wins over a built-in diagram. */
function ArticleIllustration({ article, className = "" }: { article: WikiArticle; className?: string }) {
  if (article.image) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL, no remote optimization needed
    return <img src={article.image} alt={article.title} className={`w-full rounded-lg border border-border bg-surface-2 object-contain ${className}`} />;
  }
  if (article.illoKey && WIKI_ILLO_KEYS.includes(article.illoKey)) {
    return <div className={className}><WikiIllustration kind={article.illoKey} /></div>;
  }
  return null;
}

const inputCls = "rounded border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30";

function WikiEditCard({
  article,
  patch,
  remove,
  onDone,
}: {
  article: WikiArticle;
  patch: (id: string, p: Partial<WikiArticle>) => void;
  remove: (id: string) => void;
  onDone: () => void;
}) {
  const setFact = (i: number, key: "label" | "value", val: string) =>
    patch(article.id, { facts: article.facts.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)) });
  const addFact = () => patch(article.id, { facts: [...article.facts, { label: "", value: "" }] });
  const removeFact = (i: number) => patch(article.id, { facts: article.facts.filter((_, idx) => idx !== i) });

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => patch(article.id, { image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <Card className="flex flex-col gap-2 border-emerald-500/30 p-5">
      <div className="flex items-center gap-2">
        <Badge tone="green">Editing</Badge>
        <input value={article.title} onChange={(e) => patch(article.id, { title: e.target.value })} placeholder="Title" className={`${inputCls} flex-1 font-semibold`} />
        <button type="button" onClick={onDone} aria-label="Done editing" className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"><Check className="h-3.5 w-3.5" /> Done</button>
        <button type="button" onClick={() => remove(article.id)} aria-label="Delete article" className="inline-flex h-7 w-7 items-center justify-center rounded text-faint hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-2">
        <input value={article.category} onChange={(e) => patch(article.id, { category: e.target.value })} placeholder="Category" className={`${inputCls} w-40`} />
        <input value={article.tags.join(", ")} onChange={(e) => patch(article.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="tags, comma-separated" className={`${inputCls} flex-1`} />
      </div>
      <textarea value={article.summary} onChange={(e) => patch(article.id, { summary: e.target.value })} placeholder="Short summary" rows={2} className={`${inputCls} resize-y`} />

      {/* Illustration: upload your own image, or pick a built-in diagram */}
      <div className="rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Illustration</span>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-fg hover:bg-surface-2">
              <ImagePlus className="h-3.5 w-3.5" /> Upload image
              <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
            {!article.image ? (
              <select
                value={article.illoKey && WIKI_ILLO_KEYS.includes(article.illoKey) ? article.illoKey : ""}
                onChange={(e) => patch(article.id, { illoKey: e.target.value || undefined })}
                className={`${inputCls} w-36`}
                aria-label="Built-in diagram"
              >
                <option value="">No diagram</option>
                {WIKI_ILLO_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            ) : (
              <button type="button" onClick={() => patch(article.id, { image: undefined })} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted hover:text-red-400">
                <ImageOff className="h-3.5 w-3.5" /> Remove image
              </button>
            )}
          </div>
        </div>
        <div className="px-3 py-2">
          {article.image || (article.illoKey && WIKI_ILLO_KEYS.includes(article.illoKey)) ? (
            <ArticleIllustration article={article} />
          ) : (
            <p className="py-3 text-center text-[11px] text-faint">No illustration — upload an image or choose a built-in diagram.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Facts</span>
          <button type="button" onClick={addFact} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"><Plus className="h-3 w-3" /> Fact</button>
        </div>
        {article.facts.map((f, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 last:border-b-0">
            <input value={f.label} onChange={(e) => setFact(i, "label", e.target.value)} placeholder="Label (e.g. Coverage)" className={`${inputCls} flex-1`} />
            <input value={f.value} onChange={(e) => setFact(i, "value", e.target.value)} placeholder="Value (e.g. 10–12 m²/L)" className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => removeFact(i)} aria-label="Remove fact" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      <textarea value={article.body ?? ""} onChange={(e) => patch(article.id, { body: e.target.value })} placeholder="Notes / detail (optional)" rows={3} className={`${inputCls} resize-y`} />
    </Card>
  );
}
