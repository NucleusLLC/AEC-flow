/**
 * Construction Administration — label layer (i18n-ready).
 *
 * English is the default and only fully-populated locale today. The structure is
 * built so Dutch (nl), Spanish (es) and Papiamento (pap) can be filled in later
 * without touching components — call `caLabel(key, locale)` everywhere instead of
 * hard-coding strings. Keys are stable; translations are additive.
 *
 * Regional terminology the spec calls out (kept as first-class entries so the
 * Dutch/Caribbean teams see familiar names):
 *   Change Order        → Meerwerk / Minderwerk
 *   Site Instruction    → Directie-instructie / Werkinstructie
 *   Punch List          → Opleverpunten / Gebrekenlijst
 *   Progress Certification → Voortgangsverklaring
 *   Payment Application → Termijnstaat / Betalingsaanvraag
 */

export type CaLocale = "en" | "nl" | "es" | "pap";

export const CA_LOCALES: { code: CaLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "es", label: "Español" },
  { code: "pap", label: "Papiamento" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "module.name": "Construction Administration & Reporting",
  "module.short": "Construction Admin",
  "doc.changeOrder": "Change Order",
  "doc.dailyReport": "Daily Report",
  "doc.weeklyReport": "Weekly Report",
  "doc.biweeklyReport": "Bi-Weekly Report",
  "doc.monthlyReport": "Monthly Executive Report",
  "doc.siteInstruction": "Site Instruction",
  "doc.rfi": "Request for Information",
  "doc.submittal": "Submittal",
  "doc.delayNotice": "Delay Notice",
  "doc.progressCertification": "Progress Certification",
  "doc.bankDraw": "Bank Draw Request",
  "doc.paymentApplication": "Payment Application",
  "doc.punchList": "Punch List",
  "doc.completionReport": "Completion Report",
};

// Regional names only (the rest fall back to English until translated).
const nl: Dict = {
  "doc.changeOrder": "Meerwerk / Minderwerk",
  "doc.siteInstruction": "Directie-instructie",
  "doc.rfi": "Verzoek om informatie",
  "doc.progressCertification": "Voortgangsverklaring",
  "doc.bankDraw": "Termijnstaat",
  "doc.paymentApplication": "Termijnstaat / Betalingsaanvraag",
  "doc.punchList": "Opleverpunten / Gebrekenlijst",
};

const es: Dict = {
  "doc.changeOrder": "Orden de Cambio",
  "doc.siteInstruction": "Instrucción de Obra",
  "doc.rfi": "Solicitud de Información",
  "doc.progressCertification": "Certificación de Avance",
  "doc.paymentApplication": "Solicitud de Pago",
  "doc.punchList": "Lista de Pendientes",
};

const pap: Dict = {
  "doc.changeOrder": "Orden di Kambio",
  "doc.progressCertification": "Sertifikashon di Progreso",
  "doc.punchList": "Lista di Defekto",
};

const DICTS: Record<CaLocale, Dict> = { en, nl, es, pap };

/** Resolve a label; falls back to English, then to the raw key. */
export function caLabel(key: string, locale: CaLocale = "en"): string {
  return DICTS[locale]?.[key] ?? en[key] ?? key;
}
