import { describe, expect, it } from "vitest";
import { GUIDE_HOLD_MS, GUIDE_LANGS, GUIDE_STEPS } from "@/lib/estimates/interactive-guide";
import { guideContentFor } from "@/lib/estimates/interactive-guide-content";
import {
  NARRATION_CACHE_PREFIX,
  clipCacheKey,
  clipHash,
  clipVersion,
  isNarrationCacheKey,
  narrationEntries,
  narrationEntry,
  narrationLangSupported,
} from "./catalog";
import {
  applyNarrationKey,
  applyNarrationSettings,
  looksLikeApiKey,
  narrationActive,
  narrationStatus,
  resolveNarrationConfig,
  storedNarrationConfig,
} from "./config";
import { SYNTH_RETRY_AFTER_MS, createNarrationService, type NarrationCache, type NarrationDeps } from "./service";
import { SPOKEN_LANGS, hasSpokenForm, spanishCode, spanishNumber, speakable, spokenGuide, spokenStepText, unspeakable } from "./spoken";
import {
  NARRATION_GAP_MS,
  NARRATION_OFF,
  NARRATION_PREF_KEY,
  narratedHoldMs,
  narrationClipUrl,
  parseNarrationManifest,
  readNarrationPref,
  writeNarrationPref,
} from "./timing";
import { DEFAULT_NARRATION_MODEL, NARRATION_LANGUAGES, NARRATION_MODELS, isNarrationModel, isVoiceId } from "./voices";

const es = guideContentFor("es")!;
const spoken = Object.fromEntries(spokenGuide("es", GUIDE_STEPS, es).map((s) => [s.id, s.text]));

// ---------------------------------------------------------------------------
// Spoken form
// ---------------------------------------------------------------------------

describe("Spanish numbers and codes", () => {
  it("writes whole numbers out", () => {
    const cases: [number, string][] = [
      [0, "cero"], [1, "uno"], [16, "dieciséis"], [21, "veintiuno"], [29, "veintinueve"], [30, "treinta"],
      [31, "treinta y uno"], [83, "ochenta y tres"], [100, "cien"], [101, "ciento uno"], [500, "quinientos"],
      [999, "novecientos noventa y nueve"], [1000, "mil"], [2026, "dos mil veintiséis"], [21000, "veintiún mil"],
      [31000, "treinta y un mil"],
    ];
    for (const [n, words] of cases) expect(spanishNumber(n), String(n)).toBe(words);
  });

  it("reads a reference code part by part", () => {
    expect(spanishCode("2026-001")).toBe("dos mil veintiséis, guion, cero cero uno");
    expect(spanishCode("ZA-2026-0")).toBe("zeta a, guion, dos mil veintiséis, guion, cero");
    expect(spanishCode("ZA-2026-014")).toBe("zeta a, guion, dos mil veintiséis, guion, cero uno cuatro");
  });
});

describe("the generic Spanish rules", () => {
  const say = (text: string) => speakable("es", text);

  it("reads units as words", () => {
    expect(say("83,8 m²")).toBe("ochenta y tres coma ocho metros cuadrados");
    expect(say("12 m³ y 40 kg")).toBe("doce metros cúbicos y cuarenta kilogramos");
    expect(say("Norma h/u")).toBe("Norma horas por unidad");
  });

  it("reads abbreviations as words", () => {
    expect(say("N.º de proyecto")).toBe("Número de proyecto");
    expect(say("Cant.")).toBe("Cantidad");
    expect(say("pisos, etc.")).toBe("pisos, etcétera");
    expect(say("formato dd/mm/aaaa")).toBe("formato día, mes y año");
  });

  it("reads versions, codes, currency and percentages", () => {
    expect(say("la actual (V1.0) o")).toBe("la actual, versión uno punto cero, o");
    expect(say("Ejemplo: ZA-2026-0.")).toBe("Ejemplo: zeta a, guion, dos mil veintiséis, guion, cero.");
    expect(say("$ USD")).toBe("dólares");
    expect(say("15 %")).toBe("quince por ciento");
    expect(say("% Avance")).toBe("porcentaje de Avance");
  });

  it("reads a multiplication sign between words as 'por'", () => {
    expect(say("cantidad x norma")).toBe("cantidad por norma");
    // ...but leaves the letter alone inside a word.
    expect(say("extra y máximo")).toBe("extra y máximo");
  });

  it("leaves nothing a voice cannot be trusted with", () => {
    expect(unspeakable(say("Total 15 % y 25,50 m² en ZA-2026-0, V2.10 (ej. muros) $ USD h/u N.º 7"))).toEqual([]);
  });
});

describe("what each of the 29 cards says", () => {
  it("has a spoken text for every step, in tour order", () => {
    const all = spokenGuide("es", GUIDE_STEPS, es);
    expect(all.map((s) => s.id)).toEqual(GUIDE_STEPS.map((s) => s.id));
    expect(all).toHaveLength(29);
  });

  it("opens every card with its step number in words and its title", () => {
    for (const step of GUIDE_STEPS) {
      expect(spoken[step.id].startsWith(`Paso ${spanishNumber(step.number)}. `), step.id).toBe(true);
    }
    expect(spoken.client).toBe("Paso tres. Cliente. Nombre del cliente. Ejemplo: Acme Development.");
  });

  it("contains no digit, symbol, bracket or slash in any card", () => {
    for (const step of GUIDE_STEPS) expect({ id: step.id, left: unspeakable(spoken[step.id]) }).toEqual({ id: step.id, left: [] });
  });

  it("contains no abbreviation a voice would stumble on", () => {
    for (const step of GUIDE_STEPS) {
      expect(spoken[step.id], step.id).not.toMatch(/(?<!\p{L})(etc|ej|Cant|und|kg|USD|dd|mm|aaaa)(?!\p{L})/u);
      expect(spoken[step.id], step.id).not.toMatch(/N\.\s?º|\bh\/u\b|\bm[²³]/);
    }
  });

  it("is already plain words: running the rules over a spoken text changes nothing", () => {
    for (const step of GUIDE_STEPS) expect(speakable("es", spoken[step.id]), step.id).toBe(spoken[step.id]);
  });

  it("ends every card with a full stop and never doubles punctuation", () => {
    for (const step of GUIDE_STEPS) {
      expect(spoken[step.id], step.id).toMatch(/\.$/);
      expect(spoken[step.id], step.id).not.toMatch(/[,.;:]{2,}|\s[,.;:]|\s{2,}/);
    }
  });

  // One assertion per card: this IS the script the voice reads. A change to a
  // card's display text shows up here as a changed sentence to listen to again.
  it("says exactly this", () => {
    expect(spoken).toEqual({
      module: "Paso uno. Módulo. Aquí ves el módulo en el que estás trabajando. Ábrelo para cambiar de módulo.",
      projectNo:
        "Paso dos. Número de proyecto. Código del proyecto. Puedes crear un número interno. Ejemplo: dos mil veintiséis, guion, cero cero uno.",
      client: "Paso tres. Cliente. Nombre del cliente. Ejemplo: Acme Development.",
      version:
        "Paso cuatro. Versión. Versión del presupuesto. Puedes dejar la actual, versión uno punto cero, o crear una nueva si haces cambios.",
      date: "Paso cinco. Fecha. Coloca la fecha con formato día, mes y año.",
      location: "Paso seis. Ubicación. Escribe dónde se ejecutará la obra.",
      area: "Paso siete. Área construida. Ingresa el área en metros cuadrados. Ejemplo: ochenta y tres coma ocho.",
      sideMenu:
        "Paso ocho. Menú lateral. Aquí navegas entre los módulos del sistema: proyectos, configuración, finanzas, etcétera.",
      pricing:
        "Paso nueve. Precios. Aquí defines la tarifa media de mano de obra por hora. Puedes cargar una plantilla, o guardar el presupuesto como plantilla.",
      costBase:
        "Paso diez. Base de costos. Selecciona cómo deseas ver la información. Avance: muestra el avance de la obra. Cliente: vista para presentar al cliente. Dólares: muestra también los importes en dólares. Control de impresión: configura el reporte. Base de datos: usa tu base de costos.",
      totalCost:
        "Paso once. Costo total del proyecto. Aquí se muestra automáticamente el costo total según lo que vayas diligenciando.",
      status:
        "Paso doce. Estado del presupuesto. Indica si se ha guardado correctamente y si está conectado con la base de datos.",
      table:
        "Paso trece. Tabla de partidas. Aquí registras cada actividad del proyecto; por ejemplo: demolición, muros, pisos, etcétera. Cada fila es una partida.",
      subtotal: "Paso catorce. Subtotal por sección. Se calcula automáticamente el total de las partidas de esa sección.",
      directCost: "Paso quince. Costo directo. Sumatoria de todas las partidas del proyecto.",
      totalDirect: "Paso dieciséis. Total de costos directos. Muestra el total general de todas las secciones.",
      addSection:
        "Paso diecisiete. Agregar sección. Sirve para crear una nueva sección del proyecto; por ejemplo: estructura, acabados, instalaciones, etcétera.",
      summary:
        "Paso dieciocho. Resumen de costos. Aquí se muestra el total por tipo de recurso: mano de obra, material, equipo y subcontratista; y el porcentaje sobre el total.",
      markups:
        "Paso diecinueve. Recargos y total. Aquí puedes agregar porcentajes de gastos generales o utilidades y se calculará el total final.",
      item: "Paso veinte. Elemento. Con este botón puedes agregar una nueva fila, es decir, una partida, al presupuesto. También puedes duplicar o eliminar la fila con los iconos de la derecha.",
      colQty: "Paso veintiuno. Cantidad. Es la cantidad de la partida, en la unidad de medida seleccionada.",
      colUnit:
        "Paso veintidós. Unidad. Selecciona la unidad de medida. Ejemplos: metros cúbicos, metros, metros cuadrados, unidades, kilogramos, etcétera.",
      colNorm: "Paso veintitrés. Norma, en horas por unidad. Son las horas por unidad, según la norma.",
      colHours: "Paso veinticuatro. Horas totales. Se calculan automáticamente: cantidad por norma.",
      colLabor: "Paso veinticinco. Costo de mano de obra. Se calcula automáticamente según las horas y la tarifa.",
      colMaterial: "Paso veintiséis. Material. Costo unitario: precio del material. Total: cantidad por costo unitario.",
      colEquipment: "Paso veintisiete. Equipo. Costo unitario: valor del equipo. Total: cantidad por costo unitario.",
      colSub:
        "Paso veintiocho. Subcontratista. Costo unitario: valor por unidad del subcontratista. Total: cantidad por costo unitario.",
      colProgress:
        "Paso veintinueve. Avance. Porcentaje de avance: es el porcentaje de ejecución de la partida. Importe de avance: se calcula automáticamente.",
    });
  });

  it("reads a bullet list as one sentence per bullet", () => {
    expect(spoken.costBase).toContain("la información. Avance: muestra el avance de la obra. Cliente: vista");
    expect(spoken.costBase).toContain("Dólares: muestra también los importes en dólares.");
  });

  it("only overrides steps that exist", () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id));
    for (const [lang, spec] of Object.entries(SPOKEN_LANGS)) {
      for (const id of Object.keys(spec.overrides)) expect(ids.has(id), `${lang}/${id}`).toBe(true);
    }
  });

  it("has rules and a voice for every language the guide is offered in", () => {
    for (const lang of GUIDE_LANGS) {
      expect(hasSpokenForm(lang), lang).toBe(true);
      expect(NARRATION_LANGUAGES[lang], lang).toBeDefined();
      expect(narrationLangSupported(lang), lang).toBe(true);
    }
    expect(hasSpokenForm("en")).toBe(false);
    expect(spokenStepText("en", GUIDE_STEPS[0], es.steps.module)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

describe("voices and models", () => {
  it("lists three or four vetted voices per language, the default among them, each a valid id", () => {
    for (const [lang, spec] of Object.entries(NARRATION_LANGUAGES)) {
      expect(spec.voices.length, lang).toBeGreaterThanOrEqual(3);
      expect(spec.voices.length, lang).toBeLessThanOrEqual(4);
      expect(spec.voices.map((v) => v.id)).toContain(spec.defaultVoice);
      for (const v of spec.voices) expect(isVoiceId(v.id), v.name).toBe(true);
      expect(new Set(spec.voices.map((v) => v.id)).size).toBe(spec.voices.length);
      expect(unspeakable(spec.sample), `${lang} sample`).toEqual([]);
    }
  });

  it("accepts only known models and well-formed voice ids", () => {
    expect(NARRATION_MODELS).toContain(DEFAULT_NARRATION_MODEL);
    expect(isNarrationModel("s2.1-pro")).toBe(true);
    for (const v of ["", "gpt", null, 3, "S2.1-PRO"]) expect(isNarrationModel(v)).toBe(false);
    for (const v of ["", "abc", "8B7187104E32481BB675F0CCA0B0A002", "8b7187104e32481bb675f0cca0b0a00", "../../etc/passwd", null]) {
      expect(isVoiceId(v)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Step lookup and cache key
// ---------------------------------------------------------------------------

describe("the step lookup", () => {
  it("finds every guide step in Spanish", () => {
    expect(narrationEntries("es").map((e) => e.stepId)).toEqual(GUIDE_STEPS.map((s) => s.id));
    expect(narrationEntry("es", "area")).toEqual({ lang: "es", stepId: "area", text: spoken.area });
  });

  it("rejects anything that is not a guide step", () => {
    const bad: unknown[] = [
      "", "nope", "AREA", "area ", " area", "area/..", "../area", "__proto__", "constructor", "toString", "hasOwnProperty",
      "Hola, lee esto por favor", "est-area", "7", 7, null, undefined, {}, ["area"],
    ];
    for (const id of bad) expect(narrationEntry("es", id), String(id)).toBeNull();
  });

  it("rejects every language the guide is not narrated in", () => {
    for (const lang of ["en", "nl", "de", "ES", "es-CO", "", "__proto__", null, undefined, 1]) {
      expect(narrationEntry(lang, "area"), String(lang)).toBeNull();
    }
  });
});

describe("the cache key", () => {
  const base = { text: "Paso uno. Módulo.", voice: "8b7187104e32481bb675f0cca0b0a002", model: "s2.1-pro-free" };

  it("is stable for the same text, voice and model", () => {
    expect(clipHash(base)).toBe(clipHash({ ...base }));
    expect(clipHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the text, the voice or the model changes", () => {
    const hashes = new Set([
      clipHash(base),
      clipHash({ ...base, text: "Paso uno. Módulo. " }),
      clipHash({ ...base, voice: "70fb19852a484f3eb1d040423e2a8be7" }),
      clipHash({ ...base, model: "s2.1-pro" }),
    ]);
    expect(hashes.size).toBe(4);
  });

  it("does not confuse a value moved from one field to another", () => {
    expect(clipHash({ text: "a", voice: "b", model: "c" })).not.toBe(clipHash({ text: "b", voice: "a", model: "c" }));
    expect(clipHash({ text: "ab", voice: "c", model: "d" })).not.toBe(clipHash({ text: "a", voice: "bc", model: "d" }));
  });

  it("names the object after the step and keeps it inside the narration folder", () => {
    const key = clipCacheKey({ lang: "es", stepId: "area" }, base);
    expect(key).toBe(`${NARRATION_CACHE_PREFIX}/es-area-${clipHash(base).slice(0, 32)}.mp3`);
    expect(isNarrationCacheKey(key)).toBe(true);
    expect(clipVersion(base)).toBe(clipHash(base).slice(0, 16));
    for (const step of GUIDE_STEPS) expect(isNarrationCacheKey(clipCacheKey({ lang: "es", stepId: step.id }, base))).toBe(true);
  });

  it("recognises only its own keys, so clearing the cache cannot touch a drawing or a receipt", () => {
    for (const key of [
      "drawings/abc.pdf", "guide-narration/../drawings/a.mp3", "guide-narration/es-area-xyz.mp3", "guide-narration/es-area.mp3",
      `guide-narration/sub/es-area-${"a".repeat(32)}.mp3`, `receipts/es-area-${"a".repeat(32)}.mp3`,
    ]) {
      expect(isNarrationCacheKey(key), key).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Dwell
// ---------------------------------------------------------------------------

describe("how long a narrated card holds", () => {
  it("is max(5 s, clip + gap)", () => {
    expect(GUIDE_HOLD_MS).toBe(5000);
    expect(narratedHoldMs(1200)).toBe(5000);
    expect(narratedHoldMs(GUIDE_HOLD_MS - NARRATION_GAP_MS)).toBe(5000);
    expect(narratedHoldMs(GUIDE_HOLD_MS - NARRATION_GAP_MS + 1)).toBe(5001);
    expect(narratedHoldMs(8620)).toBe(8620 + NARRATION_GAP_MS);
    expect(narratedHoldMs(25_000)).toBe(25_000 + NARRATION_GAP_MS);
  });

  it("is exactly 5 s with no clip", () => {
    for (const v of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(narratedHoldMs(v)).toBe(GUIDE_HOLD_MS);
  });

  it("allows for a clip that started late", () => {
    expect(narratedHoldMs(6000, 800)).toBe(6000 + 800 + NARRATION_GAP_MS);
    expect(narratedHoldMs(1000, 300)).toBe(5000);
    expect(narratedHoldMs(6000, -50)).toBe(6000 + NARRATION_GAP_MS);
  });
});

describe("the speaker preference", () => {
  const store = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it("is on by default, and remembers off", () => {
    const s = store();
    expect(readNarrationPref(s)).toBe(true);
    writeNarrationPref(s, false);
    expect(s.data.get(NARRATION_PREF_KEY)).toBe("off");
    expect(readNarrationPref(s)).toBe(false);
    writeNarrationPref(s, true);
    expect(readNarrationPref(s)).toBe(true);
    expect(s.data.size).toBe(0);
  });

  it("survives a browser with storage blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect(readNarrationPref(blocked)).toBe(true);
    expect(() => writeNarrationPref(blocked, false)).not.toThrow();
    expect(readNarrationPref(null)).toBe(true);
    expect(() => writeNarrationPref(null, false)).not.toThrow();
  });
});

describe("the manifest the browser receives", () => {
  it("is off for anything malformed", () => {
    for (const v of [null, undefined, "", 3, [], {}, { enabled: true }, { enabled: "yes", clips: { a: "0123456789abcdef" } }, { enabled: true, clips: {} }]) {
      expect(parseNarrationManifest(v)).toEqual(NARRATION_OFF);
    }
  });

  it("keeps only well-formed clip versions", () => {
    expect(parseNarrationManifest({ enabled: true, clips: { area: "0123456789abcdef", bad: "../x", n: 4 } })).toEqual({
      enabled: true,
      clips: { area: "0123456789abcdef" },
    });
  });

  it("builds the clip URL from a step id, never from text", () => {
    expect(narrationClipUrl("es", "area", "0123456789abcdef")).toBe("/api/guide-narration/area?lang=es&v=0123456789abcdef");
  });
});

// ---------------------------------------------------------------------------
// Settings: the key never leaves
// ---------------------------------------------------------------------------

describe("the narration settings", () => {
  const KEY = "test-fish-key-0123456789abcdefWXYZ";

  it("reads nothing from an empty or malformed blob", () => {
    for (const blob of [null, undefined, {}, { guideNarration: "x" }, { guideNarration: 3 }, []]) {
      expect(storedNarrationConfig(blob)).toEqual({});
    }
    expect(storedNarrationConfig({ guideNarration: { apiKey: "  ", model: "nope", voices: { es: "bad", fr: "x" }, enabled: "yes" } })).toEqual({});
  });

  it("resolves a saved key first and the environment key as the fallback", () => {
    expect(resolveNarrationConfig({ apiKey: KEY }, "env-key-000000000000")).toMatchObject({ apiKey: KEY, keySource: "saved" });
    expect(resolveNarrationConfig({}, " env-key-000000000000 ")).toMatchObject({ apiKey: "env-key-000000000000", keySource: "env" });
    expect(resolveNarrationConfig({}, undefined)).toMatchObject({ apiKey: null, keySource: null });
    expect(resolveNarrationConfig({}, "  ")).toMatchObject({ apiKey: null, keySource: null });
  });

  it("is on by default once there is a key, with the default voice and model", () => {
    const config = resolveNarrationConfig({ apiKey: KEY }, undefined);
    expect(config.enabled).toBe(true);
    expect(config.model).toBe(DEFAULT_NARRATION_MODEL);
    expect(config.voices.es).toBe(NARRATION_LANGUAGES.es.defaultVoice);
    expect(narrationActive(config)).toBe(true);
    expect(narrationActive(resolveNarrationConfig({ apiKey: KEY, enabled: false }, undefined))).toBe(false);
    expect(narrationActive(resolveNarrationConfig({}, undefined))).toBe(false);
  });

  it("never puts the key in what Settings receives", () => {
    for (const config of [resolveNarrationConfig({ apiKey: KEY }, undefined), resolveNarrationConfig({}, KEY)]) {
      const status = narrationStatus(config, "bucket");
      expect(status.configured).toBe(true);
      expect(status.last4).toBe("WXYZ");
      const wire = JSON.stringify(status);
      expect(wire).not.toContain(KEY);
      expect(wire).not.toContain(KEY.slice(0, 12));
      expect(Object.keys(status).sort()).toEqual(["cache", "configured", "enabled", "last4", "model", "source", "voices"]);
    }
  });

  it("shows no characters of a key too short to mask", () => {
    expect(narrationStatus(resolveNarrationConfig({ apiKey: "short" }, undefined), "none").last4).toBeNull();
    expect(narrationStatus(resolveNarrationConfig({}, undefined), "none")).toMatchObject({ configured: false, last4: null, source: null });
  });

  it("saves and removes the key without touching the other settings", () => {
    const stored = applyNarrationSettings({}, { enabled: false, model: "s2.1-pro", voices: { es: "70fb19852a484f3eb1d040423e2a8be7" } });
    const withKey = applyNarrationKey(stored, `  ${KEY}  `);
    expect(withKey).toEqual({ ...stored, apiKey: KEY });
    expect(applyNarrationKey(withKey, "")).toEqual(stored);
  });

  it("ignores invalid settings rather than guessing", () => {
    const before = { apiKey: KEY, enabled: true, model: "s2.1-pro-free", voices: { es: NARRATION_LANGUAGES.es.defaultVoice } };
    const after = applyNarrationSettings(before, { enabled: "no", model: "gpt-9", voices: { es: "not-a-voice", fr: "70fb19852a484f3eb1d040423e2a8be7" } });
    expect(after).toEqual(before);
    // The key cannot be changed through the settings door.
    expect(applyNarrationSettings(before, { apiKey: "other" } as never).apiKey).toBe(KEY);
  });

  it("normalises a pasted voice id", () => {
    const after = applyNarrationSettings({}, { voices: { es: " 70FB19852A484F3EB1D040423E2A8BE7 " } });
    expect(after.voices).toEqual({ es: "70fb19852a484f3eb1d040423e2a8be7" });
  });

  it("rejects what cannot be an API key", () => {
    expect(looksLikeApiKey(KEY)).toBe(true);
    for (const k of ["", "short", "has spaces in the middle of it", "x".repeat(201), "clave-con-ñ-0123456789"]) expect(looksLikeApiKey(k), k).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The service: cache first, quiet failure
// ---------------------------------------------------------------------------

function harness(over: Partial<NarrationDeps> & { stored?: Parameters<typeof resolveNarrationConfig>[0]; noCache?: boolean } = {}) {
  const KEY = "test-fish-key-0123456789abcdefWXYZ";
  const files = new Map<string, Uint8Array>();
  const calls: { text: string; voice: string; model: string; apiKey: string }[] = [];
  const logs: string[] = [];
  let clock = 1_000_000;
  const cache: NarrationCache = {
    kind: "disk",
    get: async (k) => files.get(k) ?? null,
    put: async (k, b) => void files.set(k, b),
    list: async () => [...files.keys()],
    remove: async (keys) => keys.forEach((k) => files.delete(k)),
  };
  const service = createNarrationService({
    config: async () => resolveNarrationConfig(over.stored ?? { apiKey: KEY }, undefined),
    cache: () => (over.noCache ? null : cache),
    synthesize: async (request) => {
      calls.push(request);
      return new Uint8Array(4096).fill(calls.length);
    },
    log: (what, error) => logs.push(`${what} ${error instanceof Error ? error.message : ""}`.trim()),
    now: () => clock,
    ...over,
  });
  return { service, files, calls, logs, cache, KEY, tick: (ms: number) => void (clock += ms) };
}

describe("serving a clip", () => {
  it("synthesises the step's own spoken text once, then serves from the cache with no Fish Audio call", async () => {
    const h = harness();
    const first = await h.service.clip("es", "area");
    expect(first).toMatchObject({ ok: true, from: "fish" });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ text: spoken.area, voice: NARRATION_LANGUAGES.es.defaultVoice, model: DEFAULT_NARRATION_MODEL });
    expect(h.files.size).toBe(1);

    const second = await h.service.clip("es", "area");
    expect(second).toMatchObject({ ok: true, from: "cache" });
    expect(h.calls).toHaveLength(1);
    if (first.ok && second.ok) {
      expect(second.bytes).toEqual(first.bytes);
      expect(second.version).toBe(first.version);
    }
  });

  it("makes one call when two listeners ask for the same clip at once", async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.service.clip("es", "area"), h.service.clip("es", "area")]);
    expect(a.ok && b.ok).toBe(true);
    expect(h.calls).toHaveLength(1);
  });

  it("refuses anything that is not a guide step without calling Fish Audio", async () => {
    const h = harness();
    for (const id of ["nope", "__proto__", "Lee este texto libre", "", null]) {
      expect(await h.service.clip("es", id)).toEqual({ ok: false, reason: "not-a-step" });
    }
    expect(await h.service.clip("en", "area")).toEqual({ ok: false, reason: "not-a-step" });
    expect(h.calls).toHaveLength(0);
  });

  it("is off with no key, or switched off, and makes no call", async () => {
    for (const stored of [{}, { apiKey: "test-fish-key-0123456789abcdefWXYZ", enabled: false }]) {
      const h = harness({ stored });
      expect(await h.service.clip("es", "area")).toEqual({ ok: false, reason: "off" });
      expect(await h.service.manifest("es")).toEqual(NARRATION_OFF);
      expect(h.calls).toHaveLength(0);
      expect(h.logs).toHaveLength(0);
    }
  });

  it("does not synthesise without a cache (every play would be a paid call), and says so once", async () => {
    const h = harness({ noCache: true });
    expect(await h.service.clip("es", "area")).toEqual({ ok: false, reason: "no-cache" });
    expect(await h.service.clip("es", "client")).toEqual({ ok: false, reason: "no-cache" });
    expect(await h.service.manifest("es")).toEqual(NARRATION_OFF);
    expect(h.calls).toHaveLength(0);
    expect(h.logs).toHaveLength(1);
  });

  it("never throws when Fish Audio fails: no clip, one log line, and Fish Audio is left alone for a while", async () => {
    let attempts = 0;
    const h = harness({
      synthesize: async () => {
        attempts += 1;
        throw new Error("Fish Audio answered 402. Insufficient API credit.");
      },
    });
    expect(await h.service.clip("es", "area")).toEqual({ ok: false, reason: "unavailable" });
    // The rest of the tour asks for 28 more clips: none of them reaches Fish Audio.
    for (const step of GUIDE_STEPS.slice(1)) expect(await h.service.clip("es", step.id)).toEqual({ ok: false, reason: "unavailable" });
    expect(attempts).toBe(1);
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toContain("402");

    h.tick(SYNTH_RETRY_AFTER_MS + 1);
    await h.service.clip("es", "area");
    expect(attempts).toBe(2);
  });

  it("makes one failed call and one log line when the card on screen and the next are asked for together", async () => {
    let attempts = 0;
    const h = harness({
      synthesize: async () => {
        attempts += 1;
        await new Promise((r) => setTimeout(r, 5));
        throw new Error("Fish Audio answered 402.");
      },
    });
    const results = await Promise.all([h.service.clip("es", "module"), h.service.clip("es", "projectNo"), h.service.clip("es", "client")]);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(attempts).toBe(1);
    expect(h.logs).toHaveLength(1);
  });

  it("synthesises different clips one after another, and all of them when Fish Audio is well", async () => {
    let running = 0;
    let most = 0;
    const h = harness({
      synthesize: async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return new Uint8Array(4096);
      },
    });
    const results = await Promise.all(["module", "projectNo", "client"].map((id) => h.service.clip("es", id)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(most).toBe(1);
    expect(h.files.size).toBe(3);
  });

  it("tries again at once after the founder changes the settings", async () => {
    let fail = true;
    const h = harness({
      synthesize: async () => {
        if (fail) throw new Error("timeout");
        return new Uint8Array(4096);
      },
    });
    expect((await h.service.clip("es", "area")).ok).toBe(false);
    fail = false;
    expect((await h.service.clip("es", "area")).ok).toBe(false);
    h.service.resetBackoff();
    expect((await h.service.clip("es", "area")).ok).toBe(true);
  });

  it("treats an empty or absurd answer as a failure, and stores nothing", async () => {
    const h = harness({ synthesize: async () => new Uint8Array(10) });
    expect(await h.service.clip("es", "area")).toEqual({ ok: false, reason: "unavailable" });
    expect(h.files.size).toBe(0);
  });

  it("stays quiet when the settings or the cache cannot be read", async () => {
    const a = harness({ config: async () => { throw new Error("db down"); } });
    expect(await a.service.clip("es", "area")).toEqual({ ok: false, reason: "off" });
    expect(await a.service.manifest("es")).toEqual(NARRATION_OFF);

    const b = harness();
    b.cache.get = async () => { throw new Error("storage down"); };
    expect(await b.service.clip("es", "area")).toEqual({ ok: false, reason: "unavailable" });
    expect(b.calls).toHaveLength(0);
  });

  it("still plays a clip it could not store, then stops synthesising until storage is back", async () => {
    const h = harness();
    h.cache.put = async () => { throw new Error("bucket rejected audio/mpeg"); };
    expect(await h.service.clip("es", "area")).toMatchObject({ ok: true, from: "fish" });
    expect(await h.service.clip("es", "client")).toEqual({ ok: false, reason: "unavailable" });
    expect(h.calls).toHaveLength(1);
    expect(h.logs).toHaveLength(1);
  });

  it("never passes the key to the log", async () => {
    const h = harness({ synthesize: async () => { throw new Error("boom"); } });
    await h.service.clip("es", "area");
    expect(h.logs.join("\n")).not.toContain(h.KEY);
  });
});

describe("the manifest", () => {
  it("lists a version for every step, and nothing secret", async () => {
    const h = harness();
    const manifest = await h.service.manifest("es");
    expect(manifest.enabled).toBe(true);
    expect(Object.keys(manifest.clips)).toEqual(GUIDE_STEPS.map((s) => s.id));
    expect(JSON.stringify(manifest)).not.toContain(h.KEY);
    expect(parseNarrationManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
    expect(h.calls).toHaveLength(0);
  });

  it("gives a clip a new version when the voice or the model changes, so it is made again by itself", async () => {
    const KEY = "test-fish-key-0123456789abcdefWXYZ";
    const a = await harness({ stored: { apiKey: KEY } }).service.manifest("es");
    const b = await harness({ stored: { apiKey: KEY, voices: { es: "70fb19852a484f3eb1d040423e2a8be7" } } }).service.manifest("es");
    const c = await harness({ stored: { apiKey: KEY, model: "s2.1-pro" } }).service.manifest("es");
    for (const step of GUIDE_STEPS) {
      expect(new Set([a.clips[step.id], b.clips[step.id], c.clips[step.id]]).size, step.id).toBe(3);
    }
  });

  it("is off for a language the guide is not narrated in", async () => {
    const h = harness();
    for (const lang of ["en", "nl", "", null, undefined, 3]) expect(await h.service.manifest(lang)).toEqual(NARRATION_OFF);
  });
});

describe("clearing the cache", () => {
  it("removes the clips and only the clips", async () => {
    const h = harness();
    await h.service.clip("es", "area");
    await h.service.clip("es", "client");
    h.files.set("drawings/plan.pdf", new Uint8Array(2000));
    expect(await h.service.clearCache()).toBe(2);
    expect([...h.files.keys()]).toEqual(["drawings/plan.pdf"]);

    // Made again by itself on the next play.
    expect(await h.service.clip("es", "area")).toMatchObject({ ok: true, from: "fish" });
    expect(h.calls).toHaveLength(3);
  });

  it("reports failure instead of throwing", async () => {
    const h = harness();
    h.cache.list = async () => { throw new Error("storage down"); };
    expect(await h.service.clearCache()).toBeNull();
    expect(await harness({ noCache: true }).service.clearCache()).toBe(0);
  });
});
