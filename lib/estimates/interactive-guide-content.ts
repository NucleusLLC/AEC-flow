/**
 * Card text for the Estimates INTERACTIVE-GUIDE, one block per language the
 * guide is offered in (GUIDE_LANGS in interactive-guide.ts).
 *
 * This text deliberately does NOT go through the app dictionaries: the guide is
 * offered in Spanish and English only, and a dictionary key must exist in all
 * six translations. Adding a language is one more block here plus its code in
 * GUIDE_LANGS; interactive-guide.test.ts fails if either is done without the
 * other.
 *
 * The Spanish follows the owner's annotated screenshot. The English is written
 * for the English screen, not translated from the Spanish: every control is
 * called what the English editor calls it ("Qty", "Total Hrs", "Mark-ups &
 * Total", and "Labor" spelled as the screen spells it), and it only describes
 * what that screen has. Prose is British ("metres"). Examples are generic: no
 * currency, no country.
 */
import type { Lang } from "@/lib/i18n/types";
import type { GuideContent } from "./interactive-guide";

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
    module: {
      title: "Módulo",
      body: "Aquí ve el módulo en el que está trabajando. Ábralo para cambiar de módulo.",
    },
    projectNo: {
      title: "N.º de proyecto",
      body: "Código del proyecto. Puede crear un número interno. Ejemplo: 2026-001.",
    },
    client: {
      title: "Cliente",
      body: "Nombre del cliente. Ejemplo: Acme Development.",
    },
    version: {
      title: "Versión",
      body: "Versión del presupuesto. Puede dejar la actual (V1.0) o crear una nueva si hace cambios.",
    },
    date: {
      title: "Fecha",
      body: "Coloque la fecha con formato dd/mm/aaaa.",
    },
    location: {
      title: "Ubicación",
      body: "Escriba dónde se ejecutará la obra.",
    },
    area: {
      title: "Área construida",
      body: "Ingrese el área en metros cuadrados (m²). Ejemplo: 83,8.",
    },
    sideMenu: {
      title: "Menú lateral",
      body: "Aquí navega entre los módulos del sistema (proyectos, configuración, finanzas, etc.).",
    },
    pricing: {
      title: "Precios",
      body: "Aquí define la tarifa media de mano de obra (por hora). Puede cargar una plantilla o guardar el presupuesto como plantilla.",
    },
    costBase: {
      title: "Base de costos",
      body: "Seleccione cómo desea ver la información:",
      points: [
        { term: "Avance", text: "muestra el avance de la obra." },
        { term: "Cliente", text: "vista para presentar al cliente." },
        { term: "$ USD", text: "muestra también los importes en dólares." },
        { term: "Control de impresión", text: "configura el reporte." },
        { term: "Base de datos", text: "usa su base de costos." },
      ],
    },
    totalCost: {
      title: "Costo total del proyecto",
      body: "Aquí se muestra automáticamente el costo total según lo que vaya diligenciando.",
    },
    status: {
      title: "Estado del presupuesto",
      body: "Indica si se ha guardado correctamente y si está conectado con la base de datos.",
    },
    table: {
      title: "Tabla de partidas",
      body: "Aquí registra cada actividad del proyecto (ej. demolición, muros, pisos, etc.). Cada fila es una partida.",
    },
    subtotal: {
      title: "Subtotal por sección",
      body: "Se calcula automáticamente el total de las partidas de esa sección.",
    },
    directCost: {
      title: "Costo directo",
      body: "Sumatoria de todas las partidas del proyecto.",
    },
    totalDirect: {
      title: "Total de costos directos",
      body: "Muestra el total general de todas las secciones.",
    },
    addSection: {
      title: "Agregar sección",
      body: "Sirve para crear una nueva sección del proyecto (ej. Estructura, Acabados, Instalaciones, etc.).",
    },
    summary: {
      title: "Resumen de costos",
      body: "Aquí se muestra el total por tipo de recurso (mano de obra, material, equipo, subcontratista) y el porcentaje sobre el total.",
    },
    markups: {
      title: "Recargos y total",
      body: "Aquí puede agregar porcentajes de gastos generales o utilidades y se calculará el total final.",
    },
    item: {
      title: "Elemento",
      body: "Con este botón puede agregar una nueva fila (partida) a la sección. Para eliminar una fila, use el icono de papelera que está a su derecha.",
    },
    colQty: {
      title: "Cant.",
      body: "Cantidad de la partida, en la unidad de medida seleccionada.",
    },
    colUnit: {
      title: "Unidad",
      body: "Seleccione la unidad de medida. Ejemplos: m³, m, m², und, kg, etc.",
    },
    colNorm: {
      title: "Norma h/u",
      body: "Horas por unidad según la norma.",
    },
    colHours: {
      title: "Horas totales",
      body: "Se calculan automáticamente: cantidad x norma.",
    },
    colLabor: {
      title: "Costo de mano de obra",
      body: "Se calcula automáticamente según las horas y la tarifa.",
    },
    colMaterial: {
      title: "Material",
      body: "Costo unitario: precio del material. Total: cantidad x costo unitario.",
    },
    colEquipment: {
      title: "Equipo",
      body: "Costo unitario: valor del equipo. Total: cantidad x costo unitario.",
    },
    colSub: {
      title: "Subcontratista",
      body: "Costo unitario: valor por unidad del subcontratista. Total: cantidad x costo unitario.",
    },
    colProgress: {
      title: "Avance",
      body: "% Avance: porcentaje de ejecución de la partida. Importe avance: se calcula automáticamente.",
    },
  },
  picker: {
    title: "Empiece aquí",
    body: "Abra un proyecto de la lista, o cree uno con Nuevo presupuesto, para iniciar la guía interactiva del presupuesto.",
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
    module: {
      title: "Module",
      body: "This shows the module you are working in. Open it to switch to another module.",
    },
    projectNo: {
      title: "Project No.",
      body: "The project's reference code. You can use your own internal numbering. Example: 2026-001.",
    },
    client: {
      title: "Client",
      body: "The client's name. Example: Acme Development.",
    },
    version: {
      title: "Version",
      body: "The version of this estimate. Keep the current one (V1.0), or create a new version when you make changes.",
    },
    date: {
      title: "Date",
      body: "The date of the estimate. Type it in, or pick it from the calendar.",
    },
    location: {
      title: "Location",
      body: "Where the work will be carried out.",
    },
    area: {
      title: "Built-up Area (m²)",
      body: "Enter the built-up area in square metres. Example: 83.8.",
    },
    sideMenu: {
      title: "Side menu",
      body: "From here you move between the different parts of the system, such as projects, finance and settings.",
    },
    pricing: {
      title: "Pricing",
      body: "Set the Average Labor Rate (per hour) here. Use Load template… to start from a template, or Save as… to keep this estimate as one.",
    },
    costBase: {
      title: "Cost Database and View",
      body: "Choose where your costs come from and how the estimate is shown:",
      points: [
        { term: "Cost Database", text: "the source your costs are taken from." },
        { term: "Progress", text: "shows the progress of the work." },
        { term: "Client", text: "a simplified view to present to the client." },
        { term: "$ USD", text: "also shows the amounts in US dollars." },
        { term: "Print Control", text: "sets up the printed report." },
      ],
    },
    totalCost: {
      title: "Total construction cost",
      body: "The total cost of the estimate, updated automatically as you fill it in.",
    },
    status: {
      title: "Save status",
      body: "Tells you whether your latest changes have been saved. The estimate saves itself as you type.",
    },
    table: {
      title: "Estimate table",
      body: "Enter each task of the project here (e.g. demolition, walls, floors). Each row is one item.",
    },
    subtotal: {
      title: "Subtotal",
      body: "The total of the items in that section, calculated automatically.",
    },
    directCost: {
      title: "Direct Cost",
      body: "The sum of every item in the estimate, column by column.",
    },
    totalDirect: {
      title: "Total Direct Costs",
      body: "The overall total of all the sections.",
    },
    addSection: {
      title: "Add section",
      body: "Creates a new section of the estimate (e.g. Structure, Finishes, Services).",
    },
    summary: {
      title: "Cost by Section",
      body: "The direct cost split into Labor, Material, Equipment and Subcontractor, each with its percentage of the total.",
    },
    markups: {
      title: "Mark-ups & Total",
      body: "Add General Conditions / Overhead and your Profit & Risk percentage here. The Grand Total is calculated for you.",
    },
    item: {
      title: "Item",
      body: "This button adds a new row (an item) to the section. To remove a row, use the bin icon at its right-hand end.",
    },
    colQty: {
      title: "Qty",
      body: "The quantity of the item, in the unit of measure you select.",
    },
    colUnit: {
      title: "Unit",
      body: "Select the unit of measure. Examples: m³, m², m, kg, ton.",
    },
    colNorm: {
      title: "Norm hrs/u",
      body: "Labor hours per unit, according to the norm.",
    },
    colHours: {
      title: "Total Hrs",
      body: "Calculated automatically: quantity x norm.",
    },
    colLabor: {
      title: "Labor Cost",
      body: "Calculated automatically from the hours and the labor rate.",
    },
    colMaterial: {
      title: "Material",
      body: "Unit Cost: the price of the material per unit. Total: quantity x unit cost.",
    },
    colEquipment: {
      title: "Equipment",
      body: "Unit Cost: the cost of the equipment per unit. Total: quantity x unit cost.",
    },
    colSub: {
      title: "Subcontractor",
      body: "Unit Cost: the subcontractor's price per unit. Total: quantity x unit cost.",
    },
    colProgress: {
      title: "Progress",
      body: "POC %: the percentage of the item that is complete. Prog. Amt: the progress amount, calculated automatically.",
    },
  },
  picker: {
    title: "Start here",
    body: "Open a project from the list, or create one with New estimate, to start the guided tour of the estimate.",
  },
};

export const GUIDE_CONTENT: Partial<Record<Lang, GuideContent>> = { es, en };

/** The card text for a language, or null when the guide has none for it. */
export function guideContentFor(lang: string | null | undefined): GuideContent | null {
  if (typeof lang !== "string") return null;
  return (GUIDE_CONTENT as Record<string, GuideContent | undefined>)[lang] ?? null;
}
