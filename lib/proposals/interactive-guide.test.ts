import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_LANGS, GUIDE_TONE_HEX, guideEnabledFor, missingGuideText } from "@/lib/estimates/interactive-guide";
import { LANG_CODES } from "@/lib/i18n/types";
import { clipIdFor, guideCardIds, guideContentIn } from "@/lib/guide/definition";
import { ESTIMATES_GUIDE, GUIDES, PROPOSALS_GUIDE, guideById, resolveClipId } from "@/lib/guide/registry";
import { clipCacheKey, isNarrationCacheKey, narrationEntries, narrationEntry } from "@/lib/guide-narration/catalog";
import { englishNumber, spanishNumber, speakable, unspeakable } from "@/lib/guide-narration/spoken";
import { DEFAULT_NARRATION_MODEL, NARRATION_LANGUAGES } from "@/lib/guide-narration/voices";
import { DICT } from "@/lib/i18n/dictionaries";
import { PROPOSAL_GUIDE_LIST_HINT_ID, PROPOSAL_GUIDE_STEPS } from "./interactive-guide";

const FORM = readFileSync(resolve(__dirname, "../../components/service-proposals/service-proposal-form.tsx"), "utf8");
const LIST_PAGE = readFileSync(resolve(__dirname, "../../app/(app)/design/service-proposals/page.tsx"), "utf8");
const DETAIL_PAGE = readFileSync(resolve(__dirname, "../../app/(app)/design/service-proposals/[id]/page.tsx"), "utf8");
const ACTIONS = readFileSync(resolve(__dirname, "../../components/service-proposals/proposal-actions.tsx"), "utf8");
const ENGINE_TYPES = readFileSync(resolve(__dirname, "engine/types.ts"), "utf8");

const en = guideContentIn(PROPOSALS_GUIDE, "en")!;
const es = guideContentIn(PROPOSALS_GUIDE, "es")!;
const spokenIn = (lang: string) => Object.fromEntries(narrationEntries(lang, PROPOSALS_GUIDE).map((e) => [e.stepId, e.text]));

/** A label as the screen shows it in a language: the English key, or its translation. */
const shown = (lang: "en" | "es", key: string) => (lang === "en" ? key : DICT.es[key]);

describe("the Service Proposals guide: steps", () => {
  it("is 22 steps numbered 1 to 22 in order, with unique ids and a known colour", () => {
    expect(PROPOSAL_GUIDE_STEPS.map((s) => s.number)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(new Set(PROPOSAL_GUIDE_STEPS.map((s) => s.id)).size).toBe(22);
    for (const s of PROPOSAL_GUIDE_STEPS) {
      expect(s.targets.length, s.id).toBeGreaterThan(0);
      expect(GUIDE_TONE_HEX[s.tone], s.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.id, s.id).toMatch(/^[A-Za-z0-9]+$/);
    }
    expect(PROPOSAL_GUIDE_STEPS.some((s) => s.id === PROPOSAL_GUIDE_LIST_HINT_ID)).toBe(false);
  });

  it("points every step at a marker the form really carries, and the list card at one the list carries", () => {
    for (const s of PROPOSAL_GUIDE_STEPS) {
      for (const target of s.targets) {
        expect(target, s.id).toMatch(/^sp-[a-z-]+$/);
        expect({ step: s.id, target, onForm: FORM.includes(`data-guide="${target}"`) }).toEqual({ step: s.id, target, onForm: true });
      }
    }
    const list = PROPOSALS_GUIDE.list;
    expect(list.path).toBe("/design/service-proposals");
    expect(list.target).toEqual({ by: "marker", name: "sp-new" });
    expect(LIST_PAGE).toContain('data-guide="sp-new"');
    // The form carries no marker the tour does not use.
    const used = new Set(PROPOSAL_GUIDE_STEPS.flatMap((s) => s.targets));
    const onForm = [...FORM.matchAll(/data-guide="([^"]+)"/g)].map((m) => m[1]);
    expect(onForm.filter((m) => !used.has(m))).toEqual([]);
  });

  it("mounts the tour beside the form, with the Service Proposals definition", () => {
    expect(FORM).toContain("<GuideTour guide={PROPOSALS_GUIDE} />");
  });
});

describe("the Service Proposals guide: card text", () => {
  it("has complete text in every language the guides are offered in, and in no other", () => {
    expect(Object.keys(PROPOSALS_GUIDE.content).sort()).toEqual([...GUIDE_LANGS].sort());
    for (const lang of GUIDE_LANGS) {
      const content = guideContentIn(PROPOSALS_GUIDE, lang)!;
      expect(missingGuideText(content, PROPOSAL_GUIDE_STEPS), lang).toEqual([]);
      expect(Object.keys(content.steps), lang).toEqual(PROPOSAL_GUIDE_STEPS.map((s) => s.id));
      for (const v of Object.values(content.ui)) expect(v.trim()).not.toBe("");
      expect(content.picker.title.trim()).not.toBe("");
      expect(content.picker.body.trim()).not.toBe("");
    }
    expect(guideContentIn(PROPOSALS_GUIDE, "nl")).toBeNull();
    expect(guideContentIn(PROPOSALS_GUIDE, "__proto__")).toBeNull();
  });

  it("is written in each language, not one copied into the other", () => {
    for (const s of PROPOSAL_GUIDE_STEPS) {
      expect(en.steps[s.id].body, s.id).not.toBe(es.steps[s.id].body);
      expect(en.steps[s.id].body, s.id).not.toMatch(/[áéíóúñ¿¡]/i);
    }
  });

  // step id -> the form labels its card names. Each must be on the form, and
  // each must appear in the card as that language's screen shows it.
  const TITLES: Record<string, string> = {
    template: "Start from a template",
    number: "Proposal number",
    project: "Project",
    currency: "Currency",
    costBasis: "Cost basis",
    fees: "Professional fees",
    addFee: "Add fee line",
    phases: "Design phases",
    payment: "Payment schedule",
    reimbursables: "Reimbursable expenses",
    discount: "Discount",
    scope: "Scope of services",
    narrative: "Scope narrative & terms",
    terms: "Terms & conditions",
    validity: "Valid until",
    summary: "Live summary",
  };
  const NAMED: Record<string, string[]> = {
    client: ["+ New client"],
    project: ["+ New project"],
    contact: ["Contact name", "Contact email"],
    fees: ["% of cost basis", "Fixed fee", "Hourly"],
    costBasis: ["Estimated construction cost", "% of cost basis"],
    feeType: ["Base", "Optional", "Additional", "Selected (include in total)"],
    tax: ["Tax name", "Tax %", "Tax", "Live summary"],
    discount: ["Fixed", "Value"],
    scope: ["Add scope item", "Included", "Excluded"],
    narrative: ["Scope summary", "Exclusions", "Assumptions"],
    validity: ["Show fee derivation to the client"],
    save: ["Create proposal", "Save changes", "Print / Preview", "Email proposal", "New revision", "Project Dashboard"],
    summary: ["Base fee", "Subtotal", "Tax"],
  };

  it("titles each card with the label of the control it lights up, in both languages", () => {
    for (const [id, key] of Object.entries(TITLES)) {
      expect({ id, key, onForm: FORM.includes(`t(${JSON.stringify(key)})`) }).toEqual({ id, key, onForm: true });
      expect(en.steps[id].title, id).toBe(key);
      expect(DICT.es[key], key).toBeTruthy();
      expect(es.steps[id].title, id).toBe(DICT.es[key]);
    }
    // "Title *" and "Client" lose only the required mark; "Type" is the row's own label.
    expect(FORM).toContain('t("Title *")');
    expect(en.steps.title.title).toBe("Title");
    expect(es.steps.title.title).toBe(DICT.es["Title *"].replace(/\s*\*$/, ""));
    expect(FORM).toContain('t("Client")');
    expect(FORM).toContain('t("Type")');
  });

  it("names every other control exactly as the screen shows it, in both languages", () => {
    const sources = FORM + DETAIL_PAGE + ACTIONS + ENGINE_TYPES;
    for (const [id, keys] of Object.entries(NAMED)) {
      for (const key of keys) {
        expect({ id, key, onScreen: sources.includes(JSON.stringify(key)) }).toEqual({ id, key, onScreen: true });
        for (const lang of ["en", "es"] as const) {
          const label = shown(lang, key);
          expect(label, `${lang} ${key}`).toBeTruthy();
          const card = guideContentIn(PROPOSALS_GUIDE, lang)!.steps[id];
          expect({ lang, id, label, named: `${card.title} ${card.body}`.includes(label) }).toEqual({ lang, id, label, named: true });
        }
      }
    }
    // The summary's total is "Grand total" on the screen.
    expect(FORM).toContain('t("Grand total")');
    expect(en.steps.summary.body.toLowerCase()).toContain("grand total");
    expect(es.steps.summary.body).toContain(DICT.es["Grand total"]);
  });

  it("names the list's own controls on the list card", () => {
    expect(LIST_PAGE).toContain('t("New Proposal")');
    expect(DETAIL_PAGE).toContain('t("Edit")');
    expect(en.picker.body).toContain("New Proposal");
    expect(en.picker.body).toContain("Edit");
    expect(es.picker.body).toContain(DICT.es["New Proposal"]);
    expect(es.picker.body).toContain(DICT.es["Edit"]);
  });
});

describe("the Service Proposals guide: what the voice says", () => {
  for (const lang of ["es", "en"] as const) {
    const spoken = spokenIn(lang);
    const ids = guideCardIds(PROPOSALS_GUIDE).map((id) => clipIdFor(PROPOSALS_GUIDE, id));
    const number = lang === "es" ? spanishNumber : englishNumber;
    const label = lang === "es" ? "Paso" : "Step";

    it(`${lang}: has a spoken text for every card, in tour order, then the list card`, () => {
      expect(Object.keys(spoken)).toEqual(ids);
      expect(ids).toHaveLength(23);
    });

    it(`${lang}: opens every step with its number in words`, () => {
      for (const s of PROPOSAL_GUIDE_STEPS) {
        expect(spoken[`proposals.${s.id}`].startsWith(`${label} ${number(s.number)}. `), s.id).toBe(true);
      }
      expect(spoken["proposals.listHint"].startsWith(label)).toBe(false);
    });

    it(`${lang}: contains no digit, symbol, bracket, slash, plus or asterisk in any card`, () => {
      for (const id of ids) {
        expect({ id, left: unspeakable(spoken[id]) }).toEqual({ id, left: [] });
        expect(spoken[id], id).not.toMatch(/[+…·]|BBO/);
      }
    });

    it(`${lang}: is already plain words, ends with a full stop and never doubles punctuation`, () => {
      for (const id of ids) {
        expect(speakable(lang, spoken[id]), id).toBe(spoken[id]);
        expect(spoken[id], id).toMatch(/\.$/);
        expect(spoken[id], id).not.toMatch(/[,.;:]{2,}|\s[,.;:]|\s{2,}|\bde de\b/);
      }
    });
  }

  it("reads BBO as its letters and percentages as words, in each language", () => {
    expect(speakable("es", "BBO, 7%")).toBe("be be o, siete por ciento");
    expect(speakable("en", "BBO, 7%")).toBe("B B O, seven per cent");
    expect(spokenIn("es")["proposals.tax"]).toContain("be be o, siete por ciento");
    expect(spokenIn("en")["proposals.tax"]).toContain("B B O, seven per cent");
    expect(spokenIn("es")["proposals.phases"]).toContain("cien por ciento");
    expect(spokenIn("en")["proposals.phases"]).toContain("one hundred per cent");
  });

  it("only overrides steps that exist", () => {
    const ids = new Set(PROPOSAL_GUIDE_STEPS.map((s) => s.id));
    for (const [lang, overrides] of Object.entries(PROPOSALS_GUIDE.spoken)) {
      for (const id of Object.keys(overrides)) expect(ids.has(id), `${lang}/${id}`).toBe(true);
    }
  });

  // This IS the script each voice reads. A change to a card shows up here as a
  // changed sentence to listen to again.
  it("says exactly this, in Spanish", () => {
    expect(spokenIn("es")).toMatchInlineSnapshot(`
      {
        "proposals.addFee": "Paso once. Agregar línea de honorarios. Agrega otra línea, por ejemplo para interiorismo o ingeniería. Para quitar una línea use el icono de papelera que está al final.",
        "proposals.client": "Paso cuatro. Cliente. Elija el cliente al que va dirigida la propuesta. Si aún no está en la lista, elija Nuevo cliente y créelo aquí mismo.",
        "proposals.contact": "Paso seis. Nombre de contacto y Correo de contacto. La persona a quien se dirige la propuesta y el correo al que se le envía.",
        "proposals.costBasis": "Paso ocho. Base de costo. De dónde se calculan los honorarios por porcentaje. Elija la base, por ejemplo costo estimado de construcción, y escriba su importe. Ejemplo: dos millones quinientos mil. Esta sección aparece cuando una línea usa porcentaje de la base de costo.",
        "proposals.currency": "Paso siete. Moneda. La moneda en la que se muestran todos los importes de la propuesta.",
        "proposals.discount": "Paso dieciséis. Descuento. Opcional. Póngale nombre, elija el Tipo, porcentaje o Fijo, y escriba el Valor.",
        "proposals.feeType": "Paso diez. Tipo. Base es la oferta principal. Opcional se ofrece aparte y solo cuenta cuando marca Seleccionado, incluir en el total. Adicional es para servicios extra.",
        "proposals.fees": "Paso nueve. Honorarios profesionales. Una línea por disciplina o servicio. Póngale nombre y elija cómo se cobra: porcentaje de la base de costo, honorarios fijos, por hora y otros. El importe se calcula a la derecha.",
        "proposals.listHint": "Empiece aquí. Cree una propuesta con Nueva propuesta, o abra una y elija Editar, para iniciar la guía interactiva.",
        "proposals.narrative": "Paso dieciocho. Descripción del alcance y condiciones. Describa el trabajo con sus palabras: resumen del alcance, exclusiones y supuestos. Encierre una frase entre dos asteriscos a cada lado para imprimirla en negrita.",
        "proposals.number": "Paso tres. Número de propuesta. Déjelo en blanco y se asigna el siguiente número de su secuencia. Si escribe uno, debe ser único.",
        "proposals.payment": "Paso trece. Calendario de pagos. Opcional. Agregue un hito por cada pago, con su porcentaje del total general. Entre todos deben sumar cien por ciento.",
        "proposals.phases": "Paso doce. Fases de diseño. Cómo se reparte el honorario base entre las fases del trabajo. Dé un porcentaje a cada fase; entre todas deben sumar cien por ciento.",
        "proposals.project": "Paso cinco. Proyecto. Vincule la propuesta a un proyecto, o elija Nuevo proyecto para crearlo. Un proyecto pertenece a un cliente, así que elija primero el cliente.",
        "proposals.reimbursables": "Paso catorce. Gastos reembolsables. Gastos que traslada al cliente, como impresión, viajes y tasas de permisos. Se suman al subtotal.",
        "proposals.save": "Paso veintiuno. Guardar. Crear propuesta guarda una propuesta nueva; en una existente el botón dice Guardar cambios. Después, en la página de la propuesta encuentra Imprimir o vista previa, Enviar propuesta por correo, Nueva revisión y las acciones de estado. Cuando la oferta se acepta, allí aparece también Panel del proyecto.",
        "proposals.scope": "Paso diecisiete. Alcance de los servicios. Enumere lo que está incluido y lo que está excluido. Agregar elemento de alcance añade una fila: con la casilla marcada dice Incluido y sin marcar, Excluido. La lista se imprime en la propuesta en este mismo orden; las flechas suben o bajan una fila.",
        "proposals.summary": "Paso veintidós. Resumen en vivo. Los totales se actualizan mientras escribe: Honorario base, Subtotal, Impuesto y Total general. Aquí también aparecen los avisos cuando falta algún dato.",
        "proposals.tax": "Paso quince. Nombre y porcentaje del impuesto. Escriba el nombre del impuesto y su porcentaje. Ejemplo: be be o, siete por ciento. Aparece como Impuesto en el Resumen en vivo.",
        "proposals.template": "Paso uno. Empezar desde una plantilla. Opcional. Elija una plantilla para un tipo de proyecto habitual y se rellenan los honorarios, las fases y el alcance. Después puede editarlo todo.",
        "proposals.terms": "Paso diecinueve. Términos y condiciones. Las condiciones de su oferta, como la forma de pago y qué ocurre si cambia el alcance.",
        "proposals.title": "Paso dos. Título. Dele a la propuesta un título claro: el servicio y el proyecto. Ejemplo: Servicios de diseño arquitectónico, Residencia Palm Beach.",
        "proposals.validity": "Paso veinte. Válido hasta. El último día en que el cliente puede aceptar la oferta. Marque Mostrar el cálculo de honorarios al cliente para imprimir cómo se calculó cada honorario.",
      }
    `);
  });

  it("says exactly this, in English", () => {
    expect(spokenIn("en")).toMatchInlineSnapshot(`
      {
        "proposals.addFee": "Step eleven. Add fee line. Adds another line, for example for interior design or engineering. To remove a line, use the bin icon at its end.",
        "proposals.client": "Step four. Client. Choose the client this proposal is for. If they are not in the list yet, pick New client and add them right here.",
        "proposals.contact": "Step six. Contact name and Contact email. The person the proposal is addressed to, and the address it is emailed to.",
        "proposals.costBasis": "Step eight. Cost basis. What the percentage fees are calculated from. Choose the basis, for example estimated construction cost, and enter its amount. Example: two and a half million. This section appears when a fee line uses percentage of cost basis.",
        "proposals.currency": "Step seven. Currency. The currency every amount in this proposal is shown in.",
        "proposals.discount": "Step sixteen. Discount. Optional. Name the discount, choose its Type, a percentage or Fixed, and enter the Value.",
        "proposals.feeType": "Step ten. Type. Base is the main offer. Optional is offered separately and only counts when you tick Selected, include in total. Additional is for extra services.",
        "proposals.fees": "Step nine. Professional fees. One line per discipline or service. Name the line, then choose how it is priced: percentage of cost basis, Fixed fee, Hourly and others. The amount is worked out on the right.",
        "proposals.listHint": "Start here. Create a proposal with New Proposal, or open one and choose Edit, to start the guided tour.",
        "proposals.narrative": "Step eighteen. Scope narrative and terms. Describe the work in your own words: scope summary, exclusions and assumptions. Wrap a phrase in two asterisks on each side to print it bold.",
        "proposals.number": "Step three. Proposal number. Leave it blank and the next number in your sequence is assigned automatically. If you type one, it must be unique.",
        "proposals.payment": "Step thirteen. Payment schedule. Optional. Add a milestone for each payment, with its share of the grand total. Together they should total one hundred per cent.",
        "proposals.phases": "Step twelve. Design phases. How the base fee is spread over the phases of the work. Give each phase a percentage; together they should total one hundred per cent.",
        "proposals.project": "Step five. Project. Link the proposal to a project, or pick New project to create one. A project belongs to a client, so choose the client first.",
        "proposals.reimbursables": "Step fourteen. Reimbursable expenses. Costs you pass on to the client, such as printing, travel and permit fees. They are added to the subtotal.",
        "proposals.save": "Step twenty-one. Save. Create proposal saves a new proposal; on an existing one the button reads Save changes. The proposal page then has Print or Preview, Email proposal, New revision and the status actions. Once the offer is accepted, Project Dashboard appears there too.",
        "proposals.scope": "Step seventeen. Scope of services. List what is included and what is excluded. Add scope item adds a row: ticked it reads Included, unticked Excluded. The list is printed on the proposal in this order; the arrows move a row up or down.",
        "proposals.summary": "Step twenty-two. Live summary. The totals update as you type: Base fee, Subtotal, Tax and the Grand total. Warnings about missing figures appear here too.",
        "proposals.tax": "Step fifteen. Tax name and tax percentage. Name the tax and enter its percentage. Example: B B O, seven per cent. It shows as Tax in the Live summary.",
        "proposals.template": "Step one. Start from a template. Optional. Pick a template for a common project type and it fills in the fees, phases and scope for you. Everything stays editable.",
        "proposals.terms": "Step nineteen. Terms and conditions. The conditions of your offer, such as how payment is made and what happens if the scope changes.",
        "proposals.title": "Step two. Title. Give the proposal a clear title: the service and the project. Example: Architectural design services, Palm Beach Residence.",
        "proposals.validity": "Step twenty. Valid until. The last day the client can accept this offer. Tick Show fee derivation to the client to print how each fee was calculated.",
      }
    `);
  });
});

describe("the guide engine: two definitions, one lookup", () => {
  it("knows both guides, each with its own namespace", () => {
    expect(GUIDES.map((g) => g.id)).toEqual(["estimates", "proposals"]);
    expect(ESTIMATES_GUIDE.clipNamespace).toBe("");
    expect(PROPOSALS_GUIDE.clipNamespace).toBe("proposals");
    expect(new Set(GUIDES.map((g) => g.clipNamespace)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((g) => g.list.path)).size).toBe(GUIDES.length);
    expect(guideById("proposals")).toBe(PROPOSALS_GUIDE);
    expect(guideById("estimates")).toBe(ESTIMATES_GUIDE);
    for (const id of ["", "Proposals", "__proto__", "constructor", null, undefined, 3]) expect(guideById(id), String(id)).toBeNull();
  });

  it("offers both guides in Spanish and English and in no other shipped language", () => {
    for (const guide of GUIDES) {
      for (const lang of LANG_CODES) {
        const offered = guideEnabledFor(lang) && guideContentIn(guide, lang) !== null;
        expect({ guide: guide.id, lang, offered }).toEqual({ guide: guide.id, lang, offered: lang === "es" || lang === "en" });
        expect(narrationEntries(lang, guide).length > 0, `${guide.id} ${lang}`).toBe(lang === "es" || lang === "en");
      }
      for (const lang of ["ES", "En", "", "es-AR", null, undefined]) expect(guideEnabledFor(lang) && guideContentIn(guide, lang) !== null).toBe(false);
    }
  });

  it("builds clip ids: bare for Estimates, namespaced for every other guide", () => {
    expect(clipIdFor(ESTIMATES_GUIDE, "area")).toBe("area");
    expect(clipIdFor(PROPOSALS_GUIDE, "client")).toBe("proposals.client");
    expect(resolveClipId("area")).toEqual({ guide: ESTIMATES_GUIDE, stepId: "area" });
    expect(resolveClipId("proposals.client")).toEqual({ guide: PROPOSALS_GUIDE, stepId: "client" });
    for (const id of ["", ".", ".client", "proposals.", "proposals.client.x", "estimates.area", "nope.client", "__proto__.client", null, 4]) {
      expect(resolveClipId(id), String(id)).toBeNull();
    }
  });

  it("shares step names between guides without ever crossing them", () => {
    // "client" is a step of both guides.
    expect(ESTIMATES_GUIDE.steps.some((s) => s.id === "client")).toBe(true);
    expect(PROPOSALS_GUIDE.steps.some((s) => s.id === "client")).toBe(true);
    for (const lang of ["es", "en"]) {
      const estimates = narrationEntry(lang, "client")!;
      const proposals = narrationEntry(lang, "proposals.client")!;
      expect(estimates.stepId).toBe("client");
      expect(proposals.stepId).toBe("proposals.client");
      expect(estimates.text).not.toBe(proposals.text);
      expect(estimates.text).toBe(narrationEntries(lang, ESTIMATES_GUIDE).find((e) => e.stepId === "client")!.text);
      expect(proposals.text).toBe(spokenIn(lang)["proposals.client"]);
    }
  });

  it("refuses a step asked for under the wrong guide, and anything that is not a step", () => {
    const bad: unknown[] = [
      // Estimates steps under the proposals namespace, and the other way round.
      "proposals.area", "proposals.colQty", "proposals.pickerHint", "template", "costBasis", "listHint", "feeType",
      // Not steps at all.
      "proposals", "proposals.", "proposals.nope", "proposals.__proto__", "proposals.constructor", "proposals.client ", " proposals.client",
      "Proposals.client", "proposals.Client", "proposals/client", "proposals..client", "proposals.client.client", "estimates.client",
      "proposals.Please read this aloud", "sp-client", "", null, undefined, {}, ["proposals.client"], 7,
    ];
    for (const lang of ["es", "en"]) for (const id of bad) expect(narrationEntry(lang, id), `${lang} ${String(id)}`).toBeNull();
    for (const lang of ["nl", "de", "ES", "", null]) expect(narrationEntry(lang, "proposals.client"), String(lang)).toBeNull();
  });

  it("files every Service Proposals clip under its own name, apart from every Estimates clip", () => {
    const keys = (guide: typeof ESTIMATES_GUIDE) =>
      ["es", "en"].flatMap((lang) =>
        narrationEntries(lang, guide).map((e) =>
          clipCacheKey(e, { text: e.text, voice: NARRATION_LANGUAGES[lang].defaultVoice, model: DEFAULT_NARRATION_MODEL }),
        ),
      );
    const estimates = keys(ESTIMATES_GUIDE);
    const proposals = keys(PROPOSALS_GUIDE);
    expect(estimates).toHaveLength(60);
    expect(proposals).toHaveLength(46);
    expect(new Set([...estimates, ...proposals]).size).toBe(106);
    for (const k of proposals) {
      expect(k).toMatch(/^guide-narration\/(es|en)-proposals\.[A-Za-z0-9]+-[0-9a-f]{32}\.mp3$/);
      expect(isNarrationCacheKey(k), k).toBe(true);
    }
    for (const k of estimates) {
      expect(k).toMatch(/^guide-narration\/(es|en)-[A-Za-z0-9]+-[0-9a-f]{32}\.mp3$/);
      expect(isNarrationCacheKey(k), k).toBe(true);
    }
    for (const k of [
      "guide-narration/es-proposals.client.x-" + "a".repeat(32) + ".mp3",
      "guide-narration/es-Proposals.client-" + "a".repeat(32) + ".mp3",
      "guide-narration/es-proposals..client-" + "a".repeat(32) + ".mp3",
      "guide-narration/es-.client-" + "a".repeat(32) + ".mp3",
      "guide-narration/es-proposals/client-" + "a".repeat(32) + ".mp3",
    ]) {
      expect(isNarrationCacheKey(k), k).toBe(false);
    }
  });
});
