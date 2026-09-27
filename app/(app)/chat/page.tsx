import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ChatView } from "@/components/chat/chat-view";
import { getChatData, summarizeChat } from "@/lib/data/chat";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Team Chat · AEC-flow" };

export default async function ChatPage() {
  const data = await getChatData();
  const summary = summarizeChat(data);
  const t = await getServerT();

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Team Chat")}</h2>
          <p className="text-sm text-muted">
            {t("Channels, project rooms, and direct messages for the studio.")}
          </p>
        </div>
        <div className="hidden items-center gap-4 text-sm sm:flex">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {fmt(t("{count} online"), { count: summary.online })}
          </span>
          {summary.unread > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <MessageSquare className="h-4 w-4 text-faint" />
              {fmt(t("{count} unread"), { count: summary.unread })}
            </span>
          ) : null}
        </div>
      </div>

      <ChatView data={data} />
    </div>
  );
}
