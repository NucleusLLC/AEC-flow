/**
 * INTERACTIVE-GUIDE for the Service Proposal form (new and edit): its steps,
 * its card text in Spanish and English, and how that text is spoken. One
 * definition, run by the same engine as the Estimates guide (lib/guide/).
 *
 * The tour walks the form from top to bottom, in the order a person fills it
 * in. A step names its target by a `data-guide="sp-…"` attribute on the form;
 * a step whose target is not on the page is skipped, never an error. That is
 * how the tour fits both modes and every proposal:
 *   - "Start from a template" exists only on a new proposal;
 *   - "Cost basis" exists only while a fee line is priced as a percentage;
 *   - the Type row and its "Selected" tick exist once per fee line.
 *
 * Both languages are written for their own screen, not translated from each
 * other: every control is called what the form calls it in that language (a
 * test holds each quoted label to the dictionary). Examples are generic: no
 * client of ours, no currency.
 *
 * Pure data: no Prisma, no React, no DOM.
 */
import type { GuideContent, GuideStep, GuideTone } from "@/lib/estimates/interactive-guide";
import type { GuideDefinition } from "@/lib/guide/definition";
import type { SpokenOverride } from "@/lib/guide-narration/spoken";

const step = (
  number: number,
  id: string,
  tone: GuideTone,
  targets: string | readonly string[],
  match: GuideStep["match"] = "first",
): GuideStep => ({ id, number, tone, targets: typeof targets === "string" ? [targets] : targets, match });

/** The tour, in the order it runs: top of the form to the bottom, then the summary beside it. */
export const PROPOSAL_GUIDE_STEPS: readonly GuideStep[] = [
  step(1, "template", "pink", "sp-template"),
  step(2, "title", "blue", "sp-title"),
  step(3, "number", "purple", "sp-number"),
  step(4, "client", "green", "sp-client"),
  step(5, "project", "orange", "sp-project"),
  step(6, "contact", "pink", ["sp-contact-name", "sp-contact-email"], "union"),
  step(7, "currency", "blue", "sp-currency"),
  step(8, "costBasis", "purple", "sp-basis"),
  step(9, "fees", "green", "sp-fees"),
  step(10, "feeType", "orange", "sp-fee-type"),
  step(11, "addFee", "pink", "sp-add-fee"),
  step(12, "phases", "blue", "sp-phases"),
  step(13, "payment", "purple", "sp-payment"),
  step(14, "reimbursables", "green", "sp-reimbursables"),
  step(15, "tax", "orange", "sp-tax"),
  step(16, "discount", "pink", "sp-discount"),
  step(17, "scope", "blue", "sp-scope"),
  step(18, "narrative", "purple", "sp-narrative"),
  step(19, "terms", "green", "sp-terms"),
  step(20, "validity", "orange", "sp-validity"),
  step(21, "save", "pink", "sp-save"),
  step(22, "summary", "blue", "sp-summary"),
];

/** Step id of the one card on the Service Proposals list. Not a step of the tour. */
export const PROPOSAL_GUIDE_LIST_HINT_ID = "listHint";

const es: GuideContent = {
  ui: {
    start: "Iniciar la guía interactiva de esta pantalla",
    stop: "Detener la guía interactiva",
    back: "Atrás",
    next: "Siguiente",
    pause: "Pausa",
    resume: "Continuar",
    close: "Cerrar la guía",
    mute: "Silenciar la narración",
    unmute: "Activar la narración",
    label: "Guía interactiva",
  },
  steps: {
    template: {
      title: "Empezar desde una plantilla",
      body: "Opcional. Elige una plantilla para un tipo de proyecto habitual y se rellenan los honorarios, las fases y el alcance. Después puedes editarlo todo.",
    },
    title: {
      title: "Título",
      body: "Dale a la propuesta un título claro: el servicio y el proyecto. Ejemplo: Servicios de diseño arquitectónico, Residencia Palm Beach.",
    },
    number: {
      title: "Número de propuesta",
      body: "Déjalo en blanco y se asigna el siguiente número de tu secuencia. Si escribes uno, debe ser único.",
    },
    client: {
      title: "Cliente",
      body: "Elige el cliente al que va dirigida la propuesta. Si aún no está en la lista, elige + Nuevo cliente y créalo aquí mismo.",
    },
    project: {
      title: "Proyecto",
      body: "Vincula la propuesta a un proyecto, o elige + Nuevo proyecto para crearlo. Un proyecto pertenece a un cliente, así que elige primero el cliente.",
    },
    contact: {
      title: "Nombre de contacto y Correo de contacto",
      body: "La persona a quien se dirige la propuesta y el correo al que se le envía.",
    },
    currency: {
      title: "Moneda",
      body: "La moneda en la que se muestran todos los importes de la propuesta.",
    },
    costBasis: {
      title: "Base de costo",
      body: "De dónde se calculan los honorarios por porcentaje. Elige la Base, por ejemplo Costo estimado de construcción, y escribe su Importe. Ejemplo: 2.500.000. Esta sección aparece cuando una línea usa % de la base de costo.",
    },
    fees: {
      title: "Honorarios profesionales",
      body: "Una línea por disciplina o servicio. Ponle nombre y elige cómo se cobra: % de la base de costo, Honorarios fijos, Por hora y otros. El importe se calcula a la derecha.",
    },
    feeType: {
      title: "Tipo",
      body: "Base es la oferta principal. Opcional se ofrece aparte y solo cuenta cuando marcas Seleccionado (incluir en el total). Adicional es para servicios extra.",
    },
    addFee: {
      title: "Agregar línea de honorarios",
      body: "Agrega otra línea, por ejemplo para interiorismo o ingeniería. Para quitar una línea usa el icono de papelera que está al final.",
    },
    phases: {
      title: "Fases de diseño",
      body: "Cómo se reparte el honorario base entre las fases del trabajo. Da un porcentaje a cada fase; entre todas deben sumar 100%.",
    },
    payment: {
      title: "Calendario de pagos",
      body: "Opcional. Agrega un hito por cada pago, con su porcentaje del total general. Entre todos deben sumar 100%.",
    },
    reimbursables: {
      title: "Gastos reembolsables",
      body: "Gastos que trasladas al cliente, como impresión, viajes y tasas de permisos. Se suman al subtotal.",
    },
    tax: {
      title: "Nombre del impuesto e Impuesto %",
      body: "Escribe el nombre del impuesto y su porcentaje. Ejemplo: BBO, 7%. Aparece como Impuesto en el Resumen en vivo.",
    },
    discount: {
      title: "Descuento",
      body: "Opcional. Ponle nombre, elige el Tipo, porcentaje o Fijo, y escribe el Valor.",
    },
    scope: {
      title: "Alcance de los servicios",
      body: "Enumera lo que está incluido y lo que está excluido. Agregar elemento de alcance añade una fila: con la casilla marcada dice Incluido y sin marcar, Excluido. La lista se imprime en la propuesta en este mismo orden; las flechas suben o bajan una fila.",
    },
    narrative: {
      title: "Descripción del alcance y condiciones",
      body: "Describe el trabajo con tus palabras: Resumen del alcance, Exclusiones y Supuestos. Encierra una frase entre ** para imprimirla en negrita.",
    },
    terms: {
      title: "Términos y condiciones",
      body: "Las condiciones de tu oferta, como la forma de pago y qué ocurre si cambia el alcance.",
    },
    validity: {
      title: "Válido hasta",
      body: "El último día en que el cliente puede aceptar la oferta. Marca Mostrar el cálculo de honorarios al cliente para imprimir cómo se calculó cada honorario.",
    },
    save: {
      title: "Guardar",
      body: "Crear propuesta guarda una propuesta nueva; en una existente el botón dice Guardar cambios. Después, en la página de la propuesta encuentras Imprimir / vista previa, Enviar propuesta por correo, Nueva revisión y las acciones de estado. Cuando la oferta se acepta, allí aparece también Panel del proyecto.",
    },
    summary: {
      title: "Resumen en vivo",
      body: "Los totales se actualizan mientras escribes: Honorario base, Subtotal, Impuesto y Total general. Aquí también aparecen los avisos cuando falta algún dato.",
    },
  },
  picker: {
    title: "Empieza aquí",
    body: "Crea una propuesta con Nueva propuesta, o abre una y elige Editar, para iniciar la guía interactiva.",
  },
};

const en: GuideContent = {
  ui: {
    start: "Start the interactive guide for this screen",
    stop: "Stop the interactive guide",
    back: "Back",
    next: "Next",
    pause: "Pause",
    resume: "Resume",
    close: "Close the guide",
    mute: "Mute the narration",
    unmute: "Turn the narration on",
    label: "Interactive guide",
  },
  steps: {
    template: {
      title: "Start from a template",
      body: "Optional. Pick a template for a common project type and it fills in the fees, phases and scope for you. Everything stays editable.",
    },
    title: {
      title: "Title",
      body: "Give the proposal a clear title: the service and the project. Example: Architectural design services, Palm Beach Residence.",
    },
    number: {
      title: "Proposal number",
      body: "Leave it blank and the next number in your sequence is assigned automatically. If you type one, it must be unique.",
    },
    client: {
      title: "Client",
      body: "Choose the client this proposal is for. If they are not in the list yet, pick + New client and add them right here.",
    },
    project: {
      title: "Project",
      body: "Link the proposal to a project, or pick + New project to create one. A project belongs to a client, so choose the client first.",
    },
    contact: {
      title: "Contact name and Contact email",
      body: "The person the proposal is addressed to, and the address it is emailed to.",
    },
    currency: {
      title: "Currency",
      body: "The currency every amount in this proposal is shown in.",
    },
    costBasis: {
      title: "Cost basis",
      body: "What the percentage fees are calculated from. Choose the Basis, for example Estimated construction cost, and enter its Amount. Example: 2,500,000. This section appears when a fee line uses % of cost basis.",
    },
    fees: {
      title: "Professional fees",
      body: "One line per discipline or service. Name the line, then choose how it is priced: % of cost basis, Fixed fee, Hourly and others. The amount is worked out on the right.",
    },
    feeType: {
      title: "Type",
      body: "Base is the main offer. Optional is offered separately and only counts when you tick Selected (include in total). Additional is for extra services.",
    },
    addFee: {
      title: "Add fee line",
      body: "Adds another line, for example for interior design or engineering. To remove a line, use the bin icon at its end.",
    },
    phases: {
      title: "Design phases",
      body: "How the base fee is spread over the phases of the work. Give each phase a percentage; together they should total 100%.",
    },
    payment: {
      title: "Payment schedule",
      body: "Optional. Add a milestone for each payment, with its share of the grand total. Together they should total 100%.",
    },
    reimbursables: {
      title: "Reimbursable expenses",
      body: "Costs you pass on to the client, such as printing, travel and permit fees. They are added to the subtotal.",
    },
    tax: {
      title: "Tax name and Tax %",
      body: "Name the tax and enter its percentage. Example: BBO, 7%. It shows as Tax in the Live summary.",
    },
    discount: {
      title: "Discount",
      body: "Optional. Name the discount, choose its Type, a percentage or Fixed, and enter the Value.",
    },
    scope: {
      title: "Scope of services",
      body: "List what is included and what is excluded. Add scope item adds a row: ticked it reads Included, unticked Excluded. The list is printed on the proposal in this order; the arrows move a row up or down.",
    },
    narrative: {
      title: "Scope narrative & terms",
      body: "Describe the work in your own words: Scope summary, Exclusions and Assumptions. Wrap a phrase in ** to print it bold.",
    },
    terms: {
      title: "Terms & conditions",
      body: "The conditions of your offer, such as how payment is made and what happens if the scope changes.",
    },
    validity: {
      title: "Valid until",
      body: "The last day the client can accept this offer. Tick Show fee derivation to the client to print how each fee was calculated.",
    },
    save: {
      title: "Save",
      body: "Create proposal saves a new proposal; on an existing one the button reads Save changes. The proposal page then has Print / Preview, Email proposal, New revision and the status actions. Once the offer is accepted, Project Dashboard appears there too.",
    },
    summary: {
      title: "Live summary",
      body: "The totals update as you type: Base fee, Subtotal, Tax and the Grand total. Warnings about missing figures appear here too.",
    },
  },
  picker: {
    title: "Start here",
    body: "Create a proposal with New Proposal, or open one and choose Edit, to start the guided tour.",
  },
};

/**
 * Spanish spoken overrides. Each is here because a rule could not get it
 * right, and says why.
 */
const spokenEs: Record<string, SpokenOverride> = {
  // "+" is part of the menu entry's label; aloud it is just the entry.
  client: {
    body: "Elige el cliente al que va dirigida la propuesta. Si aún no está en la lista, elige Nuevo cliente y créalo aquí mismo.",
  },
  project: {
    body: "Vincula la propuesta a un proyecto, o elige Nuevo proyecto para crearlo. Un proyecto pertenece a un cliente, así que elige primero el cliente.",
  },
  // A figure in the millions is said as a figure, not as three groups of digits.
  costBasis: {
    body: "De dónde se calculan los honorarios por porcentaje. Elige la base, por ejemplo costo estimado de construcción, y escribe su importe. Ejemplo: dos millones quinientos mil. Esta sección aparece cuando una línea usa porcentaje de la base de costo.",
  },
  // "% de la base de costo" is a menu entry; the rule would say "porcentaje de de la base".
  fees: {
    body: "Una línea por disciplina o servicio. Ponle nombre y elige cómo se cobra: porcentaje de la base de costo, honorarios fijos, por hora y otros. El importe se calcula a la derecha.",
  },
  // The bracket is part of a label; read as an aside it breaks the sentence.
  feeType: {
    body: "Base es la oferta principal. Opcional se ofrece aparte y solo cuenta cuando marcas Seleccionado, incluir en el total. Adicional es para servicios extra.",
  },
  // "Impuesto %" is a field label.
  tax: {
    title: "Nombre y porcentaje del impuesto",
    body: "Escribe el nombre del impuesto y su porcentaje. Ejemplo: be be o, siete por ciento. Aparece como Impuesto en el Resumen en vivo.",
  },
  // Two asterisks are typed, not read as symbols.
  narrative: {
    body: "Describe el trabajo con tus palabras: resumen del alcance, exclusiones y supuestos. Encierra una frase entre dos asteriscos a cada lado para imprimirla en negrita.",
  },
  // The slash is part of a button's label.
  save: {
    body: "Crear propuesta guarda una propuesta nueva; en una existente el botón dice Guardar cambios. Después, en la página de la propuesta encuentras Imprimir o vista previa, Enviar propuesta por correo, Nueva revisión y las acciones de estado. Cuando la oferta se acepta, allí aparece también Panel del proyecto.",
  },
};

/** English spoken overrides, for the same reasons. */
const spokenEn: Record<string, SpokenOverride> = {
  client: {
    body: "Choose the client this proposal is for. If they are not in the list yet, pick New client and add them right here.",
  },
  project: {
    body: "Link the proposal to a project, or pick New project to create one. A project belongs to a client, so choose the client first.",
  },
  costBasis: {
    body: "What the percentage fees are calculated from. Choose the basis, for example estimated construction cost, and enter its amount. Example: two and a half million. This section appears when a fee line uses percentage of cost basis.",
  },
  feeType: {
    body: "Base is the main offer. Optional is offered separately and only counts when you tick Selected, include in total. Additional is for extra services.",
  },
  tax: {
    title: "Tax name and tax percentage",
    body: "Name the tax and enter its percentage. Example: B B O, seven per cent. It shows as Tax in the Live summary.",
  },
  narrative: {
    body: "Describe the work in your own words: scope summary, exclusions and assumptions. Wrap a phrase in two asterisks on each side to print it bold.",
  },
};

export const PROPOSALS_GUIDE: GuideDefinition = {
  id: "proposals",
  title: "Service Proposals",
  clipNamespace: "proposals",
  steps: PROPOSAL_GUIDE_STEPS,
  content: { es, en },
  spoken: { es: spokenEs, en: spokenEn },
  list: {
    path: "/design/service-proposals",
    hintId: PROPOSAL_GUIDE_LIST_HINT_ID,
    target: { by: "marker", name: "sp-new" },
  },
};
