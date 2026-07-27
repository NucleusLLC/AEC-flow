/**
 * Team Chat data-access layer (placeholder — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale). In-memory placeholder data; swap the
 * bodies for Prisma (Channel / ChatMessage / ChannelMember models) once Supabase
 * is live. Call sites stay unchanged. Sending a message is client-only for now
 * (optimistic local state) — no persistence until the DB is connected.
 */

export type ChannelKind = "channel" | "project" | "dm";

export type ChatUser = {
  id: string;
  name: string;
  role: string;
  online: boolean;
};

export type Channel = {
  id: string;
  /** Display name. Channels render with a leading "#", DMs use the person's name. */
  name: string;
  kind: ChannelKind;
  topic: string | null;
  memberIds: string[];
  /** Unread message count for the current user. */
  unread: number;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  /** Display time, e.g. "9:14 AM". */
  at: string;
  /** Day bucket for separators, e.g. "Today", "Yesterday", "Mon 16 Jun". */
  day: string;
};

export type ChatData = {
  users: ChatUser[];
  currentUserId: string;
  channels: Channel[];
  /** Messages keyed by channel id, in chronological order. */
  messages: Record<string, ChatMessage[]>;
};

export type ChatSummary = {
  channels: number;
  directMessages: number;
  unread: number;
  online: number;
};

const USERS: ChatUser[] = [
  { id: "u-omar", name: "Omar Farouk", role: "Project Director", online: true },
  { id: "u-layla", name: "Layla Hassan", role: "Senior Architect", online: true },
  { id: "u-sara", name: "Sara Khan", role: "Design Lead", online: true },
  { id: "u-ahmed", name: "Ahmed Nabil", role: "Structural Engineer", online: false },
  { id: "u-maya", name: "Maya Haddad", role: "Interior Designer", online: true },
  { id: "u-tariq", name: "Tariq Saleh", role: "MEP Engineer", online: false },
  { id: "u-nadia", name: "Nadia Rahman", role: "BIM Coordinator", online: true },
];

const CURRENT_USER_ID = "u-omar";
const everyone = USERS.map((u) => u.id);

const CHANNELS: Channel[] = [
  { id: "c-general", name: "general", kind: "channel", topic: "Company-wide announcements", memberIds: everyone, unread: 0 },
  { id: "c-design", name: "design-studio", kind: "channel", topic: "Design team coordination & reviews", memberIds: ["u-omar", "u-layla", "u-sara", "u-maya", "u-nadia"], unread: 2 },
  { id: "c-saadiyat", name: "saadiyat-pavilion", kind: "project", topic: "DCT Abu Dhabi — Saadiyat Cultural Pavilion", memberIds: ["u-omar", "u-layla", "u-ahmed", "u-tariq", "u-nadia"], unread: 5 },
  { id: "c-marina", name: "marina-heights", kind: "project", topic: "Emaar — Marina Heights Tower Phase 2", memberIds: ["u-omar", "u-layla", "u-ahmed", "u-nadia"], unread: 0 },
  { id: "c-yasbay", name: "yas-bay-offices", kind: "project", topic: "Aldar — Yas Bay Waterfront Offices", memberIds: ["u-omar", "u-sara", "u-ahmed", "u-tariq"], unread: 0 },
  { id: "dm-sara", name: "Sara Khan", kind: "dm", topic: null, memberIds: ["u-omar", "u-sara"], unread: 1 },
  { id: "dm-ahmed", name: "Ahmed Nabil", kind: "dm", topic: null, memberIds: ["u-omar", "u-ahmed"], unread: 0 },
];

const MESSAGES: Record<string, ChatMessage[]> = {
  "c-general": [
    { id: "m1", channelId: "c-general", authorId: "u-layla", body: "Morning all — reminder the office is closed Thursday for the public holiday. Plan deliverables around it.", at: "8:32 AM", day: "Today" },
    { id: "m2", channelId: "c-general", authorId: "u-nadia", body: "Revit central files have been upgraded to the 2026 template. Please sync before opening any model.", at: "8:48 AM", day: "Today" },
    { id: "m3", channelId: "c-general", authorId: "u-omar", body: "Great quarter everyone — we crossed AWG 11M in approved fees. Thanks for the push on Saadiyat and the villa.", at: "9:05 AM", day: "Today" },
  ],
  "c-design": [
    { id: "m1", channelId: "c-design", authorId: "u-sara", body: "Uploaded the revised façade study for Creek Harbour — feedback by EOD please.", at: "9:10 AM", day: "Today" },
    { id: "m2", channelId: "c-design", authorId: "u-maya", body: "The bronze mullion option reads much better against the podium. +1 from interiors.", at: "9:14 AM", day: "Today" },
    { id: "m3", channelId: "c-design", authorId: "u-layla", body: "Agreed. Let's carry the bronze through to the lobby. @Sara can you update the material board?", at: "9:21 AM", day: "Today" },
    { id: "m4", channelId: "c-design", authorId: "u-sara", body: "On it — will have it ready before the client review.", at: "9:23 AM", day: "Today" },
  ],
  "c-saadiyat": [
    { id: "m1", channelId: "c-saadiyat", authorId: "u-ahmed", body: "Structural model for the pavilion roof is ready for the authority submission set.", at: "Yesterday", day: "Yesterday" },
    { id: "m2", channelId: "c-saadiyat", authorId: "u-tariq", body: "MEP risers coordinated against the new core layout — no clashes in the latest Navisworks run.", at: "Yesterday", day: "Yesterday" },
    { id: "m3", channelId: "c-saadiyat", authorId: "u-omar", body: "Perfect. DCT review cycle starts Monday — let's lock the package by Sunday noon.", at: "8:40 AM", day: "Today" },
    { id: "m4", channelId: "c-saadiyat", authorId: "u-nadia", body: "Sheet index is at 142 sheets. I'll issue the transmittal once Ahmed signs off structural.", at: "8:52 AM", day: "Today" },
    { id: "m5", channelId: "c-saadiyat", authorId: "u-layla", body: "Heritage detailing on the screen wall is approved by the advisor. Uploading the marked-up set now.", at: "9:30 AM", day: "Today" },
  ],
  "c-marina": [
    { id: "m1", channelId: "c-marina", authorId: "u-layla", body: "Schematic design sign-off received from Emaar 🎉 Moving into detailed design.", at: "Mon 16 Jun", day: "Mon 16 Jun" },
    { id: "m2", channelId: "c-marina", authorId: "u-omar", body: "Nicely done team. I'll convert the approved proposal to an order and kick off the next milestone.", at: "Mon 16 Jun", day: "Mon 16 Jun" },
  ],
  "c-yasbay": [
    { id: "m1", channelId: "c-yasbay", authorId: "u-ahmed", body: "Aldar asked for a revision on the structural scope — I've drafted the revised grid for the office floors.", at: "Yesterday", day: "Yesterday" },
    { id: "m2", channelId: "c-yasbay", authorId: "u-sara", body: "Thanks. Once the fee revision is in, we'll reissue proposal R2.", at: "Yesterday", day: "Yesterday" },
  ],
  "dm-sara": [
    { id: "m1", channelId: "dm-sara", authorId: "u-sara", body: "Do you have five minutes to review the Palm Beach amenity deck concept before I send it?", at: "9:02 AM", day: "Today" },
    { id: "m2", channelId: "dm-sara", authorId: "u-omar", body: "Yes — ping me after the design stand-up and we'll go through it.", at: "9:06 AM", day: "Today" },
    { id: "m3", channelId: "dm-sara", authorId: "u-sara", body: "Perfect, thanks 🙏", at: "9:07 AM", day: "Today" },
  ],
  "dm-ahmed": [
    { id: "m1", channelId: "dm-ahmed", authorId: "u-omar", body: "Can you get me the structural fee delta for Yas Bay by tomorrow?", at: "Yesterday", day: "Yesterday" },
    { id: "m2", channelId: "dm-ahmed", authorId: "u-ahmed", body: "Will do — roughly +AWG 130k for the revised grid. I'll confirm the breakdown.", at: "Yesterday", day: "Yesterday" },
  ],
};

export async function getChatData(): Promise<ChatData> {
  return {
    users: USERS,
    currentUserId: CURRENT_USER_ID,
    channels: CHANNELS,
    messages: MESSAGES,
  };
}

export function summarizeChat(data: ChatData): ChatSummary {
  return {
    channels: data.channels.filter((c) => c.kind !== "dm").length,
    directMessages: data.channels.filter((c) => c.kind === "dm").length,
    unread: data.channels.reduce((n, c) => n + c.unread, 0),
    online: data.users.filter((u) => u.online && u.id !== data.currentUserId).length,
  };
}

export const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
  channel: "Channel",
  project: "Project channel",
  dm: "Direct message",
};
