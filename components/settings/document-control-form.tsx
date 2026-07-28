"use client";

import { useState, useTransition } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { saveDocumentFontAction } from "@/app/(app)/settings/actions";
import {
  selectableFonts,
  getFont,
  fontFamilyCss,
  resolveFontForRenderer,
  DEFAULT_FONT_ID,
  FONT_CATALOG_VERSION,
  type RendererKind,
} from "@/lib/documents/fonts";
import { bundledFontVariable } from "@/lib/documents/font-loader";
import { TYPE_SCALE } from "@/lib/documents/tokens";

/**
 * Settings → Document Control → Typography.
 *
 * Replaces the previous arrangement, where the only typeface control was a
 * footer-scoped font whose value was persisted without validation. The choice
 * here is stored as a catalog ID and applied to every document surface.
 *
 * The preview is rendered in the actual selected face — the same bundled files
 * the printed document uses — so what is shown here is what prints, not an
 * approximation.
 */

const RENDERERS: { key: RendererKind; label: string }[] = [
  { key: "html", label: "Preview & print" },
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "Word" },
  { key: "email", label: "Email" },
];

/** pt → px for on-screen preview at 96dpi, so sizes look like the printed page. */
const pt = (v: number) => `${(v * 96) / 72}px`;

export function DocumentControlForm({
  initialFontId,
  canSave,
}: {
  initialFontId: string;
  canSave: boolean;
}) {
  const [fontId, setFontId] = useState(initialFontId);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fonts = selectableFonts();
  const font = getFont(fontId);

  const variable = bundledFontVariable(font.id);
  const previewFamily = variable ? `var(${variable}), ${fontFamilyCss(font.id)}` : fontFamilyCss(font.id);

  const warnings = RENDERERS.map((r) => ({
    ...r,
    resolution: resolveFontForRenderer(font.id, r.key),
  })).filter((r) => r.resolution.substituted);

  function save(next: string) {
    setFontId(next);
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await saveDocumentFontAction(next);
      if (res.ok) setSaved(getFont(next).displayName);
      else {
        setError(res.error);
        setFontId(initialFontId);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Document typography"
        subtitle="The typeface used by every generated document — proposals, reports, registers and correspondence."
      />
      <CardBody className="space-y-5">
        {/* Font choice */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fonts.map((f) => {
            const active = f.id === font.id;
            const v = bundledFontVariable(f.id);
            return (
              <button
                key={f.id}
                type="button"
                disabled={!canSave || pending}
                onClick={() => save(f.id)}
                className={[
                  "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-brand bg-brand/5 ring-1 ring-brand/20"
                    : "border-border hover:border-fg/25 hover:bg-surface-2",
                ].join(" ")}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">{f.displayName}</span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-brand" /> : null}
                </span>
                <span
                  className="text-lg leading-tight text-fg"
                  style={{ fontFamily: v ? `var(${v}), ${fontFamilyCss(f.id)}` : fontFamilyCss(f.id) }}
                >
                  Aa Bb 123
                </span>
                <span className="text-[11px] text-muted">
                  {f.id === DEFAULT_FONT_ID ? "Recommended · " : ""}
                  {f.fontSource === "bundled" ? "Embedded" : "System font"}
                  {f.multilingualSupport ? " · Multilingual" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="text-xs text-muted">Documents now use {saved}.</p>
        ) : null}

        {/* Renderer support — never let a substitution be silent (§11.4). */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Export support</p>
          <div className="flex flex-wrap gap-1.5">
            {RENDERERS.map((r) => {
              const ok = font.supportedRenderers[r.key];
              return (
                <span
                  key={r.key}
                  className={[
                    "rounded-md border px-2 py-1 text-[11px]",
                    ok ? "border-border text-fg" : "border-warning/30 bg-warning/5 text-warning",
                  ].join(" ")}
                >
                  {r.label}: {ok ? "yes" : "falls back"}
                </span>
              );
            })}
          </div>
          {warnings.map((w) => (
            <p key={w.key} className="flex items-start gap-2 text-[11px] text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w.resolution.warning}
            </p>
          ))}
          {font.note ? (
            <p className="flex items-start gap-2 text-[11px] text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {font.note}
            </p>
          ) : null}
        </div>

        {/* Live specimen, in the real face at print sizes. */}
        <div className="rounded-lg border border-border bg-white p-5 text-gray-900" style={{ fontFamily: previewFamily }}>
          <div style={{ fontSize: pt(TYPE_SCALE.documentTitle), fontWeight: 700, lineHeight: 1.15 }}>
            PROJECT PROPOSAL
          </div>
          <div style={{ fontSize: pt(TYPE_SCALE.subtitle), color: "#4b5563", marginTop: 2 }}>
            Architecture, Engineering &amp; Construction Services
          </div>
          <div
            style={{
              fontSize: pt(TYPE_SCALE.majorHeading),
              fontWeight: 600,
              marginTop: 14,
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 3,
            }}
          >
            Scope of services
          </div>
          <p style={{ fontSize: pt(TYPE_SCALE.body), lineHeight: 1.45, marginTop: 8 }}>
            The proposed scope includes design development, technical coordination, construction
            documentation, and project-administration services.
          </p>
          <ul style={{ fontSize: pt(TYPE_SCALE.body), lineHeight: 1.45, marginTop: 6, paddingLeft: 16, listStyle: "disc" }}>
            <li>Master planning and site layout</li>
            <li>Structural, mechanical and electrical coordination</li>
          </ul>

          <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: pt(TYPE_SCALE.tableBody) }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "3px 0" }}>Project No. 2026A-018</td>
                <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>62.5%</td>
              </tr>
              <tr style={{ borderTop: "1.5px solid #111827" }}>
                <td style={{ padding: "3px 0", fontWeight: 700 }}>Total Professional Fee</td>
                <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  AWG 125,000.00
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: pt(TYPE_SCALE.metadata), color: "#6b7280", marginTop: 10 }}>
            Ontwerpfase · Diseño esquemático · Diseño di proyecto — 24 Jul 2026
          </p>
        </div>

        <p className="text-[11px] text-faint">
          Font catalog v{FONT_CATALOG_VERSION}. Documents record the typeface they were issued with,
          so changing this does not alter previously issued documents.
        </p>
      </CardBody>
    </Card>
  );
}
