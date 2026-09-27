/**
 * Workspace strings: Team, Leave, Chat, Activity, Beta reports, Exports/Imports,
 * Forms, Module dashboards, Reports, Search and Widgets. Every key needs BOTH a
 * Spanish and a Dutch value (lib/i18n/coverage.test.ts).
 */
import type { AreaDict } from "../types";

export const workspace: AreaDict = {
  es: {
    "Team Members":
      "Miembros del equipo",
    "{count} active":
      "{count} activos",
    "On Leave":
      "De licencia",
    "this week":
      "esta semana",
    "Avg Utilisation":
      "Utilización media",
    "across the studio":
      "en todo el estudio",
    "Over-allocated":
      "Sobreasignados",
    "above 100% capacity":
      "por encima del 100% de capacidad",
    "Staff across disciplines and departments — roles, capacity, and current allocation.":
      "Personal de todas las disciplinas y departamentos: funciones, capacidad y asignación actual.",
    "Add Member":
      "Añadir miembro",
    "Add Team Member":
      "Añadir miembro del equipo",
    "Add a new member to the studio directory.":
      "Añada un nuevo miembro al directorio del estudio.",
    "Edit Team Member":
      "Editar miembro del equipo",
    "Update {name}’s details in the studio directory.":
      "Actualice los datos de {name} en el directorio del estudio.",
    "About":
      "Acerca de",
    "Current Projects":
      "Proyectos actuales",
    "No active project assignments.":
      "Sin asignaciones a proyectos activos.",
    "Action Items":
      "Acciones pendientes",
    "due {date}":
      "vence el {date}",
    "No open action items.":
      "No hay acciones pendientes abiertas.",
    "Skills":
      "Habilidades",
    "Contact & Details":
      "Contacto y datos",
    "Office":
      "Oficina",
    "Joined":
      "Fecha de ingreso",
    "Allocation":
      "Asignación",
    "Utilisation":
      "Utilización",
    "Capacity target":
      "Capacidad objetivo",
    "Active projects":
      "Proyectos activos",
    "Annual Leave":
      "Vacaciones anuales",
    "days remaining":
      "días restantes",
    "{taken} of {total} days taken":
      "{taken} de {total} días tomados",
    "Team Member":
      "Miembro del equipo",
    "Back to member":
      "Volver al miembro",
    "Capacity":
      "Capacidad",
    "{taken}/{total} taken":
      "{taken}/{total} tomados",
    "Bio":
      "Biografía",
    "No current project assignments.":
      "Sin asignaciones a proyectos actuales.",
    "Could not update member.":
      "No se pudo actualizar el miembro.",
    "Could not add member.":
      "No se pudo añadir el miembro.",
    "Member details":
      "Datos del miembro",
    "Full name":
      "Nombre completo",
    "Only an administrator or director can change a member's email.":
      "Solo un administrador o director puede cambiar el correo electrónico de un miembro.",
    "Only an administrator or director can change a member's role.":
      "Solo un administrador o director puede cambiar la función de un miembro.",
    "Capacity (%)":
      "Capacidad (%)",
    "Add member":
      "Añadir miembro",
    "Search team…":
      "Buscar en el equipo…",
    "1 active project":
      "1 proyecto activo",
    "{count} active projects":
      "{count} proyectos activos",
    "over-allocated":
      "sobreasignado",
    "No team members match your filters":
      "Ningún miembro del equipo coincide con sus filtros",
    "Try a different search term or department.":
      "Pruebe otro término de búsqueda u otro departamento.",
    "Showing {shown} of {total} team members":
      "Mostrando {shown} de {total} miembros del equipo",
    "Team member":
      "Miembro del equipo",
    "Add a new team member":
      "Añadir un nuevo miembro del equipo",
    "New team member":
      "Nuevo miembro del equipo",
    "Added as active staff on the design team — adjust role and capacity on the team page.":
      "Se añade como personal activo del equipo de diseño; ajuste la función y la capacidad en la página del equipo.",
    "Team seats & invites":
      "Plazas del equipo e invitaciones",
    "1 member":
      "1 miembro",
    "{count} members":
      "{count} miembros",
    "{count} pending":
      "{count} pendientes",
    "of {limit} seats":
      "de {limit} plazas",
    "Only an administrator or director can invite people to this company.":
      "Solo un administrador o director puede invitar a personas a esta empresa.",
    "Invite by email":
      "Invitar por correo electrónico",
    "Sending…":
      "Enviando…",
    "Send invite":
      "Enviar invitación",
    "All seats are in use. Raise this company’s seat limit (founder Admin) or revoke a pending invite.":
      "Todas las plazas están en uso. Aumente el límite de plazas de esta empresa (administrador fundador) o revoque una invitación pendiente.",
    "Invite emailed to {email}. You can also share this link:":
      "Invitación enviada a {email}. También puede compartir este enlace:",
    "Invite created, but the email couldn’t be sent ({reason}). Share this link with them:":
      "Invitación creada, pero no se pudo enviar el correo ({reason}). Comparta este enlace con la persona:",
    "Invite created, but the email couldn’t be sent. Share this link with them:":
      "Invitación creada, pero no se pudo enviar el correo. Comparta este enlace con la persona:",
    "Copied":
      "Copiado",
    "Copy":
      "Copiar",
    "Pending invites":
      "Invitaciones pendientes",
    "expires {date}":
      "vence el {date}",
    "Copy link":
      "Copiar enlace",
    "Revoke":
      "Revocar",
    "No company context.":
      "No hay contexto de empresa.",
    "Enter a valid email address.":
      "Introduzca una dirección de correo electrónico válida.",
    "No seats available — raise the seat limit or revoke a pending invite.":
      "No hay plazas disponibles: aumente el límite de plazas o revoque una invitación pendiente.",
    "That person is already a member of this company.":
      "Esa persona ya es miembro de esta empresa.",
    "Only an administrator or director can invite members.":
      "Solo un administrador o director puede invitar a miembros.",
    "Only an administrator or director can revoke invites.":
      "Solo un administrador o director puede revocar invitaciones.",
    "A member id is required to update.":
      "Se necesita el id del miembro para actualizar.",
    "That member is not in your company.":
      "Ese miembro no pertenece a su empresa.",
    "Failed to save team member.":
      "No se pudo guardar el miembro del equipo.",
    "Only an administrator or director can add someone as an Admin or Director.":
      "Solo un administrador o director puede añadir a alguien como administrador o director.",
    "Only an administrator or director can set a member's status.":
      "Solo un administrador o director puede establecer el estado de un miembro.",
    "Only the founder can change the founder's role, status or email.":
      "Solo el fundador puede cambiar la función, el estado o el correo electrónico del fundador.",
    "Only an administrator or director can change a member's role, status or email.":
      "Solo un administrador o director puede cambiar la función, el estado o el correo electrónico de un miembro.",
    "Director":
      "Director",
    "Staff":
      "Personal",
    "Viewer":
      "Lector",
    "Design":
      "Diseño",
    "Management":
      "Dirección",
    "Finance":
      "Finanzas",
    "Project Manager":
      "Gerente de proyecto",
    "On leave":
      "De licencia",
    "Request Leave":
      "Solicitar ausencia",
    "Submit a leave request for approval.":
      "Envíe una solicitud de ausencia para su aprobación.",
    "Edit Leave Request":
      "Editar solicitud de ausencia",
    "Pending Requests":
      "Solicitudes pendientes",
    "awaiting approval":
      "pendientes de aprobación",
    "Out Today":
      "Ausentes hoy",
    "team members away":
      "miembros del equipo ausentes",
    "Upcoming Leave":
      "Próximas ausencias",
    "approved, not started":
      "aprobadas, sin comenzar",
    "Next Holiday":
      "Próximo feriado",
    "none scheduled":
      "ninguno programado",
    "Requests and approvals, who’s out, and upcoming public holidays.":
      "Solicitudes y aprobaciones, quién está ausente y los próximos feriados.",
    "Out This Week":
      "Ausentes esta semana",
    "{count} away":
      "{count} ausentes",
    "Back {date}":
      "Regresa el {date}",
    "Everyone’s in this week.":
      "Todos están presentes esta semana.",
    "Upcoming Holidays":
      "Próximos feriados",
    "Public":
      "Feriado",
    "Could not submit leave request.":
      "No se pudo enviar la solicitud de ausencia.",
    "Leave request":
      "Solicitud de ausencia",
    "Leave type":
      "Tipo de ausencia",
    "End date":
      "Fecha de fin",
    "Working days requested:":
      "Días laborables solicitados:",
    "(excludes Fri/Sat weekends)":
      "(excluye fines de semana vie/sáb)",
    "Reason (optional)":
      "Motivo (opcional)",
    "Family holiday, medical, etc.":
      "Vacaciones familiares, médico, etc.",
    "Submit request":
      "Enviar solicitud",
    "Search by name…":
      "Buscar por nombre…",
    "Dates":
      "Fechas",
    "Approver":
      "Aprobador",
    "Actions":
      "Acciones",
    "Edit {name}’s leave request":
      "Editar la solicitud de ausencia de {name}",
    "No leave requests match your filters":
      "Ninguna solicitud de ausencia coincide con sus filtros",
    "Showing {shown} of {total} requests":
      "Mostrando {shown} de {total} solicitudes",
    "Failed to save leave request.":
      "No se pudo guardar la solicitud de ausencia.",
    "Annual":
      "Anual",
    "Sick":
      "Enfermedad",
    "Maternity":
      "Maternidad",
    "Paternity":
      "Paternidad",
    "Team Chat":
      "Chat del equipo",
    "Channels, project rooms, and direct messages for the studio.":
      "Canales, salas de proyecto y mensajes directos del estudio.",
    "{count} online":
      "{count} en línea",
    "{count} unread":
      "{count} sin leer",
    "Search channels…":
      "Buscar canales…",
    "Channels":
      "Canales",
    "No channels match.":
      "Ningún canal coincide.",
    "Direct Messages":
      "Mensajes directos",
    "No direct messages.":
      "Sin mensajes directos.",
    "Unknown":
      "Desconocido",
    "you":
      "usted",
    "No messages yet":
      "Aún no hay mensajes",
    "Be the first to say something.":
      "Sea el primero en escribir algo.",
    "Message {name}…":
      "Mensaje para {name}…",
    "Message #{name}…":
      "Mensaje en #{name}…",
    "Enter to send · Shift+Enter for a new line · messages are local until the database is connected":
      "Intro para enviar · Mayús+Intro para una nueva línea · los mensajes son locales hasta que se conecte la base de datos",
    "Today":
      "Hoy",
    "Yesterday":
      "Ayer",
    "Now":
      "Ahora",
    "A live feed of what’s happening across the practice.":
      "Un registro en vivo de lo que sucede en la práctica.",
    "No activity yet":
      "Aún no hay actividad",
    "Actions across proposals, clients, projects and meetings will appear here.":
      "Aquí aparecerán las acciones sobre propuestas, clientes, proyectos y reuniones.",
    "created":
      "creó",
    "updated":
      "actualizó",
    "changed their own password":
      "cambió su propia contraseña",
    "set the password for":
      "estableció la contraseña de",
    "client":
      "cliente",
    "leave request":
      "solicitud de ausencia",
    "meeting":
      "reunión",
    "order":
      "pedido",
    "project":
      "proyecto",
    "proposal":
      "propuesta",
    "team member":
      "miembro del equipo",
    "user":
      "usuario",
    "reports received":
      "reportes recibidos",
    "not yet resolved":
      "aún sin resolver",
    "Bugs":
      "Errores",
    "something broken":
      "algo no funciona",
    "Wishes":
      "Deseos",
    "ideas & requests":
      "ideas y solicitudes",
    "Search reports…":
      "Buscar reportes…",
    "No reports here yet":
      "Aún no hay reportes",
    "Beta testers can send Bug/Wish feedback from the “Feedback” button in any screen.":
      "Los probadores beta pueden enviar errores y deseos con el botón “Feedback” en cualquier pantalla.",
    "Anonymous":
      "Anónimo",
    "Screenshot":
      "Captura de pantalla",
    "Close":
      "Cerrar",
    "Report screenshot":
      "Captura de pantalla del reporte",
    "Beta feedback":
      "Comentarios beta",
    "Report a bug or share a wish":
      "Reporte un error o comparta un deseo",
    "Thanks — it’s on its way!":
      "¡Gracias! Ya está en camino.",
    "Your wish was sent to the team.":
      "Su deseo se envió al equipo.",
    "Your bug report was sent to the team.":
      "Su reporte de error se envió al equipo.",
    "Send another":
      "Enviar otro",
    "Bug":
      "Error",
    "Something’s broken":
      "Algo no funciona",
    "Wish":
      "Deseo",
    "An idea or request":
      "Una idea o solicitud",
    "Summary":
      "Resumen",
    "I wish I could…":
      "Me gustaría poder…",
    "What went wrong?":
      "¿Qué salió mal?",
    "Describe the idea and why it would help…":
      "Describa la idea y por qué ayudaría…",
    "Steps to reproduce, what you expected, what happened…":
      "Pasos para reproducirlo, qué esperaba, qué ocurrió…",
    "Captured screenshot":
      "Captura de pantalla tomada",
    "Capture screenshot":
      "Tomar captura de pantalla",
    "Your browser will ask which screen or window to share.":
      "Su navegador le preguntará qué pantalla o ventana compartir.",
    "Sending as {name}":
      "Enviando como {name}",
    "Sending anonymously":
      "Enviando de forma anónima",
    "Screen capture isn't supported in this browser.":
      "Este navegador no admite la captura de pantalla.",
    "Couldn't read the screen.":
      "No se pudo leer la pantalla.",
    "That screen is too detailed to attach — try a smaller window.":
      "Esa pantalla tiene demasiado detalle para adjuntarla; pruebe con una ventana más pequeña.",
    "Couldn't capture the screen. You can still send the report without it.":
      "No se pudo capturar la pantalla. Aún puede enviar el reporte sin ella.",
    "Add a short summary so we know what this is.":
      "Añada un breve resumen para que sepamos de qué se trata.",
    "Tell us a little more in the description.":
      "Cuéntenos un poco más en la descripción.",
    "A short summary is required.":
      "Se requiere un breve resumen.",
    "Please describe the bug or wish.":
      "Describa el error o el deseo.",
    "Pick whether this is a bug or a wish.":
      "Indique si es un error o un deseo.",
    "Screenshot is too large to send. Try removing it and submitting the text.":
      "La captura de pantalla es demasiado grande para enviarla. Quítela y envíe solo el texto.",
    "Failed to send your report.":
      "No se pudo enviar su reporte.",
    "Failed to update status.":
      "No se pudo actualizar el estado.",
    "Planned":
      "Planificado",
    "Data Export":
      "Exportación de datos",
    "Download any dataset as a CSV — current values straight from the database, ready for Excel, accounting, or reporting. Most also offer a printable A4 directory (Save as PDF).":
      "Descargue cualquier conjunto de datos como CSV, con los valores actuales directamente de la base de datos, listo para Excel, contabilidad o informes. La mayoría también ofrece un directorio A4 imprimible (Guardar como PDF).",
    "Practice Overview (PDF)":
      "Resumen de la práctica (PDF)",
    "Client directory with contacts, type, pipeline & lifetime value.":
      "Directorio de clientes con contactos, tipo, cartera y valor acumulado.",
    "Project register with status, priority, manager and progress.":
      "Registro de proyectos con estado, prioridad, gerente y avance.",
    "Fee proposals with client, status, revision and total fee.":
      "Propuestas de honorarios con cliente, estado, revisión y honorarios totales.",
    "Confirmed engagements with client, service type and fee.":
      "Encargos confirmados con cliente, tipo de servicio y honorarios.",
    "Studio directory with role, department and contact details.":
      "Directorio del estudio con función, departamento y datos de contacto.",
    "Leave requests with type, status, dates and day counts.":
      "Solicitudes de ausencia con tipo, estado, fechas y número de días.",
    "{count} rows":
      "{count} filas",
    "Download CSV":
      "Descargar CSV",
    "Import Clients":
      "Importar clientes",
    "Bulk-add clients from a CSV (e.g. exported from a spreadsheet or another system). Each row becomes a client record in the database.":
      "Añada clientes en bloque desde un CSV (p. ej. exportado de una hoja de cálculo u otro sistema). Cada fila se convierte en un registro de cliente en la base de datos.",
    "required.":
      "obligatoria.",
    "optional.":
      "opcionales.",
    "Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (defaults to Private).":
      "Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (por defecto Private).",
    "Active / Inactive / Prospect (defaults to Active).":
      "Active / Inactive / Prospect (por defecto Active).",
    "separated by":
      "separadas por",
    "Tip: the column headers from {source} are compatible, so you can export, edit, and re-import.":
      "Consejo: los encabezados de columna de {source} son compatibles, así que puede exportar, editar y volver a importar.",
    "Choose CSV file":
      "Elegir archivo CSV",
    "A header row with a “name” column is required.":
      "Se requiere una fila de encabezado con una columna “name”.",
    "Preview — first {shown} of {total} rows":
      "Vista previa: primeras {shown} de {total} filas",
    "Importing…":
      "Importando…",
    "Import 1 client":
      "Importar 1 cliente",
    "Import {count} clients":
      "Importar {count} clientes",
    "Imported {created} of {total} clients.":
      "Se importaron {created} de {total} clientes.",
    "View clients":
      "Ver clientes",
    "1 row skipped:":
      "1 fila omitida:",
    "{count} rows skipped:":
      "{count} filas omitidas:",
    "Row {row} ({name}): {error}":
      "Fila {row} ({name}): {error}",
    "…and {count} more":
      "…y {count} más",
    "Import another file":
      "Importar otro archivo",
    "No data rows found in the file.":
      "No se encontraron filas de datos en el archivo.",
    "The file needs a \"name\" column.":
      "El archivo necesita una columna \"name\".",
    "Could not parse the file as CSV.":
      "No se pudo leer el archivo como CSV.",
    "Missing required column: name":
      "Falta la columna obligatoria: name",
    "Create failed":
      "Error al crear",
    "Forms":
      "Formularios",
    "Standard site & administration form templates — RFIs, instructions, inspections, variations. Preview any form.":
      "Plantillas estándar de formularios de obra y administración: RFIs, instrucciones, inspecciones, variaciones. Previsualice cualquier formulario.",
    "New form":
      "Nuevo formulario",
    "Fields":
      "Campos",
    "{count} templates":
      "{count} plantillas",
    "Search forms…":
      "Buscar formularios…",
    "Code":
      "Código",
    "Form":
      "Formulario",
    "No forms match your search.":
      "Ningún formulario coincide con su búsqueda.",
    "Site Administration":
      "Administración de obra",
    "Quality":
      "Calidad",
    "Safety":
      "Seguridad",
    "Select…":
      "Seleccionar…",
    "Add a new {thing}":
      "Añadir {thing}",
    "record":
      "registro",
    "{field} is required.":
      "{field} es obligatorio.",
    "Nothing on file yet":
      "Aún no hay nada registrado",
    "Construction Estimates & Construction Timeframe":
      "Presupuestos de construcción y plazo de construcción",
    "Read-only overview. Estimates and Schedule open in their own systems — the numbers here come straight from those systems, unchanged.":
      "Resumen de solo lectura. Presupuestos y Cronograma se abren en sus propios sistemas; las cifras de aquí provienen directamente de ellos, sin cambios.",
    "Current estimate":
      "Presupuesto actual",
    "Current total":
      "Total actual",
    "Direct cost":
      "Costo directo",
    "Cost per m²":
      "Costo por m²",
    "Last modified":
      "Última modificación",
    "Version lock":
      "Bloqueo de versión",
    "Locked":
      "Bloqueado",
    "Unlocked":
      "Desbloqueado",
    "Open Estimates":
      "Abrir Presupuestos",
    "Active programme":
      "Programa activo",
    "Overall progress":
      "Avance general",
    "Planned start":
      "Inicio planificado",
    "Planned finish":
      "Fin planificado",
    "Forecast finish":
      "Fin previsto",
    "Schedule variance":
      "Desviación del cronograma",
    "Critical activities":
      "Actividades críticas",
    "Open Schedule":
      "Abrir Cronograma",
    "No schedule for this project yet.":
      "Aún no hay cronograma para este proyecto.",
    "No schedule yet.":
      "Aún no hay cronograma.",
    "Generate from Estimates or Schedule (source data unchanged)":
      "Generar desde Presupuestos o Cronograma (los datos de origen no cambian)",
    "Generate Estimate document":
      "Generar documento de presupuesto",
    "Generate Schedule document":
      "Generar documento de cronograma",
    "View generated documents":
      "Ver documentos generados",
    "Existing estimate PDF":
      "PDF del presupuesto existente",
    "Existing programme PDF":
      "PDF del programa existente",
    "On track":
      "En curso",
    "Watch":
      "Vigilar",
    "At risk":
      "En riesgo",
    "No activities":
      "Sin actividades",
    "draft · issued · partial":
      "borrador · emitida · parcial",
    "Material selection":
      "Selección de materiales",
    "proposed · submitted":
      "propuesta · presentada",
    "Design register":
      "Registro de diseño",
    "By discipline":
      "Por disciplina",
    "This module exposes existing AEC-flow systems — no data is duplicated. Use the sidebar or the shortcuts below.":
      "Este módulo muestra sistemas existentes de AEC-flow; no se duplica ningún dato. Use la barra lateral o los accesos directos de abajo.",
    "Coming soon":
      "Próximamente",
    "Pipeline Value by Status":
      "Valor en cartera por estado",
    "Proposal fee value ({currency})":
      "Honorarios de propuestas ({currency})",
    "value":
      "valor",
    "Projects by Status":
      "Proyectos por estado",
    "Active portfolio breakdown":
      "Desglose de la cartera activa",
    "Projects by Discipline":
      "Proyectos por disciplina",
    "Discipline coverage across the portfolio":
      "Cobertura de disciplinas en la cartera",
    "Proposal Value by Month":
      "Valor de propuestas por mes",
    "When proposals were raised ({currency})":
      "Cuándo se crearon las propuestas ({currency})",
    "{rate}% win rate":
      "{rate}% tasa de éxito",
    "{count} at risk":
      "{count} en riesgo",
    "Portfolio Value":
      "Valor de la cartera",
    "active contract value":
      "valor de contratos activos",
    "Search":
      "Buscar",
    "1 result for":
      "1 resultado para",
    "{count} results for":
      "{count} resultados para",
    "Search across clients, projects, proposals, orders, and team.":
      "Busque en clientes, proyectos, propuestas, pedidos y equipo.",
    "Type a query in the search bar above to begin.":
      "Escriba una consulta en la barra de búsqueda de arriba para empezar.",
    "No matches":
      "Sin coincidencias",
    "Nothing found for “{query}”. Try another term.":
      "No se encontró nada para “{query}”. Pruebe con otro término.",
    "Kanban Board":
      "Tablero Kanban",
    "Delete card":
      "Eliminar tarjeta",
    "Add a card…":
      "Añadir una tarjeta…",
    "Add card":
      "Añadir tarjeta",
    "Drag cards between columns. Saved in this browser.":
      "Arrastre las tarjetas entre columnas. Se guarda en este navegador.",
    "Punch Clock":
      "Reloj de fichaje",
    "Clock out":
      "Fichar salida",
    "Clock in":
      "Fichar entrada",
    "Current session":
      "Sesión actual",
    "Today total":
      "Total de hoy",
    "Today’s sessions":
      "Sesiones de hoy",
    "World Clocks":
      "Relojes mundiales",
    "Add city":
      "Añadir ciudad",
    "Add a city to start.":
      "Añada una ciudad para empezar.",
  },
  nl: {
    "Team Members":
      "Teamleden",
    "{count} active":
      "{count} actief",
    "On Leave":
      "Met verlof",
    "this week":
      "deze week",
    "Avg Utilisation":
      "Gem. bezetting",
    "across the studio":
      "binnen het hele bureau",
    "Over-allocated":
      "Overbezet",
    "above 100% capacity":
      "boven 100% capaciteit",
    "Staff across disciplines and departments — roles, capacity, and current allocation.":
      "Medewerkers over disciplines en afdelingen heen: rollen, capaciteit en huidige inzet.",
    "Add Member":
      "Lid toevoegen",
    "Add Team Member":
      "Teamlid toevoegen",
    "Add a new member to the studio directory.":
      "Voeg een nieuw lid toe aan het bureauoverzicht.",
    "Edit Team Member":
      "Teamlid bewerken",
    "Update {name}’s details in the studio directory.":
      "Werk de gegevens van {name} bij in het bureauoverzicht.",
    "About":
      "Over",
    "Current Projects":
      "Huidige projecten",
    "No active project assignments.":
      "Geen actieve projecttoewijzingen.",
    "Action Items":
      "Actiepunten",
    "due {date}":
      "vervalt {date}",
    "No open action items.":
      "Geen openstaande actiepunten.",
    "Skills":
      "Vaardigheden",
    "Contact & Details":
      "Contact en gegevens",
    "Office":
      "Kantoor",
    "Joined":
      "In dienst sinds",
    "Allocation":
      "Inzet",
    "Utilisation":
      "Bezetting",
    "Capacity target":
      "Capaciteitsdoel",
    "Active projects":
      "Actieve projecten",
    "Annual Leave":
      "Jaarlijks verlof",
    "days remaining":
      "dagen resterend",
    "{taken} of {total} days taken":
      "{taken} van {total} dagen opgenomen",
    "Team Member":
      "Teamlid",
    "Back to member":
      "Terug naar lid",
    "Capacity":
      "Capaciteit",
    "{taken}/{total} taken":
      "{taken}/{total} opgenomen",
    "Bio":
      "Bio",
    "No current project assignments.":
      "Geen huidige projecttoewijzingen.",
    "Could not update member.":
      "Lid kon niet worden bijgewerkt.",
    "Could not add member.":
      "Lid kon niet worden toegevoegd.",
    "Member details":
      "Gegevens van het lid",
    "Full name":
      "Volledige naam",
    "Only an administrator or director can change a member's email.":
      "Alleen een beheerder of directeur kan het e-mailadres van een lid wijzigen.",
    "Only an administrator or director can change a member's role.":
      "Alleen een beheerder of directeur kan de rol van een lid wijzigen.",
    "Capacity (%)":
      "Capaciteit (%)",
    "Add member":
      "Lid toevoegen",
    "Search team…":
      "Team doorzoeken…",
    "1 active project":
      "1 actief project",
    "{count} active projects":
      "{count} actieve projecten",
    "over-allocated":
      "overbezet",
    "No team members match your filters":
      "Geen teamleden voldoen aan je filters",
    "Try a different search term or department.":
      "Probeer een andere zoekterm of afdeling.",
    "Showing {shown} of {total} team members":
      "{shown} van {total} teamleden weergegeven",
    "Team member":
      "Teamlid",
    "Add a new team member":
      "Nieuw teamlid toevoegen",
    "New team member":
      "Nieuw teamlid",
    "Added as active staff on the design team — adjust role and capacity on the team page.":
      "Toegevoegd als actieve medewerker in het ontwerpteam — pas rol en capaciteit aan op de teampagina.",
    "Team seats & invites":
      "Teamplaatsen en uitnodigingen",
    "1 member":
      "1 lid",
    "{count} members":
      "{count} leden",
    "{count} pending":
      "{count} in behandeling",
    "of {limit} seats":
      "van {limit} plaatsen",
    "Only an administrator or director can invite people to this company.":
      "Alleen een beheerder of directeur kan mensen voor dit bedrijf uitnodigen.",
    "Invite by email":
      "Uitnodigen per e-mail",
    "Sending…":
      "Verzenden…",
    "Send invite":
      "Uitnodiging versturen",
    "All seats are in use. Raise this company’s seat limit (founder Admin) or revoke a pending invite.":
      "Alle plaatsen zijn in gebruik. Verhoog de plaatslimiet van dit bedrijf (oprichter-beheerder) of trek een openstaande uitnodiging in.",
    "Invite emailed to {email}. You can also share this link:":
      "Uitnodiging gemaild naar {email}. Je kunt ook deze link delen:",
    "Invite created, but the email couldn’t be sent ({reason}). Share this link with them:":
      "Uitnodiging aangemaakt, maar de e-mail kon niet worden verzonden ({reason}). Deel deze link met de persoon:",
    "Invite created, but the email couldn’t be sent. Share this link with them:":
      "Uitnodiging aangemaakt, maar de e-mail kon niet worden verzonden. Deel deze link met de persoon:",
    "Copied":
      "Gekopieerd",
    "Copy":
      "Kopiëren",
    "Pending invites":
      "Openstaande uitnodigingen",
    "expires {date}":
      "verloopt {date}",
    "Copy link":
      "Link kopiëren",
    "Revoke":
      "Intrekken",
    "No company context.":
      "Geen bedrijfscontext.",
    "Enter a valid email address.":
      "Voer een geldig e-mailadres in.",
    "No seats available — raise the seat limit or revoke a pending invite.":
      "Geen plaatsen beschikbaar — verhoog de plaatslimiet of trek een openstaande uitnodiging in.",
    "That person is already a member of this company.":
      "Die persoon is al lid van dit bedrijf.",
    "Only an administrator or director can invite members.":
      "Alleen een beheerder of directeur kan leden uitnodigen.",
    "Only an administrator or director can revoke invites.":
      "Alleen een beheerder of directeur kan uitnodigingen intrekken.",
    "A member id is required to update.":
      "Voor bijwerken is een lid-id nodig.",
    "That member is not in your company.":
      "Dat lid hoort niet bij jouw bedrijf.",
    "Failed to save team member.":
      "Teamlid opslaan mislukt.",
    "Only an administrator or director can add someone as an Admin or Director.":
      "Alleen een beheerder of directeur kan iemand toevoegen als beheerder of directeur.",
    "Only an administrator or director can set a member's status.":
      "Alleen een beheerder of directeur kan de status van een lid instellen.",
    "Only the founder can change the founder's role, status or email.":
      "Alleen de oprichter kan de rol, status of het e-mailadres van de oprichter wijzigen.",
    "Only an administrator or director can change a member's role, status or email.":
      "Alleen een beheerder of directeur kan de rol, status of het e-mailadres van een lid wijzigen.",
    "Director":
      "Directeur",
    "Staff":
      "Medewerker",
    "Viewer":
      "Kijker",
    "Design":
      "Ontwerp",
    "Management":
      "Management",
    "Finance":
      "Financiën",
    "Project Manager":
      "Projectmanager",
    "On leave":
      "Met verlof",
    "Request Leave":
      "Verlof aanvragen",
    "Submit a leave request for approval.":
      "Dien een verlofaanvraag in ter goedkeuring.",
    "Edit Leave Request":
      "Verlofaanvraag bewerken",
    "Pending Requests":
      "Openstaande aanvragen",
    "awaiting approval":
      "wacht op goedkeuring",
    "Out Today":
      "Vandaag afwezig",
    "team members away":
      "teamleden afwezig",
    "Upcoming Leave":
      "Aankomend verlof",
    "approved, not started":
      "goedgekeurd, nog niet begonnen",
    "Next Holiday":
      "Volgende feestdag",
    "none scheduled":
      "geen gepland",
    "Requests and approvals, who’s out, and upcoming public holidays.":
      "Aanvragen en goedkeuringen, wie er afwezig is en komende feestdagen.",
    "Out This Week":
      "Deze week afwezig",
    "{count} away":
      "{count} afwezig",
    "Back {date}":
      "Terug op {date}",
    "Everyone’s in this week.":
      "Iedereen is er deze week.",
    "Upcoming Holidays":
      "Komende feestdagen",
    "Public":
      "Feestdag",
    "Could not submit leave request.":
      "Verlofaanvraag kon niet worden ingediend.",
    "Leave request":
      "Verlofaanvraag",
    "Leave type":
      "Soort verlof",
    "End date":
      "Einddatum",
    "Working days requested:":
      "Aangevraagde werkdagen:",
    "(excludes Fri/Sat weekends)":
      "(exclusief weekend vr/za)",
    "Reason (optional)":
      "Reden (optioneel)",
    "Family holiday, medical, etc.":
      "Familievakantie, medisch, enz.",
    "Submit request":
      "Aanvraag indienen",
    "Search by name…":
      "Zoeken op naam…",
    "Dates":
      "Data",
    "Approver":
      "Goedkeurder",
    "Actions":
      "Acties",
    "Edit {name}’s leave request":
      "Verlofaanvraag van {name} bewerken",
    "No leave requests match your filters":
      "Geen verlofaanvragen voldoen aan je filters",
    "Showing {shown} of {total} requests":
      "{shown} van {total} aanvragen weergegeven",
    "Failed to save leave request.":
      "Verlofaanvraag opslaan mislukt.",
    "Annual":
      "Jaarlijks",
    "Sick":
      "Ziekte",
    "Maternity":
      "Zwangerschap",
    "Paternity":
      "Vaderschap",
    "Team Chat":
      "Teamchat",
    "Channels, project rooms, and direct messages for the studio.":
      "Kanalen, projectruimtes en directe berichten voor het bureau.",
    "{count} online":
      "{count} online",
    "{count} unread":
      "{count} ongelezen",
    "Search channels…":
      "Kanalen zoeken…",
    "Channels":
      "Kanalen",
    "No channels match.":
      "Geen kanalen gevonden.",
    "Direct Messages":
      "Directe berichten",
    "No direct messages.":
      "Geen directe berichten.",
    "Unknown":
      "Onbekend",
    "you":
      "jij",
    "No messages yet":
      "Nog geen berichten",
    "Be the first to say something.":
      "Zeg als eerste iets.",
    "Message {name}…":
      "Bericht aan {name}…",
    "Message #{name}…":
      "Bericht in #{name}…",
    "Enter to send · Shift+Enter for a new line · messages are local until the database is connected":
      "Enter om te versturen · Shift+Enter voor een nieuwe regel · berichten blijven lokaal tot de database is gekoppeld",
    "Today":
      "Vandaag",
    "Yesterday":
      "Gisteren",
    "Now":
      "Nu",
    "A live feed of what’s happening across the practice.":
      "Een live overzicht van wat er binnen het bureau gebeurt.",
    "No activity yet":
      "Nog geen activiteit",
    "Actions across proposals, clients, projects and meetings will appear here.":
      "Acties op offertes, klanten, projecten en vergaderingen verschijnen hier.",
    "created":
      "creëerde",
    "updated":
      "wijzigde",
    "changed their own password":
      "wijzigde het eigen wachtwoord",
    "set the password for":
      "stelde het wachtwoord in voor",
    "client":
      "klant",
    "leave request":
      "verlofaanvraag",
    "meeting":
      "vergadering",
    "order":
      "opdracht",
    "project":
      "project",
    "proposal":
      "offerte",
    "team member":
      "teamlid",
    "user":
      "gebruiker",
    "reports received":
      "meldingen ontvangen",
    "not yet resolved":
      "nog niet opgelost",
    "Bugs":
      "Bugs",
    "something broken":
      "er is iets kapot",
    "Wishes":
      "Wensen",
    "ideas & requests":
      "ideeën en verzoeken",
    "Search reports…":
      "Meldingen zoeken…",
    "No reports here yet":
      "Nog geen meldingen",
    "Beta testers can send Bug/Wish feedback from the “Feedback” button in any screen.":
      "Beta-testers kunnen bugs en wensen melden via de knop “Feedback” op elk scherm.",
    "Anonymous":
      "Anoniem",
    "Screenshot":
      "Schermafbeelding",
    "Close":
      "Sluiten",
    "Report screenshot":
      "Schermafbeelding van de melding",
    "Beta feedback":
      "Beta-feedback",
    "Report a bug or share a wish":
      "Meld een bug of deel een wens",
    "Thanks — it’s on its way!":
      "Bedankt — het is onderweg!",
    "Your wish was sent to the team.":
      "Je wens is naar het team gestuurd.",
    "Your bug report was sent to the team.":
      "Je bugmelding is naar het team gestuurd.",
    "Send another":
      "Nog een versturen",
    "Bug":
      "Bug",
    "Something’s broken":
      "Er is iets kapot",
    "Wish":
      "Wens",
    "An idea or request":
      "Een idee of verzoek",
    "Summary":
      "Samenvatting",
    "I wish I could…":
      "Ik zou graag…",
    "What went wrong?":
      "Wat ging er mis?",
    "Describe the idea and why it would help…":
      "Beschrijf het idee en waarom het zou helpen…",
    "Steps to reproduce, what you expected, what happened…":
      "Stappen om het te reproduceren, wat je verwachtte, wat er gebeurde…",
    "Captured screenshot":
      "Gemaakte schermafbeelding",
    "Capture screenshot":
      "Schermafbeelding maken",
    "Your browser will ask which screen or window to share.":
      "Je browser vraagt welk scherm of venster je wilt delen.",
    "Sending as {name}":
      "Verzenden als {name}",
    "Sending anonymously":
      "Anoniem verzenden",
    "Screen capture isn't supported in this browser.":
      "Schermopname wordt in deze browser niet ondersteund.",
    "Couldn't read the screen.":
      "Het scherm kon niet worden gelezen.",
    "That screen is too detailed to attach — try a smaller window.":
      "Dat scherm is te gedetailleerd om bij te voegen — probeer een kleiner venster.",
    "Couldn't capture the screen. You can still send the report without it.":
      "Het scherm kon niet worden vastgelegd. Je kunt de melding nog steeds zonder versturen.",
    "Add a short summary so we know what this is.":
      "Voeg een korte samenvatting toe zodat we weten waar het over gaat.",
    "Tell us a little more in the description.":
      "Vertel ons wat meer in de beschrijving.",
    "A short summary is required.":
      "Een korte samenvatting is verplicht.",
    "Please describe the bug or wish.":
      "Beschrijf de bug of wens.",
    "Pick whether this is a bug or a wish.":
      "Kies of dit een bug of een wens is.",
    "Screenshot is too large to send. Try removing it and submitting the text.":
      "De schermafbeelding is te groot om te versturen. Verwijder hem en verstuur alleen de tekst.",
    "Failed to send your report.":
      "Je melding versturen mislukt.",
    "Failed to update status.":
      "Status bijwerken mislukt.",
    "Planned":
      "Gepland",
    "Data Export":
      "Gegevensexport",
    "Download any dataset as a CSV — current values straight from the database, ready for Excel, accounting, or reporting. Most also offer a printable A4 directory (Save as PDF).":
      "Download elke dataset als CSV — actuele waarden rechtstreeks uit de database, klaar voor Excel, boekhouding of rapportage. De meeste bieden ook een afdrukbaar A4-overzicht (Opslaan als PDF).",
    "Practice Overview (PDF)":
      "Bureauoverzicht (PDF)",
    "Client directory with contacts, type, pipeline & lifetime value.":
      "Klantenoverzicht met contactpersonen, type, pijplijn en totale waarde.",
    "Project register with status, priority, manager and progress.":
      "Projectregister met status, prioriteit, manager en voortgang.",
    "Fee proposals with client, status, revision and total fee.":
      "Offertes met klant, status, revisie en totaal honorarium.",
    "Confirmed engagements with client, service type and fee.":
      "Bevestigde opdrachten met klant, soort dienst en honorarium.",
    "Studio directory with role, department and contact details.":
      "Bureauoverzicht met rol, afdeling en contactgegevens.",
    "Leave requests with type, status, dates and day counts.":
      "Verlofaanvragen met soort, status, data en aantal dagen.",
    "{count} rows":
      "{count} rijen",
    "Download CSV":
      "CSV downloaden",
    "Import Clients":
      "Klanten importeren",
    "Bulk-add clients from a CSV (e.g. exported from a spreadsheet or another system). Each row becomes a client record in the database.":
      "Voeg klanten in bulk toe vanuit een CSV (bijv. geëxporteerd uit een spreadsheet of ander systeem). Elke rij wordt een klantrecord in de database.",
    "required.":
      "verplicht.",
    "optional.":
      "optioneel.",
    "Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (defaults to Private).":
      "Developer / Government / Hospitality / Healthcare / Commercial / Residential / Private (standaard Private).",
    "Active / Inactive / Prospect (defaults to Active).":
      "Active / Inactive / Prospect (standaard Active).",
    "separated by":
      "gescheiden door",
    "Tip: the column headers from {source} are compatible, so you can export, edit, and re-import.":
      "Tip: de kolomkoppen uit {source} zijn compatibel, dus je kunt exporteren, bewerken en opnieuw importeren.",
    "Choose CSV file":
      "CSV-bestand kiezen",
    "A header row with a “name” column is required.":
      "Een kopregel met een kolom “name” is verplicht.",
    "Preview — first {shown} of {total} rows":
      "Voorbeeld — eerste {shown} van {total} rijen",
    "Importing…":
      "Importeren…",
    "Import 1 client":
      "1 klant importeren",
    "Import {count} clients":
      "{count} klanten importeren",
    "Imported {created} of {total} clients.":
      "{created} van {total} klanten geïmporteerd.",
    "View clients":
      "Klanten bekijken",
    "1 row skipped:":
      "1 rij overgeslagen:",
    "{count} rows skipped:":
      "{count} rijen overgeslagen:",
    "Row {row} ({name}): {error}":
      "Rij {row} ({name}): {error}",
    "…and {count} more":
      "…en nog {count}",
    "Import another file":
      "Nog een bestand importeren",
    "No data rows found in the file.":
      "Geen gegevensrijen gevonden in het bestand.",
    "The file needs a \"name\" column.":
      "Het bestand heeft een kolom \"name\" nodig.",
    "Could not parse the file as CSV.":
      "Het bestand kon niet als CSV worden gelezen.",
    "Missing required column: name":
      "Verplichte kolom ontbreekt: name",
    "Create failed":
      "Aanmaken mislukt",
    "Forms":
      "Formulieren",
    "Standard site & administration form templates — RFIs, instructions, inspections, variations. Preview any form.":
      "Standaard formuliersjablonen voor bouwplaats en administratie — RFI's, instructies, inspecties, wijzigingen. Bekijk elk formulier.",
    "New form":
      "Nieuw formulier",
    "Fields":
      "Velden",
    "{count} templates":
      "{count} sjablonen",
    "Search forms…":
      "Formulieren zoeken…",
    "Code":
      "Code",
    "Form":
      "Formulier",
    "No forms match your search.":
      "Geen formulieren gevonden.",
    "Site Administration":
      "Bouwplaatsadministratie",
    "Quality":
      "Kwaliteit",
    "Safety":
      "Veiligheid",
    "Select…":
      "Selecteren…",
    "Add a new {thing}":
      "{thing} toevoegen",
    "record":
      "record",
    "{field} is required.":
      "{field} is verplicht.",
    "Nothing on file yet":
      "Nog niets vastgelegd",
    "Construction Estimates & Construction Timeframe":
      "Bouwbegrotingen en bouwtijdplanning",
    "Read-only overview. Estimates and Schedule open in their own systems — the numbers here come straight from those systems, unchanged.":
      "Alleen-lezen overzicht. Begrotingen en Planning openen in hun eigen systemen — de cijfers hier komen daar ongewijzigd vandaan.",
    "Current estimate":
      "Huidige begroting",
    "Current total":
      "Huidig totaal",
    "Direct cost":
      "Directe kosten",
    "Cost per m²":
      "Kosten per m²",
    "Last modified":
      "Laatst gewijzigd",
    "Version lock":
      "Versievergrendeling",
    "Locked":
      "Vergrendeld",
    "Unlocked":
      "Ontgrendeld",
    "Open Estimates":
      "Begrotingen openen",
    "Active programme":
      "Actieve planning",
    "Overall progress":
      "Totale voortgang",
    "Planned start":
      "Geplande start",
    "Planned finish":
      "Gepland einde",
    "Forecast finish":
      "Verwacht einde",
    "Schedule variance":
      "Planningsafwijking",
    "Critical activities":
      "Kritieke activiteiten",
    "Open Schedule":
      "Planning openen",
    "No schedule for this project yet.":
      "Nog geen planning voor dit project.",
    "No schedule yet.":
      "Nog geen planning.",
    "Generate from Estimates or Schedule (source data unchanged)":
      "Genereren vanuit Begrotingen of Planning (brongegevens blijven ongewijzigd)",
    "Generate Estimate document":
      "Begrotingsdocument genereren",
    "Generate Schedule document":
      "Planningsdocument genereren",
    "View generated documents":
      "Gegenereerde documenten bekijken",
    "Existing estimate PDF":
      "Bestaande begrotings-PDF",
    "Existing programme PDF":
      "Bestaande plannings-PDF",
    "On track":
      "Op schema",
    "Watch":
      "Opletten",
    "At risk":
      "Risico",
    "No activities":
      "Geen activiteiten",
    "draft · issued · partial":
      "concept · uitgegeven · gedeeltelijk",
    "Material selection":
      "Materiaalkeuze",
    "proposed · submitted":
      "voorgesteld · ingediend",
    "Design register":
      "Ontwerpregister",
    "By discipline":
      "Per discipline",
    "This module exposes existing AEC-flow systems — no data is duplicated. Use the sidebar or the shortcuts below.":
      "Deze module toont bestaande AEC-flow-systemen — er worden geen gegevens gedupliceerd. Gebruik de zijbalk of de snelkoppelingen hieronder.",
    "Coming soon":
      "Binnenkort",
    "Pipeline Value by Status":
      "Pijplijnwaarde per status",
    "Proposal fee value ({currency})":
      "Honorariumwaarde offertes ({currency})",
    "value":
      "waarde",
    "Projects by Status":
      "Projecten per status",
    "Active portfolio breakdown":
      "Verdeling actieve portefeuille",
    "Projects by Discipline":
      "Projecten per discipline",
    "Discipline coverage across the portfolio":
      "Disciplinedekking over de portefeuille",
    "Proposal Value by Month":
      "Offertewaarde per maand",
    "When proposals were raised ({currency})":
      "Wanneer offertes zijn opgesteld ({currency})",
    "{rate}% win rate":
      "{rate}% winratio",
    "{count} at risk":
      "{count} met risico",
    "Portfolio Value":
      "Portefeuillewaarde",
    "active contract value":
      "waarde lopende contracten",
    "Search":
      "Zoeken",
    "1 result for":
      "1 resultaat voor",
    "{count} results for":
      "{count} resultaten voor",
    "Search across clients, projects, proposals, orders, and team.":
      "Zoek in klanten, projecten, offertes, opdrachten en team.",
    "Type a query in the search bar above to begin.":
      "Typ een zoekopdracht in de zoekbalk hierboven om te beginnen.",
    "No matches":
      "Geen resultaten",
    "Nothing found for “{query}”. Try another term.":
      "Niets gevonden voor “{query}”. Probeer een andere term.",
    "Kanban Board":
      "Kanban-bord",
    "Delete card":
      "Kaart verwijderen",
    "Add a card…":
      "Kaart toevoegen…",
    "Add card":
      "Kaart toevoegen",
    "Drag cards between columns. Saved in this browser.":
      "Sleep kaarten tussen kolommen. Opgeslagen in deze browser.",
    "Punch Clock":
      "Prikklok",
    "Clock out":
      "Uitklokken",
    "Clock in":
      "Inklokken",
    "Current session":
      "Huidige sessie",
    "Today total":
      "Totaal vandaag",
    "Today’s sessions":
      "Sessies van vandaag",
    "World Clocks":
      "Wereldklokken",
    "Add city":
      "Stad toevoegen",
    "Add a city to start.":
      "Voeg een stad toe om te beginnen.",
  },
};
