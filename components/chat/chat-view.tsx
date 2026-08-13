"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Hash, Search, Send, Users, FolderKanban } from "lucide-react";
import {
  type ChatData,
  type ChatMessage,
  type Channel,
} from "@/lib/data/chat";
import { cn, initials } from "@/lib/utils";

export function ChatView({ data }: { data: ChatData }) {
  const usersById = useMemo(
    () => Object.fromEntries(data.users.map((u) => [u.id, u])),
    [data.users],
  );
  const [channels, setChannels] = useState(data.channels);
  const [channelId, setChannelId] = useState(data.channels[0]?.id ?? "");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(data.messages);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const thread = messages[channelId] ?? [];

  // Opening a channel marks it read (local until the DB is connected).
  function openChannel(id: string) {
    setChannelId(id);
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [channelId, thread.length]);

  const q = query.trim().toLowerCase();
  const filtered = channels.filter((c) =>
    !q ? true : (c.name + " " + (c.topic ?? "")).toLowerCase().includes(q),
  );
  const channelsGroup = filtered.filter((c) => c.kind !== "dm");
  const dmGroup = filtered.filter((c) => c.kind === "dm");

  function dmPartner(c: Channel) {
    const otherId = c.memberIds.find((id) => id !== data.currentUserId);
    return otherId ? usersById[otherId] : undefined;
  }

  function send() {
    const body = draft.trim();
    if (!body || !channel) return;
    const next: ChatMessage = {
      id: `local-${channel.id}-${thread.length + 1}`,
      channelId: channel.id,
      authorId: data.currentUserId,
      body,
      at: "Now",
      day: "Today",
    };
    setMessages((prev) => ({ ...prev, [channel.id]: [...(prev[channel.id] ?? []), next] }));
    setDraft("");
  }

  function ChannelButton({ c }: { c: Channel }) {
    const active = c.id === channelId;
    const partner = c.kind === "dm" ? dmPartner(c) : undefined;
    return (
      <button
        type="button"
        onClick={() => openChannel(c.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
          active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        {c.kind === "dm" ? (
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted">
            {partner ? initials(partner.name) : "?"}
            {partner?.online ? (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface bg-emerald-500" />
            ) : null}
          </span>
        ) : c.kind === "project" ? (
          <FolderKanban className="h-4 w-4 shrink-0 text-faint" />
        ) : (
          <Hash className="h-4 w-4 shrink-0 text-faint" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", c.unread > 0 && !active && "font-semibold text-fg")}>
          {c.kind === "dm" ? c.name : c.name}
        </span>
        {c.unread > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-fg">
            {c.unread}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="card-surface flex h-[calc(100vh-11rem)] min-h-[440px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      {/* Sidebar: channels */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search channels…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-2">
          <div>
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              Channels
            </div>
            <div className="space-y-0.5">
              {channelsGroup.map((c) => (
                <ChannelButton key={c.id} c={c} />
              ))}
              {channelsGroup.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-faint">No channels match.</p>
              ) : null}
            </div>
          </div>
          <div>
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              Direct Messages
            </div>
            <div className="space-y-0.5">
              {dmGroup.map((c) => (
                <ChannelButton key={c.id} c={c} />
              ))}
              {dmGroup.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-faint">No direct messages.</p>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      {/* Main: thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Thread header */}
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {channel?.kind === "dm" ? null : channel?.kind === "project" ? (
                <FolderKanban className="h-4 w-4 text-faint" />
              ) : (
                <Hash className="h-4 w-4 text-faint" />
              )}
              <h2 className="truncate text-sm font-semibold text-fg">
                {channel?.kind === "dm" ? channel.name : channel?.name}
              </h2>
            </div>
            {channel?.topic ? (
              <p className="mt-0.5 truncate text-xs text-muted">{channel.topic}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3.5 w-3.5 text-faint" />
            {channel?.memberIds.length ?? 0}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {thread.map((m, i) => {
            const prev = thread[i - 1];
            const showDay = !prev || prev.day !== m.day;
            const grouped = prev && prev.authorId === m.authorId && !showDay;
            const author = usersById[m.authorId];
            const isMe = m.authorId === data.currentUserId;
            return (
              <div key={m.id}>
                {showDay ? (
                  <div className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                      {m.day}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                <div className={cn("flex gap-3", grouped ? "mt-0.5" : "mt-2")}>
                  <div className="w-9 shrink-0">
                    {grouped ? null : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                        {author ? initials(author.name) : "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {grouped ? null : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-fg">
                          {author?.name ?? "Unknown"}
                          {isMe ? <span className="ml-1 text-[10px] font-normal text-faint">you</span> : null}
                        </span>
                        <span className="text-[11px] text-faint">{m.at}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm text-fg/90">{m.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {thread.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-fg">No messages yet</p>
              <p className="text-xs text-muted">Be the first to say something.</p>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={channel?.kind === "dm" ? `Message ${channel.name}…` : `Message #${channel?.name ?? ""}…`}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
          <p className="mt-1 px-1 text-[11px] text-faint">
            Enter to send · Shift+Enter for a new line · messages are local until the database is connected
          </p>
        </div>
      </section>
    </div>
  );
}
