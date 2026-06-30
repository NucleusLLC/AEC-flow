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
  // Module page headers
  "Cost Estimation": "Estimación de costos",
  "Project Schedule": "Cronograma del proyecto",
  "Construction Administration & Reporting": "Administración de obra e informes",
  "Developers, government bodies, and private accounts — and their full proposal-to-project history.":
    "Promotores, organismos públicos y cuentas privadas, con todo su historial de propuesta a proyecto.",
  "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.":
    "Selecciona un proyecto para abrir su presupuesto por partidas: normas de mano de obra, materiales, equipo y subcontratos se suman por sección, con beneficio y gastos generales aplicados al total.",
  "Pick a project to view its programme — phase timelines and dependencies.":
    "Elige un proyecto para ver su programa: cronograma de fases y dependencias.",
  "Fee proposals from draft to approval — pipeline value, follow-ups, and win rate.":
    "Propuestas de honorarios de borrador a aprobación: valor en cartera, seguimientos y tasa de éxito.",
  "Live delivery across disciplines — phases, progress, and project teams.":
    "Entrega en curso entre disciplinas: fases, avance y equipos de proyecto.",
  "Project controls across change orders, RFIs, progress reports and lender certifications.":
    "Control de obra: órdenes de cambio, RFIs, informes de avance y certificaciones para financistas.",
  "Record meetings, decisions, and follow-up actions across every project.":
    "Registra reuniones, decisiones y acciones de seguimiento en todos los proyectos.",
  "Pick a project to open its drawing set — every plan and sheet by discipline and revision.":
    "Elige un proyecto para abrir su juego de planos: cada plano y lámina por disciplina y revisión.",
  "Manage your practice profile, proposal templates, members, and preferences.":
    "Gestiona el perfil de la práctica, plantillas de propuestas, miembros y preferencias.",
  "Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.":
    "Herramientas personales: reloj de fichaje, relojes mundiales y un tablero Kanban rápido. Guardado en tu navegador.",
  "Bug reports and wishes sent by beta testers from the in-app Feedback button.":
    "Reportes de errores y deseos enviados por los probadores beta desde el botón de Feedback en la app.",
  "Practice analytics across proposals and project delivery.":
    "Analítica de la práctica sobre propuestas y entrega de proyectos.",
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
  // Module page headers
  "Cost Estimation": "Kostenraming",
  "Project Schedule": "Projectplanning",
  "Construction Administration & Reporting": "Bouwadministratie en rapportage",
  "Developers, government bodies, and private accounts — and their full proposal-to-project history.":
    "Ontwikkelaars, overheden en particuliere accounts — met hun volledige historie van offerte tot project.",
  "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.":
    "Kies een project om de hoeveelhedenbegroting te openen: arbeidsnormen, materialen, materieel en onderaannemers tellen per sectie op, met winst en algemene kosten over het totaal.",
  "Pick a project to view its programme — phase timelines and dependencies.":
    "Kies een project om de planning te bekijken: faseplanning en afhankelijkheden.",
  "Fee proposals from draft to approval — pipeline value, follow-ups, and win rate.":
    "Offertes van concept tot goedkeuring: pijplijnwaarde, opvolging en winratio.",
  "Live delivery across disciplines — phases, progress, and project teams.":
    "Lopende uitvoering over disciplines heen: fasen, voortgang en projectteams.",
  "Project controls across change orders, RFIs, progress reports and lender certifications.":
    "Projectbeheersing: meerwerk, RFI's, voortgangsrapporten en certificeringen voor financiers.",
  "Record meetings, decisions, and follow-up actions across every project.":
    "Leg vergaderingen, besluiten en actiepunten vast voor elk project.",
  "Pick a project to open its drawing set — every plan and sheet by discipline and revision.":
    "Kies een project om de tekeningenset te openen: elke tekening en blad per discipline en revisie.",
  "Manage your practice profile, proposal templates, members, and preferences.":
    "Beheer je bureauprofiel, offertesjablonen, leden en voorkeuren.",
  "Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.":
    "Handige persoonlijke tools: prikklok, wereldklokken en een snel Kanban-bord. Opgeslagen in je browser.",
  "Bug reports and wishes sent by beta testers from the in-app Feedback button.":
    "Bugmeldingen en wensen verstuurd door beta-testers via de Feedback-knop in de app.",
  "Practice analytics across proposals and project delivery.":
    "Bureau-analyses over offertes en projectuitvoering.",
};

export const DICT: Record<Lang, Dict> = { en: {}, es, nl };

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
