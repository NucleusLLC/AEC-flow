/**
 * The contract, typeset.
 *
 * ONE COMPONENT FOR THE SCREEN AND FOR PRINT. The reviewing view and the
 * printed sheet are the same render inside the same `PrintSurface`, so a
 * contract cannot look one way on screen and another on paper — which is the
 * whole point of the document engine this rides on.
 *
 * ─── PAGE OVERFLOW ──────────────────────────────────────────────────────────
 * Pagination is `PagedPreview`'s measuring pass, not this component's job. What
 * this component owes it is honest ATOMS: blocks that must never be split get
 * `data-keep-together`, which `collectAtoms` reads. Three things are atomic:
 *   · the payment schedule — a schedule broken across a page break is the one
 *     table in a contract people photograph and argue about;
 *   · each party card and each execution block — a signature line orphaned from
 *     the name above it gets signed by the wrong person;
 *   · a clause heading with its first paragraph, which the pass binds itself.
 * Everything else is prose and splits freely, which is what makes the document
 * fill its pages instead of wasting them.
 *
 * ─── SHAPES, NOT ARTICLE NUMBERS ────────────────────────────────────────────
 * What each paragraph becomes is decided by `lib/contracts/layout.ts` from the
 * shape of its text. No rule here knows that article 11 is the signature block,
 * because in the next practice's template it will not be.
 */
import { Fragment } from "react";
import {
  emphasise,
  isBlankValue,
  pairCards,
  paragraphShape,
  stripEmphasis,
  tableColumns,
  type LabelledItem,
} from "@/lib/contracts/layout";
import { exchangeRateLine } from "@/lib/contracts/schedule";
import type { ContractBody, ContractPhase } from "@/lib/contracts/types";

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const usd = (n: number) =>
  `US$ ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The model's `**…**` and the fact patterns, as spans. */
function Rich({ text, names }: { text: string; names: string[] }) {
  return (
    <>
      {emphasise(text, names).map((span, i) =>
        span.bold ? (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}

/** A blank value prints as a line to sign or write on, never as nothing. */
function Value({ value, tall }: { value: string; tall?: boolean }) {
  if (!isBlankValue(value)) return <span className="text-[color:var(--doc-ink,#111827)]">{value}</span>;
  return (
    <span
      aria-label="to be completed"
      className={`inline-block w-full border-b border-current align-bottom opacity-40 ${tall ? "h-6" : "h-3.5"}`}
    />
  );
}

function ItemRows({ items }: { items: LabelledItem[] }) {
  const columns = tableColumns(items);
  const rows: LabelledItem[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return (
    <table className="w-full table-fixed border-collapse text-[0.92em]">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="align-baseline">
            {row.map((item, j) => (
              // A keyed Fragment, not a bare one: the pair of cells is the list
              // item, and React keys the wrapper, not the cells inside it.
              <Fragment key={`${item.label}-${j}`}>
                <th scope="row" className="w-[28%] py-[2px] pr-2 text-left font-normal opacity-70">
                  {stripEmphasis(item.label)}
                </th>
                <td className="py-[2px] pr-4">
                  <Value value={stripEmphasis(item.value)} tall={/signature/i.test(item.label)} />
                </td>
              </Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A party's particulars, or an execution block. Never split. */
function Card({
  heading,
  items,
}: {
  heading: string;
  items: LabelledItem[];
}) {
  return (
    <div
      data-keep-together
      className="rounded border border-current/25 px-3 py-2 break-inside-avoid"
    >
      <div className="mb-1 text-[0.78em] font-semibold uppercase tracking-wide opacity-80">
        {stripEmphasis(heading)}
      </div>
      <ItemRows items={items} />
    </div>
  );
}

function ScheduleTable({
  rows,
  currency,
  exchangeRate,
}: {
  rows: ContractPhase[];
  currency: string;
  exchangeRate: number;
}) {
  if (rows.length === 0) return null;
  const totalAwg = rows.reduce((t, r) => t + r.amountAwg, 0);
  const totalUsd = rows.reduce((t, r) => t + r.amountUsd, 0);
  const totalPct = rows.reduce((t, r) => t + r.percent, 0);

  return (
    <div data-keep-together className="my-3 break-inside-avoid">
      <table className="w-full border-collapse text-[0.9em]">
        <thead>
          <tr className="border-b border-current/40 text-left">
            <th className="w-[8%] py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 font-semibold">Instalment</th>
            <th className="w-[10%] py-1 pr-2 text-right font-semibold">%</th>
            <th className="w-[20%] py-1 pr-2 text-right font-semibold">{currency}</th>
            <th className="w-[20%] py-1 text-right font-semibold">US$</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.phase}-${i}`} className="border-b border-current/15 align-top">
              <td className="py-1 pr-2 tabular-nums">{stripEmphasis(r.phase)}</td>
              <td className="py-1 pr-2">
                <div className="font-medium">{stripEmphasis(r.description)}</div>
                {r.detail ? (
                  <div className="text-[0.86em] opacity-75">{stripEmphasis(r.detail)}</div>
                ) : null}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{r.percent}%</td>
              <td className="py-1 pr-2 text-right tabular-nums">{money(r.amountAwg, currency)}</td>
              <td className="py-1 text-right tabular-nums">{usd(r.amountUsd)}</td>
            </tr>
          ))}
          <tr className="border-t border-current/40 font-semibold">
            <td className="py-1 pr-2" />
            <td className="py-1 pr-2">Total</td>
            <td className="py-1 pr-2 text-right tabular-nums">{Math.round(totalPct * 100) / 100}%</td>
            <td className="py-1 pr-2 text-right tabular-nums">{money(totalAwg, currency)}</td>
            <td className="py-1 text-right tabular-nums">{usd(totalUsd)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[0.8em] opacity-70">{exchangeRateLine(exchangeRate, currency)}</p>
    </div>
  );
}

function Paragraph({ text, names }: { text: string; names: string[] }) {
  const shape = paragraphShape(text);

  if (shape.kind === "card") {
    return <Card heading={shape.heading} items={shape.items} />;
  }

  if (shape.kind === "table") {
    return (
      <div data-keep-together className="my-2 break-inside-avoid">
        <ItemRows items={shape.items} />
      </div>
    );
  }

  if (shape.kind === "clause" && shape.title.number) {
    const { number, title, rest } = shape.title;
    return (
      <p className="mb-2 text-justify leading-[1.45]">
        <span className="font-semibold">
          {number}
          {title ? ` ${title}.` : "."}
        </span>{" "}
        <Rich text={rest} names={names} />
      </p>
    );
  }

  return (
    <p className="mb-2 text-justify leading-[1.45]">
      <Rich text={text} names={names} />
    </p>
  );
}

export function ContractDocument({
  body,
  currency,
  exchangeRate,
  names = [],
  contractNumber,
  draft,
}: {
  body: ContractBody;
  currency: string;
  exchangeRate: number;
  /** Party names, so the emphasis rules can find them in the prose. */
  names?: string[];
  contractNumber: string;
  /** A draft says so on every copy. One that does not gets signed by accident. */
  draft: boolean;
}) {
  const scheduleArticle = body.scheduleArticle?.trim();

  return (
    <article className="text-[0.95rem] text-[color:var(--doc-ink,#111827)]">
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-4 text-[0.78em] uppercase tracking-wide opacity-70">
          <span className="font-mono">{contractNumber}</span>
          {draft ? <span className="font-semibold text-red-600">Draft — not for signature</span> : null}
        </div>
        <h1 className="mt-1 text-[1.5em] font-semibold leading-tight">{stripEmphasis(body.title)}</h1>
        {body.subtitle ? (
          <p className="mt-0.5 text-[1.02em] opacity-80">{stripEmphasis(body.subtitle)}</p>
        ) : null}
      </header>

      {body.parties.length > 0 ? (
        <section className="mb-4 grid gap-2 sm:grid-cols-2">
          {body.parties.map((party, i) => {
            const shape = paragraphShape(party.text);
            const items = shape.kind === "card" ? shape.items : shape.kind === "table" ? shape.items : [];
            return items.length > 0 ? (
              <Card key={i} heading={party.role || (shape.kind === "card" ? shape.heading : "Party")} items={items} />
            ) : (
              <div key={i} data-keep-together className="break-inside-avoid">
                <div className="text-[0.78em] font-semibold uppercase tracking-wide opacity-80">
                  {stripEmphasis(party.role)}
                </div>
                <p className="leading-[1.45]">
                  <Rich text={party.text} names={names} />
                </p>
              </div>
            );
          })}
        </section>
      ) : null}

      {body.recitals.map((r, i) => (
        <Paragraph key={`recital-${i}`} text={r} names={names} />
      ))}

      {/* ARTICLES ARE FLAT, NOT WRAPPED IN A SECTION EACH.
        * A `<section>` around an article is one tall box, and the paginator can
        * only place a box whole: a 30-article fixture put a 1,249px article on a
        * 1,009px page and left the page before it two thirds empty
        * (scripts/verify-print-overflow.mjs). Heading and paragraphs as siblings
        * give it a boundary between every block, which is the shape every other
        * document in this app presents. The heading is still bound to its first
        * paragraph — the pass does that itself with `data-keep-with-next`. */}
      {body.articles.map((article, i) => (
        <Fragment key={`${article.number}-${i}`}>
          <h2 className="mb-1.5 mt-4 text-[1.05em] font-semibold">
            {[article.number, stripEmphasis(article.heading)].filter(Boolean).join(". ")}
          </h2>
          {article.paragraphs.map((p, j) => (
            <Paragraph key={j} text={p} names={names} />
          ))}
          {scheduleArticle && scheduleArticle === article.number ? (
            <ScheduleTable rows={body.schedule} currency={currency} exchangeRate={exchangeRate} />
          ) : null}
        </Fragment>
      ))}

      {/* A schedule whose article the model did not name still has to print. */}
      {body.schedule.length > 0 &&
      (!scheduleArticle || !body.articles.some((a) => a.number === scheduleArticle)) ? (
        <section className="mb-4">
          <h2 className="mb-1.5 text-[1.05em] font-semibold">Payment schedule</h2>
          <ScheduleTable rows={body.schedule} currency={currency} exchangeRate={exchangeRate} />
        </section>
      ) : null}

      {body.signatures.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-[1.05em] font-semibold">Signed by the parties</h2>
          {pairCards(body.signatures).map((row, i) => (
            <div key={i} data-keep-together className="mb-3 grid gap-3 break-inside-avoid sm:grid-cols-2">
              {row.map((sig, j) => (
                <Card
                  key={j}
                  heading={sig.role}
                  items={[
                    { label: "Name", value: sig.name },
                    { label: "Signature", value: "" },
                    { label: "Date", value: "" },
                  ]}
                />
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </article>
  );
}
