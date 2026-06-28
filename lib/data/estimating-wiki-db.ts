/**
 * Estimating Wiki (knowledge base) — DB-backed.
 *
 * SERVER-ONLY (Prisma → pg). The WikiArticle/WikiFact types + static seed live
 * in the client-safe `lib/data/estimating-wiki.ts`; this module only adds the DB
 * read/write. See [[aec-prisma-client-boundary]].
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WikiArticle, WikiFact } from "@/lib/data/estimating-wiki";

export async function getWikiArticles(): Promise<WikiArticle[]> {
  const rows = await prisma.wikiArticle.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    tags: r.tags,
    summary: r.summary,
    facts: (r.facts as unknown as WikiFact[]) ?? [],
    body: r.body ?? undefined,
    illoKey: r.illoKey ?? undefined,
    image: r.image ?? undefined,
  }));
}

/**
 * Replace the whole knowledge base (the editor can add AND delete articles, so a
 * wholesale replace keeps the DB in sync). Editor temp ids ("wk-new-…"/"wk-ai-…")
 * → fresh cuids; seeded "w-*" ids are preserved.
 */
export async function saveWikiArticles(articles: WikiArticle[]): Promise<void> {
  const data = articles.map((a, i) => ({
    ...(a.id && !a.id.startsWith("wk-") ? { id: a.id } : {}),
    title: a.title,
    category: a.category,
    tags: a.tags,
    summary: a.summary,
    facts: a.facts as unknown as Prisma.InputJsonValue,
    body: a.body ?? null,
    illoKey: a.illoKey ?? null,
    image: a.image ?? null,
    sortOrder: i,
  }));
  await prisma.$transaction([
    prisma.wikiArticle.deleteMany({}),
    prisma.wikiArticle.createMany({ data }),
  ]);
}
