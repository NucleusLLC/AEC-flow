/**
 * Lightweight i18n. The English string is the lookup key, so any UI string
 * becomes translatable just by wrapping it in `t("…")`; missing translations
 * fall back to the English text. Start with the navigation + chrome; expand
 * page bodies incrementally.
 */

export type Lang = "en" | "es" | "nl";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "SP" },
  { code: "nl", label: "Nederlands", short: "NL" },
];

export const DEFAULT_LANG: Lang = "en";

type Dict = Record<string, string>;

const es: Dict = {
  // Sections
  "Business Development": "Desarrollo comercial",
  Delivery: "Entrega",
  "Construction Administration": "Administración de obra",
  People: "Personas",
  // Nav
  Dashboard: "Panel",
  Clients: "Clientes",
  Estimates: "Presupuestos",
  "Cost Database": "Base de costos",
  Proposals: "Propuestas",
  Orders: "Pedidos",
  Schedule: "Cronograma",
  Tasks: "Tareas",
  Projects: "Proyectos",
  "Land Development": "Desarrollo de terrenos",
  "Construction Admin": "Admin. de obra",
  "Meeting Minutes": "Actas de reunión",
  Drawings: "Planos",
  Documents: "Documentos",
  Team: "Equipo",
  Chat: "Chat",
  Leave: "Ausencias",
  Activity: "Actividad",
  Reports: "Informes",
  Imports: "Importar",
  Exports: "Exportar",
  Widgets: "Widgets",
  "Beta Reports": "Reportes beta",
  Settings: "Configuración",
  // Common chrome
  Soon: "Pronto",
  New: "Nuevo",
  Save: "Guardar",
  "Search…": "Buscar…",
  "Full screen": "Pantalla completa",
  "Exit full screen": "Salir",
  Language: "Idioma",
  // Dashboard + common
  "Active Projects": "Proyectos activos",
  "Pipeline Value": "Valor en cartera",
  "Awaiting Approval": "Pendiente de aprobación",
  "Team Utilisation": "Utilización del equipo",
  "Here's what's happening across the practice today.":
    "Esto es lo que sucede hoy en la práctica.",
  "View reports": "Ver informes",
  "View all": "Ver todo",
  "Live delivery across the studio": "Entrega en curso del estudio",
  "Out of Office": "Fuera de oficina",
  "On leave this week": "De licencia esta semana",
  "Proposals Pipeline": "Cartera de propuestas",
  "Recent Activity": "Actividad reciente",
  "No recent activity.": "Sin actividad reciente.",
  "Good morning": "Buenos días",
  "Good afternoon": "Buenas tardes",
  "Good evening": "Buenas noches",
  "left in your free beta access": "restantes de tu acceso beta gratuito",
  'Tap "New Bug/Wish" anytime to send feedback.':
    'Pulsa "Nuevo Bug/Deseo" para enviar comentarios.',
};

const nl: Dict = {
  "Business Development": "Acquisitie",
  Delivery: "Uitvoering",
  "Construction Administration": "Bouwadministratie",
  People: "Mensen",
  Dashboard: "Dashboard",
  Clients: "Klanten",
  Estimates: "Begrotingen",
  "Cost Database": "Kostendatabase",
  Proposals: "Offertes",
  Orders: "Opdrachten",
  Schedule: "Planning",
  Tasks: "Taken",
  Projects: "Projecten",
  "Land Development": "Gebiedsontwikkeling",
  "Construction Admin": "Bouwadministratie",
  "Meeting Minutes": "Notulen",
  Drawings: "Tekeningen",
  Documents: "Documenten",
  Team: "Team",
  Chat: "Chat",
  Leave: "Verlof",
  Activity: "Activiteit",
  Reports: "Rapporten",
  Imports: "Importeren",
  Exports: "Exporteren",
  Widgets: "Widgets",
  "Beta Reports": "Beta-meldingen",
  Settings: "Instellingen",
  Soon: "Binnenkort",
  New: "Nieuw",
  Save: "Opslaan",
  "Search…": "Zoeken…",
  "Full screen": "Volledig scherm",
  "Exit full screen": "Sluiten",
  Language: "Taal",
  // Dashboard + common
  "Active Projects": "Actieve projecten",
  "Pipeline Value": "Pijplijnwaarde",
  "Awaiting Approval": "Wacht op goedkeuring",
  "Team Utilisation": "Teambezetting",
  "Here's what's happening across the practice today.":
    "Dit speelt er vandaag binnen het bureau.",
  "View reports": "Rapporten bekijken",
  "View all": "Alles bekijken",
  "Live delivery across the studio": "Lopende uitvoering van het bureau",
  "Out of Office": "Afwezig",
  "On leave this week": "Deze week met verlof",
  "Proposals Pipeline": "Offertepijplijn",
  "Recent Activity": "Recente activiteit",
  "No recent activity.": "Geen recente activiteit.",
  "Good morning": "Goedemorgen",
  "Good afternoon": "Goedemiddag",
  "Good evening": "Goedenavond",
  "left in your free beta access": "resterend in je gratis beta-toegang",
  'Tap "New Bug/Wish" anytime to send feedback.':
    'Tik op "Nieuwe Bug/Wens" om feedback te sturen.',
};

export const DICT: Record<Lang, Dict> = { en: {}, es, nl };

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
