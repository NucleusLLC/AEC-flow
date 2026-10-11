/**
 * Card text for the Estimates INTERACTIVE-GUIDE, one block per language the
 * guide is offered in (GUIDE_LANGS in interactive-guide.ts).
 *
 * This text deliberately does NOT go through the app dictionaries: the guide is
 * being tried in Spanish only, and a dictionary key must exist in all six
 * translations. Adding a language here and to GUIDE_LANGS is all it takes to
 * widen it; interactive-guide.test.ts fails if either is done without the other.
 *
 * The Spanish follows the owner's annotated screenshot. Examples are generic:
 * no currency, no country.
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
      body: "Aquí ves el módulo en el que estás trabajando. Ábrelo para cambiar de módulo.",
    },
    projectNo: {
      title: "N.º de proyecto",
      body: "Código del proyecto. Puedes crear un número interno. Ejemplo: 2026-001.",
    },
    client: {
      title: "Cliente",
      body: "Nombre del cliente. Ejemplo: Acme Development.",
    },
    version: {
      title: "Versión",
      body: "Versión del presupuesto. Puedes dejar la actual (V1.0) o crear una nueva si haces cambios.",
    },
    date: {
      title: "Fecha",
      body: "Coloca la fecha con formato dd/mm/aaaa.",
    },
    location: {
      title: "Ubicación",
      body: "Escribe dónde se ejecutará la obra.",
    },
    area: {
      title: "Área construida",
      body: "Ingresa el área en metros cuadrados (m²). Ejemplo: 83,8.",
    },
    sideMenu: {
      title: "Menú lateral",
      body: "Aquí navegas entre los módulos del sistema (proyectos, configuración, finanzas, etc.).",
    },
    pricing: {
      title: "Precios",
      body: "Aquí defines la tarifa media de mano de obra (por hora). Puedes cargar una plantilla o guardar el presupuesto como plantilla.",
    },
    costBase: {
      title: "Base de costos",
      body: "Selecciona cómo deseas ver la información:",
      points: [
        { term: "Avance", text: "muestra el avance de la obra." },
        { term: "Cliente", text: "vista para presentar al cliente." },
        { term: "$ USD", text: "muestra también los importes en dólares." },
        { term: "Control de impresión", text: "configura el reporte." },
        { term: "Base de datos", text: "usa tu base de costos." },
      ],
    },
    totalCost: {
      title: "Costo total del proyecto",
      body: "Aquí se muestra automáticamente el costo total según lo que vayas diligenciando.",
    },
    status: {
      title: "Estado del presupuesto",
      body: "Indica si se ha guardado correctamente y si está conectado con la base de datos.",
    },
    table: {
      title: "Tabla de partidas",
      body: "Aquí registras cada actividad del proyecto (ej. demolición, muros, pisos, etc.). Cada fila es una partida.",
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
      body: "Aquí puedes agregar porcentajes de gastos generales o utilidades y se calculará el total final.",
    },
    item: {
      title: "Elemento",
      body: "Con este botón puedes agregar una nueva fila (partida) al presupuesto. También puedes duplicar o eliminar la fila con los iconos de la derecha.",
    },
    colQty: {
      title: "Cant.",
      body: "Cantidad de la partida, en la unidad de medida seleccionada.",
    },
    colUnit: {
      title: "Unidad",
      body: "Selecciona la unidad de medida. Ejemplos: m³, m, m², und, kg, etc.",
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
};

export const GUIDE_CONTENT: Partial<Record<Lang, GuideContent>> = { es };

/** The card text for a language, or null when the guide has none for it. */
export function guideContentFor(lang: string | null | undefined): GuideContent | null {
  if (typeof lang !== "string") return null;
  return (GUIDE_CONTENT as Record<string, GuideContent | undefined>)[lang] ?? null;
}
