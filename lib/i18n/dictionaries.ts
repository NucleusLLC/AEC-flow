/**
 * Lightweight i18n. The English string is the lookup key, so any UI string
 * becomes translatable just by wrapping it in `t("…")`; missing translations
 * fall back to the English text. Start with the navigation + chrome; expand
 * page bodies incrementally.
 */

export type Lang = "en" | "es" | "nl" | "de" | "zh" | "pt";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "SP" },
  { code: "nl", label: "Nederlands", short: "NL" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "pt", label: "Português", short: "PT" },
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

const de: Dict = {
  "Business Development": "Geschäftsentwicklung",
  Delivery: "Ausführung",
  "Construction Administration": "Bauadministration",
  People: "Personen",
  Dashboard: "Dashboard",
  Clients: "Kunden",
  Estimates: "Kalkulationen",
  "Cost Database": "Kostendatenbank",
  Proposals: "Angebote",
  Orders: "Aufträge",
  Schedule: "Terminplan",
  Tasks: "Aufgaben",
  Projects: "Projekte",
  "Land Development": "Grundstücksentwicklung",
  "Construction Admin": "Bauadmin.",
  "Meeting Minutes": "Protokolle",
  Drawings: "Zeichnungen",
  Documents: "Dokumente",
  Team: "Team",
  Chat: "Chat",
  Leave: "Abwesenheit",
  Activity: "Aktivität",
  Reports: "Berichte",
  Imports: "Importe",
  Exports: "Exporte",
  Widgets: "Widgets",
  "Beta Reports": "Beta-Meldungen",
  Settings: "Einstellungen",
  Soon: "Bald",
  New: "Neu",
  Save: "Speichern",
  "Search…": "Suchen…",
  "Full screen": "Vollbild",
  "Exit full screen": "Beenden",
  Language: "Sprache",
  "Active Projects": "Aktive Projekte",
  "Pipeline Value": "Pipeline-Wert",
  "Awaiting Approval": "Warten auf Freigabe",
  "Team Utilisation": "Teamauslastung",
  "Here's what's happening across the practice today.": "Das passiert heute im Büro.",
  "View reports": "Berichte ansehen",
  "View all": "Alle ansehen",
  "Live delivery across the studio": "Laufende Ausführung im Büro",
  "Out of Office": "Abwesend",
  "On leave this week": "Diese Woche abwesend",
  "Proposals Pipeline": "Angebots-Pipeline",
  "Recent Activity": "Letzte Aktivität",
  "No recent activity.": "Keine aktuelle Aktivität.",
  "Good morning": "Guten Morgen",
  "Good afternoon": "Guten Tag",
  "Good evening": "Guten Abend",
  "left in your free beta access": "verbleibend in deinem kostenlosen Beta-Zugang",
  'Tap "New Bug/Wish" anytime to send feedback.': 'Tippe jederzeit auf „Neuer Bug/Wunsch", um Feedback zu senden.',
  "Cost Estimation": "Kostenschätzung",
  "Project Schedule": "Projektterminplan",
  "Construction Administration & Reporting": "Bauadministration und Berichtswesen",
  "Developers, government bodies, and private accounts — and their full proposal-to-project history.":
    "Bauträger, öffentliche Stellen und private Kunden – mit ihrer gesamten Historie vom Angebot bis zum Projekt.",
  "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.":
    "Wähle ein Projekt, um seine Leistungsverzeichnis-Kalkulation zu öffnen: Arbeitsnormen, Material, Geräte und Nachunternehmer summieren sich pro Abschnitt, mit Gewinn und Gemeinkosten auf die Gesamtsumme.",
  "Pick a project to view its programme — phase timelines and dependencies.":
    "Wähle ein Projekt, um seinen Ablauf anzuzeigen: Phasenterminplan und Abhängigkeiten.",
  "Fee proposals from draft to approval — pipeline value, follow-ups, and win rate.":
    "Honorarangebote vom Entwurf bis zur Freigabe: Pipeline-Wert, Nachfassaktionen und Erfolgsquote.",
  "Live delivery across disciplines — phases, progress, and project teams.":
    "Laufende Ausführung über alle Disziplinen: Phasen, Fortschritt und Projektteams.",
  "Project controls across change orders, RFIs, progress reports and lender certifications.":
    "Projektsteuerung: Nachträge, RFIs, Fortschrittsberichte und Zertifizierungen für Kreditgeber.",
  "Record meetings, decisions, and follow-up actions across every project.":
    "Erfasse Besprechungen, Entscheidungen und Folgeaufgaben über alle Projekte.",
  "Pick a project to open its drawing set — every plan and sheet by discipline and revision.":
    "Wähle ein Projekt, um seinen Zeichnungssatz zu öffnen: jeder Plan und jedes Blatt nach Disziplin und Revision.",
  "Manage your practice profile, proposal templates, members, and preferences.":
    "Verwalte dein Büroprofil, Angebotsvorlagen, Mitglieder und Einstellungen.",
  "Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.":
    "Praktische persönliche Tools: Stechuhr, Weltuhren und ein schnelles Kanban-Board. Im Browser gespeichert.",
  "Bug reports and wishes sent by beta testers from the in-app Feedback button.":
    "Fehlermeldungen und Wünsche von Beta-Testern über die Feedback-Schaltfläche in der App.",
  "Practice analytics across proposals and project delivery.":
    "Büroanalysen zu Angeboten und Projektabwicklung.",
};

const pt: Dict = {
  "Business Development": "Desenvolvimento comercial",
  Delivery: "Execução",
  "Construction Administration": "Administração de obra",
  People: "Pessoas",
  Dashboard: "Painel",
  Clients: "Clientes",
  Estimates: "Orçamentos",
  "Cost Database": "Base de custos",
  Proposals: "Propostas",
  Orders: "Pedidos",
  Schedule: "Cronograma",
  Tasks: "Tarefas",
  Projects: "Projetos",
  "Land Development": "Desenvolvimento de terrenos",
  "Construction Admin": "Adm. de obra",
  "Meeting Minutes": "Atas de reunião",
  Drawings: "Desenhos",
  Documents: "Documentos",
  Team: "Equipe",
  Chat: "Chat",
  Leave: "Ausências",
  Activity: "Atividade",
  Reports: "Relatórios",
  Imports: "Importações",
  Exports: "Exportações",
  Widgets: "Widgets",
  "Beta Reports": "Relatórios beta",
  Settings: "Configurações",
  Soon: "Em breve",
  New: "Novo",
  Save: "Salvar",
  "Search…": "Pesquisar…",
  "Full screen": "Tela cheia",
  "Exit full screen": "Sair",
  Language: "Idioma",
  "Active Projects": "Projetos ativos",
  "Pipeline Value": "Valor do funil",
  "Awaiting Approval": "Aguardando aprovação",
  "Team Utilisation": "Utilização da equipe",
  "Here's what's happening across the practice today.": "Veja o que está acontecendo no escritório hoje.",
  "View reports": "Ver relatórios",
  "View all": "Ver tudo",
  "Live delivery across the studio": "Execução em andamento no escritório",
  "Out of Office": "Ausente",
  "On leave this week": "De licença esta semana",
  "Proposals Pipeline": "Funil de propostas",
  "Recent Activity": "Atividade recente",
  "No recent activity.": "Sem atividade recente.",
  "Good morning": "Bom dia",
  "Good afternoon": "Boa tarde",
  "Good evening": "Boa noite",
  "left in your free beta access": "restantes no seu acesso beta gratuito",
  'Tap "New Bug/Wish" anytime to send feedback.': 'Toque em "Novo Bug/Desejo" para enviar feedback.',
  "Cost Estimation": "Estimativa de custos",
  "Project Schedule": "Cronograma do projeto",
  "Construction Administration & Reporting": "Administração de obra e relatórios",
  "Developers, government bodies, and private accounts — and their full proposal-to-project history.":
    "Incorporadoras, órgãos públicos e contas privadas — com todo o histórico da proposta ao projeto.",
  "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.":
    "Selecione um projeto para abrir seu orçamento por itens: normas de mão de obra, materiais, equipamentos e subempreiteiros somam por seção, com lucro e despesas gerais aplicados ao total.",
  "Pick a project to view its programme — phase timelines and dependencies.":
    "Escolha um projeto para ver seu programa: cronograma de fases e dependências.",
  "Fee proposals from draft to approval — pipeline value, follow-ups, and win rate.":
    "Propostas de honorários do rascunho à aprovação: valor do funil, acompanhamentos e taxa de sucesso.",
  "Live delivery across disciplines — phases, progress, and project teams.":
    "Execução em andamento entre disciplinas: fases, progresso e equipes de projeto.",
  "Project controls across change orders, RFIs, progress reports and lender certifications.":
    "Controle de obra: ordens de mudança, RFIs, relatórios de progresso e certificações para financiadores.",
  "Record meetings, decisions, and follow-up actions across every project.":
    "Registre reuniões, decisões e ações de acompanhamento em todos os projetos.",
  "Pick a project to open its drawing set — every plan and sheet by discipline and revision.":
    "Escolha um projeto para abrir seu conjunto de desenhos: cada planta e prancha por disciplina e revisão.",
  "Manage your practice profile, proposal templates, members, and preferences.":
    "Gerencie o perfil do escritório, modelos de propostas, membros e preferências.",
  "Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.":
    "Ferramentas pessoais úteis: relógio de ponto, relógios mundiais e um quadro Kanban rápido. Salvo no navegador.",
  "Bug reports and wishes sent by beta testers from the in-app Feedback button.":
    "Relatos de bugs e desejos enviados por testadores beta pelo botão de Feedback no app.",
  "Practice analytics across proposals and project delivery.":
    "Análises do escritório sobre propostas e entrega de projetos.",
};

const zh: Dict = {
  "Business Development": "业务拓展",
  Delivery: "交付",
  "Construction Administration": "施工管理",
  People: "人员",
  Dashboard: "仪表板",
  Clients: "客户",
  Estimates: "估算",
  "Cost Database": "成本数据库",
  Proposals: "提案",
  Orders: "订单",
  Schedule: "进度计划",
  Tasks: "任务",
  Projects: "项目",
  "Land Development": "土地开发",
  "Construction Admin": "施工管理",
  "Meeting Minutes": "会议纪要",
  Drawings: "图纸",
  Documents: "文档",
  Team: "团队",
  Chat: "聊天",
  Leave: "休假",
  Activity: "动态",
  Reports: "报表",
  Imports: "导入",
  Exports: "导出",
  Widgets: "小工具",
  "Beta Reports": "测试反馈",
  Settings: "设置",
  Soon: "即将推出",
  New: "新建",
  Save: "保存",
  "Search…": "搜索…",
  "Full screen": "全屏",
  "Exit full screen": "退出",
  Language: "语言",
  "Active Projects": "进行中的项目",
  "Pipeline Value": "商机价值",
  "Awaiting Approval": "待审批",
  "Team Utilisation": "团队利用率",
  "Here's what's happening across the practice today.": "以下是今天事务所的动态。",
  "View reports": "查看报表",
  "View all": "查看全部",
  "Live delivery across the studio": "事务所的实时交付",
  "Out of Office": "不在办公室",
  "On leave this week": "本周休假",
  "Proposals Pipeline": "提案管道",
  "Recent Activity": "最近动态",
  "No recent activity.": "暂无最近动态。",
  "Good morning": "早上好",
  "Good afternoon": "下午好",
  "Good evening": "晚上好",
  "left in your free beta access": "免费测试访问剩余时间",
  'Tap "New Bug/Wish" anytime to send feedback.': '随时点击"新建 Bug/心愿"发送反馈。',
  "Cost Estimation": "成本估算",
  "Project Schedule": "项目进度计划",
  "Construction Administration & Reporting": "施工管理与报告",
  "Developers, government bodies, and private accounts — and their full proposal-to-project history.":
    "开发商、政府机构和私人客户——及其从提案到项目的完整历史。",
  "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.":
    "选择一个项目以打开其工程量清单估算：人工定额、材料、设备和分包成本按分部汇总，并对总额应用利润和管理费。",
  "Pick a project to view its programme — phase timelines and dependencies.":
    "选择一个项目以查看其计划：阶段进度与依赖关系。",
  "Fee proposals from draft to approval — pipeline value, follow-ups, and win rate.":
    "从草稿到批准的费用提案：管道价值、跟进和中标率。",
  "Live delivery across disciplines — phases, progress, and project teams.":
    "跨专业的实时交付：阶段、进度和项目团队。",
  "Project controls across change orders, RFIs, progress reports and lender certifications.":
    "项目控制：变更单、RFI、进度报告和贷方证明。",
  "Record meetings, decisions, and follow-up actions across every project.":
    "记录每个项目的会议、决策和后续行动。",
  "Pick a project to open its drawing set — every plan and sheet by discipline and revision.":
    "选择一个项目以打开其图纸集：按专业和版本的每张图纸。",
  "Manage your practice profile, proposal templates, members, and preferences.":
    "管理您的事务所资料、提案模板、成员和偏好设置。",
  "Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.":
    "实用的个人工具：打卡钟、世界时钟和快速看板。保存在您的浏览器中。",
  "Bug reports and wishes sent by beta testers from the in-app Feedback button.":
    "测试人员通过应用内反馈按钮发送的 Bug 报告和心愿。",
  "Practice analytics across proposals and project delivery.":
    "关于提案和项目交付的事务所分析。",
};

export const DICT: Record<Lang, Dict> = { en: {}, es, nl, de, zh, pt };

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
