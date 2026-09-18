/**
 * Who the minutes go to, and what the message says.
 *
 * THE PROBLEM THIS SOLVES. A meeting's `participants` is a list of NAMES typed
 * into a form — "Greg Lacle (ZenArch)", "Gwendoline Rojer" — and a name is not an
 * address. So "email the recipients" needs the names turned into addresses from
 * what the company already knows: its own team members, and the client on the
 * meeting's project. Anyone the app cannot place is REPORTED, never silently
 * dropped: a participant quietly missing from the To line is the same failure as
 * a cc that never went out, and this module exists in a codebase that has been
 * burned by exactly that.
 *
 * It is pure, and separate from lib/data/meetings, because matching a typed name
 * to a person is a judgement with edge cases — a suffix in brackets, a middle
 * name, an address typed into the name field — and those are worth testing
 * without a database.
 */

/** Someone the company has an address for. */
export type Addressable = {
  name: string;
  email: string;
  /** Where the address came from, so the UI can say whose it is. */
  kind: "team" | "client";
};

export type ResolvedAttendee = {
  /** Exactly as recorded on the meeting. */
  participant: string;
  /** Null when nothing in the company matches — the honest answer, not a guess. */
  email: string | null;
  kind: "team" | "client" | "typed" | null;
};

/** At most this many addresses are prefilled — `MAX_TO` in lib/email/recipients. */
export const MAX_PREFILLED = 5;

/**
 * A name reduced to what two spellings of the same person have in common:
 * case, accents, punctuation and a trailing "(HTESS)" are all noise.
 *
 * The bracketed suffix is the one that matters in practice — minutes name people
 * by their firm, and the team record does not.
 */
export function normaliseName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose enough for a name field, strict enough not to mail a typo. */
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The address a participant entry carries in itself, if any.
 *
 * Two forms, both of which people type into a name field: the bare address, and
 * `Name <address>`. Reading them is not a nicety — it is the only way a
 * participant who is neither staff nor the client can be reached at all.
 */
export function addressInText(raw: string): string | null {
  const angled = raw.match(/<([^<>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim();
  return ADDRESS.test(candidate) ? candidate : null;
}

/**
 * Each participant, with the address the company holds for them.
 *
 * Matching is by normalised full name and nothing looser. A first-name or
 * substring match would be worse than no match: it would address the minutes of
 * a client meeting to whichever "Mike" the app found first, and the sender would
 * have no way to tell from the To line.
 */
export function resolveAttendees(
  participants: readonly string[],
  people: readonly Addressable[],
): ResolvedAttendee[] {
  const byName = new Map<string, Addressable>();
  for (const person of people) {
    const key = normaliseName(person.name);
    // First wins, and team is passed before client by the caller: a person who is
    // both a colleague and a client contact is reached at their work address.
    if (key && !byName.has(key)) byName.set(key, person);
  }

  return participants
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((participant) => {
      const typed = addressInText(participant);
      if (typed) return { participant, email: typed, kind: "typed" as const };
      const match = byName.get(normaliseName(participant));
      return match
        ? { participant, email: match.email, kind: match.kind }
        : { participant, email: null, kind: null };
    });
}

/**
 * The To line: every address once, in the order the minutes list the people, up
 * to the cap the send path enforces anyway.
 *
 * Capped here as well as there so the dialog opens with a list that can actually
 * be sent, rather than one the server refuses the moment Send is pressed.
 */
export function prefilledAddresses(
  resolved: readonly ResolvedAttendee[],
  extra: readonly string[] = [],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const address of [...resolved.map((r) => r.email), ...extra]) {
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
    if (out.length >= MAX_PREFILLED) break;
  }
  return out;
}

/** The participants with no address, so the sender is told who is missing. */
export function unreachable(resolved: readonly ResolvedAttendee[]): string[] {
  return resolved.filter((r) => r.email === null).map((r) => r.participant);
}

/**
 * The sentence the compose dialog shows about who could not be reached.
 *
 * Null when everyone was placed — a notice that says "all fine" trains people to
 * stop reading notices.
 */
export function unreachableNotice(resolved: readonly ResolvedAttendee[]): string | null {
  const missing = unreachable(resolved);
  if (missing.length === 0) return null;
  const names = missing.join(", ");
  return missing.length === 1
    ? `${names} has no email address on file, so they are not in the To line. Add it to their team or client record, or type it above.`
    : `These participants have no email address on file, so they are not in the To line: ${names}. Add the addresses to their team or client records, or type them above.`;
}

/* ───────────────────────────────────────────────────────────────────────────
 * The message
 * ────────────────────────────────────────────────────────────────────────── */

export type MinutesEmailInput = {
  title: string;
  projectName: string;
  typeLabel: string;
  /** Already formatted for reading — this module does no date formatting. */
  meetingDate: string;
  location: string | null;
  author: string;
  followUpDate: string | null;
  participants: readonly string[];
  summary: string | null;
  discussion: string | null;
  decisions: string | null;
  actionItems: readonly {
    description: string;
    assignee: string;
    /** Formatted, or null. */
    dueDate: string | null;
    statusLabel: string;
  }[];
  senderName: string;
};

export function minutesSubject(input: Pick<MinutesEmailInput, "title" | "meetingDate">): string {
  return `Minutes — ${input.title} (${input.meetingDate})`;
}

/**
 * The minutes, as the body of the email.
 *
 * WHY THE WHOLE THING AND NOT A COVERING NOTE. This app has no attachments: its
 * documents are produced by the browser's print dialog, so there is no file on
 * the server to enclose (see `NOT_ATTACHED`). A covering note saying "please find
 * the minutes attached" would therefore be a lie, and one saying "the minutes are
 * in AEC-flow" is useless to the client and the contractor, who cannot sign in.
 * So the message carries the minutes themselves, and the link is an extra for
 * whoever can use it.
 *
 * Plain text, deliberately: `renderDocumentEmail` wraps the body and preserves
 * its line breaks, and a reader forwarding this into a reply thread gets
 * something that survives.
 */
export function minutesEmailBody(input: MinutesEmailInput): string {
  const lines: string[] = [];
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label.padEnd(11)}${value}`);
  };

  lines.push(`MEETING MINUTES — ${input.title}`, "");
  field("Project:", input.projectName);
  field("Type:", `${input.typeLabel} meeting`);
  field("Date:", input.meetingDate);
  field("Location:", input.location);
  field("Author:", input.author);
  field("Follow-up:", input.followUpDate);

  if (input.participants.length) {
    lines.push("", "PARTICIPANTS");
    for (const p of input.participants) lines.push(`  · ${p}`);
  }

  for (const [heading, text] of [
    ["SUMMARY", input.summary],
    ["DISCUSSION", input.discussion],
    ["DECISIONS", input.decisions],
  ] as const) {
    if (text && text.trim()) lines.push("", heading, text.trim());
  }

  if (input.actionItems.length) {
    lines.push("", "ACTION ITEMS");
    input.actionItems.forEach((item, i) => {
      lines.push(`  ${i + 1}. ${item.description}`);
      const meta = [item.assignee, item.dueDate ? `due ${item.dueDate}` : null, item.statusLabel]
        .filter(Boolean)
        .join(" · ");
      lines.push(`     ${meta}`);
    });
  }

  // Asking for corrections is not politeness: minutes are a record, and the
  // moment to dispute one is on receipt, not at the next meeting.
  lines.push(
    "",
    "Please let me know of any correction or omission; otherwise these minutes stand as the record of the meeting.",
    "",
    "Kind regards,",
    input.senderName,
  );

  return lines.join("\n");
}
