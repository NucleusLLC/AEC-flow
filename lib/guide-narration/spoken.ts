/**
 * GUIDE NARRATION, the "spoken form" layer: what the voice says for a guide
 * card, as opposed to what the card shows.
 *
 * A speech engine reads symbols badly or not at all: "m²" comes out as "eme
 * dos", "dd/mm/aaaa" as a stutter, "N.º" as silence, and Fish Audio only
 * normalises numbers for English and Chinese. So nothing is left to the engine:
 * every card is turned into plain words here, numbers included, and a test
 * holds that no digit or symbol survives in any of them.
 *
 * Two levels, per language:
 *   1. generic rules (units, abbreviations, codes, versions, numbers, brackets,
 *      bullet lists read as sentences), applied to every card;
 *   2. an explicit override for a card where a rule cannot know what is meant
 *      (a lone "m" is "metros" only in a list of units).
 *
 * Pure: no Prisma, no React, no DOM, no network. Adding a language is one
 * entry in SPOKEN_LANGS (its rules and overrides) plus a voice in voices.ts.
 *
 * The Spanish half of this file must keep producing exactly the text it does:
 * a clip's cache key is a hash of its spoken text, so one changed character
 * would make production synthesise that clip again (narration.test.ts pins the
 * keys).
 */
import type { GuideContent, GuideStep, GuideStepText } from "@/lib/estimates/interactive-guide";

/** One rewriting rule: a pattern, and what it becomes. */
type SpokenRule = readonly [RegExp, string | ((...m: string[]) => string)];

// ---------------------------------------------------------------------------
// Spanish numbers
// ---------------------------------------------------------------------------

const ES_UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete",
  "veintiocho", "veintinueve",
];
const ES_TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const ES_HUNDREDS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
  "ochocientos", "novecientos",
];

/** A whole number from 0 to 999 999 in Spanish words ("dos mil veintiséis"). */
export function spanishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return String(n);
  if (n < 30) return ES_UNITS[n];
  if (n < 100) {
    const u = n % 10;
    return u === 0 ? ES_TENS[n / 10] : `${ES_TENS[Math.floor(n / 10)]} y ${ES_UNITS[u]}`;
  }
  if (n === 100) return "cien";
  if (n < 1000) {
    const rest = n % 100;
    return rest === 0 ? ES_HUNDREDS[n / 100] : `${ES_HUNDREDS[Math.floor(n / 100)]} ${spanishNumber(rest)}`;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  // "veintiún mil", "treinta y un mil": uno is cut short before "mil".
  const head = thousands === 1 ? "mil" : `${spanishNumber(thousands).replace(/uno$/, "ún").replace(/ y ún$/, " y un")} mil`;
  return rest === 0 ? head : `${head} ${spanishNumber(rest)}`;
}

/** Digits read one by one: "001" is "cero cero uno". */
function spanishDigits(digits: string): string {
  return digits.split("").map((d) => ES_UNITS[Number(d)]).join(" ");
}

/** A run of digits the way a person reads it: a leading zero means digit by digit. */
function spanishDigitRun(digits: string): string {
  return digits.length > 1 && digits.startsWith("0") ? spanishDigits(digits) : spanishNumber(Number(digits));
}

const ES_LETTERS: Record<string, string> = {
  a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efe", g: "ge", h: "hache", i: "i", j: "jota", k: "ka", l: "ele",
  m: "eme", n: "ene", ñ: "eñe", o: "o", p: "pe", q: "cu", r: "erre", s: "ese", t: "te", u: "u", v: "uve",
  w: "doble uve", x: "equis", y: "ye", z: "zeta",
};

/**
 * A reference code read out part by part: "ZA-2026-0" is "zeta a, guion, dos
 * mil veintiséis, guion, cero" and "2026-001" is "dos mil veintiséis, guion,
 * cero cero uno". Capital letters are spelled; digit runs are read as numbers.
 */
export function spanishCode(code: string): string {
  return code
    .split("-")
    .map((part) =>
      (part.match(/\d+|[A-Za-zÑñ]+/g) ?? [])
        .map((run) =>
          /^\d/.test(run) ? spanishDigitRun(run) : run.toLowerCase().split("").map((ch) => ES_LETTERS[ch] ?? ch).join(" "),
        )
        .join(" "),
    )
    .join(", guion, ");
}

// ---------------------------------------------------------------------------
// Spanish rules
// ---------------------------------------------------------------------------

/** Applied in order. Each takes display text a step nearer to plain words. */
const ES_RULES: readonly SpokenRule[] = [
  // Abbreviations with a meaning of their own.
  [/\bN\.\s?º/g, "Número"],
  [/\bn\.\s?º/g, "número"],
  [/\bCant\./g, "Cantidad"],
  [/\bcant\./g, "cantidad"],
  // Not \b: in JavaScript "é" is not a word character, so \b would match inside "etcétera".
  [/(?<!\p{L})etc\.?(?!\p{L})/giu, "etcétera"],
  [/\bEj\.\s?/g, "Por ejemplo, "],
  [/\bej\.\s?/g, "por ejemplo, "],
  [/\bdd\/mm\/aaaa\b/gi, "día, mes y año"],
  [/\bh\/u\b/g, "horas por unidad"],
  // Currency and percentages.
  [/\$\s?USD\b/g, "dólares"],
  [/\bUSD\b/g, "dólares"],
  [/(\d)\s?%/g, "$1 por ciento"],
  [/%\s+(?=\p{L})/gu, "porcentaje de "],
  [/%/g, "porcentaje"],
  // Units, with or without a number in front.
  [/\bm²/g, "metros cuadrados"],
  [/\bm³/g, "metros cúbicos"],
  [/\bm2\b/g, "metros cuadrados"],
  [/\bm3\b/g, "metros cúbicos"],
  [/\bkg\b/g, "kilogramos"],
  [/\bund\b\.?/g, "unidades"],
  // "V1.0" is "versión uno punto cero".
  [/\bV(\d+)\.(\d+)\b/g, (_m, a, b) => `versión ${spanishNumber(Number(a))} punto ${spanishDigitRun(b)}`],
  // Reference codes: letters and digit groups joined by hyphens.
  [/\b(?:[A-Z]{1,5}-)?\d{2,6}(?:-\d{1,6})+\b/g, (m) => spanishCode(m)],
  [/\b[A-Z]{1,5}-\d{1,6}\b/g, (m) => spanishCode(m)],
  // Decimals with a comma, then whole numbers.
  [/\b(\d+),(\d+)\b/g, (_m, a, b) => `${spanishNumber(Number(a))} coma ${spanishDigitRun(b)}`],
  [/\b\d+\b/g, (m) => spanishDigitRun(m)],
  // "cantidad x norma" is a multiplication.
  [/(?<=\p{L})\s+[x×]\s+(?=\p{L})/gu, " por "],
  // An aside in brackets is read as an aside.
  [/\s*\(([^)]*)\)/g, ", $1,"],
];

/** Tidy what the rules leave behind: doubled or stranded punctuation, spacing. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,+/g, ",")
    .replace(/,([.;:])/g, "$1")
    .replace(/([.;:]),/g, "$1")
    .replace(/\.{2,}/g, ".")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .trim();
}

function applyRules(text: string, rules: readonly SpokenRule[]): string {
  let out = text;
  for (const [pattern, to] of rules) {
    out = typeof to === "string" ? out.replace(pattern, to) : out.replace(pattern, to as (...m: string[]) => string);
  }
  return tidy(out);
}

const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const endSentence = (s: string) => {
  const t = s.trim().replace(/[,;:]+$/, "");
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

// ---------------------------------------------------------------------------
// English numbers
// ---------------------------------------------------------------------------

const EN_UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A whole number from 0 to 999 999 in British English words ("two thousand and twenty-six"). */
export function englishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return String(n);
  if (n < 20) return EN_UNITS[n];
  if (n < 100) {
    const u = n % 10;
    return u === 0 ? EN_TENS[n / 10] : `${EN_TENS[Math.floor(n / 10)]}-${EN_UNITS[u]}`;
  }
  if (n < 1000) {
    const rest = n % 100;
    const head = `${EN_UNITS[Math.floor(n / 100)]} hundred`;
    return rest === 0 ? head : `${head} and ${englishNumber(rest)}`;
  }
  const head = `${englishNumber(Math.floor(n / 1000))} thousand`;
  const rest = n % 1000;
  if (rest === 0) return head;
  // "two thousand and twenty-six", but "two thousand, five hundred".
  return rest < 100 ? `${head} and ${englishNumber(rest)}` : `${head}, ${englishNumber(rest)}`;
}

/** Digits read one by one: "001" is "zero zero one". */
function englishDigits(digits: string): string {
  return digits.split("").map((d) => EN_UNITS[Number(d)]).join(" ");
}

/** A run of digits the way a person reads it: a leading zero means digit by digit. */
function englishDigitRun(digits: string): string {
  return digits.length > 1 && digits.startsWith("0") ? englishDigits(digits) : englishNumber(Number(digits));
}

/**
 * A digit run inside a reference code. Four digits that look like a year are
 * read as one: "2026" is "twenty twenty-six", "1998" is "nineteen ninety-eight".
 */
function englishCodeRun(digits: string): string {
  const n = Number(digits);
  if (digits.length === 4 && n >= 1100 && n <= 2099 && n % 100 >= 10 && Math.floor(n / 100) !== 20) {
    return `${englishNumber(Math.floor(n / 100))} ${englishNumber(n % 100)}`;
  }
  if (digits.length === 4 && n >= 2010 && n <= 2099) return `twenty ${englishNumber(n % 100)}`;
  return englishDigitRun(digits);
}

/** "Z" is "zed" in the English the guide is written in; every other letter is said as itself. */
const englishLetter = (ch: string) => (ch === "z" ? "zed" : ch.toUpperCase());

/**
 * A reference code read out part by part: "ZA-2026-001" is "zed A, dash, twenty
 * twenty-six, dash, zero zero one". Letters are spelled; digit runs are read
 * as a year, a number, or digit by digit after a leading zero.
 */
export function englishCode(code: string): string {
  return code
    .split("-")
    .map((part) =>
      (part.match(/\d+|[A-Za-z]+/g) ?? [])
        .map((run) => (/^\d/.test(run) ? englishCodeRun(run) : run.toLowerCase().split("").map(englishLetter).join(" ")))
        .join(" "),
    )
    .join(", dash, ");
}

// ---------------------------------------------------------------------------
// English rules
// ---------------------------------------------------------------------------

/** Applied in order. Each takes display text a step nearer to plain words. */
const EN_RULES: readonly SpokenRule[] = [
  // Abbreviations with a meaning of their own.
  [/\be\.g\.,?\s?/g, "for example, "],
  [/\bE\.g\.,?\s?/g, "For example, "],
  [/\bi\.e\.,?\s?/g, "that is, "],
  [/(?<!\p{L})etc\.?(?!\p{L})/giu, "and so on"],
  [/\bNo\.(?=\s|$)/g, "Number"],
  [/\bQty\b\.?/g, "Quantity"],
  [/\bqty\b\.?/g, "quantity"],
  [/\bdd\/mm\/yyyy\b/gi, "day, month, year"],
  [/\bhrs\/u\b/gi, "hours per unit"],
  [/\bh\/u\b/g, "hours per unit"],
  [/\s?\/\s?hr\b/g, " per hour"],
  [/\bHrs\b\.?/g, "Hours"],
  [/\bhrs\b\.?/g, "hours"],
  [/\bProg\.\s?Amt\b\.?/g, "Progress amount"],
  [/\bAmt\b\.?/g, "amount"],
  [/\bPOC\b/g, "percentage complete"],
  // Currency and percentages.
  [/\$\s?USD\b/g, "US dollars"],
  [/\bUSD\b/g, "US dollars"],
  [/(\d)\s?%/g, "$1 per cent"],
  [/\bpercentage complete\s+%/g, "percentage complete"],
  [/%/g, "percentage"],
  // Units, with or without a number in front.
  [/\bm²/g, "square metres"],
  [/\bm³/g, "cubic metres"],
  [/\bm2\b/g, "square metres"],
  [/\bm3\b/g, "cubic metres"],
  [/\bkg\b/g, "kilograms"],
  [/\bpcs\b\.?/g, "pieces"],
  // "V1.0" is "version one point zero".
  [/\bV(\d+)\.(\d+)\b/g, (_m, a, b) => `version ${englishNumber(Number(a))} point ${englishDigits(b)}`],
  // Reference codes: letters and digit groups joined by hyphens.
  [/\b(?:[A-Z]{1,5}-)?\d{2,6}(?:-\d{1,6})+\b/g, (m) => englishCode(m)],
  [/\b[A-Z]{1,5}-\d{1,6}\b/g, (m) => englishCode(m)],
  // Thousands with commas, decimals with a point, then whole numbers.
  [/\b\d{1,3}(?:,\d{3})+\b/g, (m) => englishNumber(Number(m.replace(/,/g, "")))],
  [/\b(\d+)\.(\d+)\b/g, (_m, a, b) => `${englishNumber(Number(a))} point ${englishDigits(b)}`],
  [/\b\d+\b/g, (m) => englishDigitRun(m)],
  // "quantity x norm" is a multiplication.
  [/(?<=\p{L})\s+[x×]\s+(?=\p{L})/gu, " times "],
  // "Profit & Risk", "Overhead / Profit", "Save as…".
  [/\s*&\s*/g, " and "],
  [/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, " or "],
  [/…/g, ""],
  // An aside in brackets is read as an aside.
  [/\s*\(([^)]*)\)/g, ", $1,"],
];

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

/** What a card says instead of what the generic rules would make of it. */
export type SpokenOverride = {
  /** Replaces the spoken title. */
  title?: string;
  /** Replaces the spoken body AND its bullet points. */
  body?: string;
};

type SpokenLang = {
  /** "Paso tres" */
  stepLabel: (n: number) => string;
  rules: readonly SpokenRule[];
  overrides: Record<string, SpokenOverride>;
};

/**
 * Spanish. Written for a neutral Latin American voice; the testers are in
 * Colombia and Aruba. Every override is here because a rule could not get it
 * right, and says why.
 */
const es: SpokenLang = {
  stepLabel: (n) => `Paso ${spanishNumber(n)}`,
  rules: ES_RULES,
  overrides: {
    // The "(m²)" only repeats the words before it; read once. The example is a decimal.
    area: { body: "Ingresa el área en metros cuadrados. Ejemplo: ochenta y tres coma ocho." },
    // A list in brackets reads better introduced by a colon than as an aside.
    sideMenu: { body: "Aquí navegas entre los módulos del sistema: proyectos, configuración, finanzas, etcétera." },
    // "(por hora)" qualifies the rate; say it as part of the sentence.
    pricing: {
      body: "Aquí defines la tarifa media de mano de obra por hora. Puedes cargar una plantilla, o guardar el presupuesto como plantilla.",
    },
    table: {
      body: "Aquí registras cada actividad del proyecto; por ejemplo: demolición, muros, pisos, etcétera. Cada fila es una partida.",
    },
    addSection: {
      body: "Sirve para crear una nueva sección del proyecto; por ejemplo: estructura, acabados, instalaciones, etcétera.",
    },
    summary: {
      body: "Aquí se muestra el total por tipo de recurso: mano de obra, material, equipo y subcontratista; y el porcentaje sobre el total.",
    },
    // "(partida)" names the row; as a bare aside it sounds like a stray word.
    item: {
      body: "Con este botón puedes agregar una nueva fila, es decir, una partida, al presupuesto. También puedes duplicar o eliminar la fila con los iconos de la derecha.",
    },
    // The title is an abbreviation of the first word of the body; say what the column is.
    colQty: { title: "Cantidad", body: "Es la cantidad de la partida, en la unidad de medida seleccionada." },
    // A lone "m" is "metros" only because this is a list of units.
    colUnit: {
      body: "Selecciona la unidad de medida. Ejemplos: metros cúbicos, metros, metros cuadrados, unidades, kilogramos, etcétera.",
    },
    colNorm: { title: "Norma, en horas por unidad", body: "Son las horas por unidad, según la norma." },
    // "% Avance" and "Importe avance" are column labels, not sentences.
    colProgress: {
      body: "Porcentaje de avance: es el porcentaje de ejecución de la partida. Importe de avance: se calcula automáticamente.",
    },
  },
};

/**
 * English. Written for a neutral British or international voice: "metres",
 * "per cent", "zed". The cards name controls as the screen spells them, so
 * "Labor" stays as written (it sounds the same either way). Every override is
 * here because a rule could not get it right, and says why.
 */
const en: SpokenLang = {
  stepLabel: (n) => `Step ${englishNumber(n)}`,
  rules: EN_RULES,
  overrides: {
    // The "(m²)" in the label only repeats the unit the body already says.
    area: { title: "Built-up Area" },
    // "(per hour)" qualifies the rate, and the two button labels end in an ellipsis.
    pricing: {
      body: "Set the average labor rate per hour here. Use Load template to start from a template, or Save as to keep this estimate as one.",
    },
    // A list in brackets reads better introduced by a colon than as an aside.
    table: {
      body: "Enter each task of the project here; for example: demolition, walls, floors. Each row is one item.",
    },
    addSection: {
      body: "Creates a new section of the estimate; for example: structure, finishes, services.",
    },
    // "&" and "/" are labels on the screen; aloud they are "and" and "or".
    markups: {
      title: "Mark-ups and Total",
      body: "Add general conditions or overhead, and your profit and risk percentage, here. The grand total is calculated for you.",
    },
    // "(an item)" names the row; as a bare aside it sounds like a stray word.
    item: {
      body: "This button adds a new row, that is, a new item, to the section. To remove a row, use the bin icon at its right-hand end.",
    },
    // A lone "m" is "metres" only because this is a list of units, and "ton" is plural there.
    colUnit: {
      body: "Select the unit of measure. Examples: cubic metres, square metres, metres, kilograms, tons.",
    },
    // The title is two abbreviations; say what the column is.
    colNorm: { title: "Norm, in hours per unit" },
    // "POC %" and "Prog. Amt" are column labels, not sentences.
    colProgress: {
      body: "Percentage complete: how much of the item has been carried out. Progress amount: calculated automatically.",
    },
  },
};

export const SPOKEN_LANGS: Record<string, SpokenLang> = { es, en };

/** Can this language be narrated at all? */
export function hasSpokenForm(lang: string | null | undefined): boolean {
  return typeof lang === "string" && Object.prototype.hasOwnProperty.call(SPOKEN_LANGS, lang);
}

/** Display text to plain words by the language's generic rules alone. */
export function speakable(lang: string, text: string): string {
  const rules = SPOKEN_LANGS[lang]?.rules;
  return rules ? applyRules(text, rules) : tidy(text);
}

/**
 * What the voice says for one card: "Paso tres. Cliente. Nombre del cliente.
 * Ejemplo: Acme Development." The step number and title are read first, then
 * the body, then each bullet as a sentence of its own.
 */
export function spokenStepText(lang: string, step: Pick<GuideStep, "id" | "number">, text: GuideStepText): string {
  const spec = SPOKEN_LANGS[lang];
  if (!spec) return "";
  const override = spec.overrides[step.id] ?? {};
  const title = override.title ?? applyRules(text.title, spec.rules);

  let body: string;
  if (override.body !== undefined) {
    body = override.body;
  } else {
    const points = text.points ?? [];
    // A body that only introduces the list ends in a colon on the card.
    const lead = endSentence(applyRules(text.body, spec.rules));
    const sentences = points.map((p) =>
      endSentence(`${upperFirst(applyRules(p.term, spec.rules))}: ${applyRules(p.text, spec.rules).replace(/\.$/, "")}`),
    );
    body = [lead, ...sentences].join(" ");
  }
  return tidy(`${spec.stepLabel(step.number)}. ${endSentence(title)} ${endSentence(body)}`);
}

/**
 * What the voice says for the picker card (the Estimates landing screen): its
 * title, then its body. It is not a step of the tour, so no step number is read.
 */
export function spokenPickerText(lang: string, text: { title: string; body: string }): string {
  const spec = SPOKEN_LANGS[lang];
  if (!spec) return "";
  return tidy(`${endSentence(applyRules(text.title, spec.rules))} ${endSentence(applyRules(text.body, spec.rules))}`);
}

/** Every card's spoken text for a language, in tour order. */
export function spokenGuide(
  lang: string,
  steps: readonly GuideStep[],
  content: GuideContent,
): { id: string; number: number; text: string }[] {
  return steps
    .filter((s) => content.steps[s.id])
    .map((s) => ({ id: s.id, number: s.number, text: spokenStepText(lang, s, content.steps[s.id]) }));
}

/**
 * Anything left in a spoken text that a voice cannot be trusted with: digits,
 * symbols, brackets, slashes, superscripts. Empty when the text is clean.
 */
export function unspeakable(text: string): string[] {
  return text.match(/[0-9²³º°%$/\\()[\]{}<>=+*_#@&|~^×]/g) ?? [];
}
