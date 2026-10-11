import { Loader2, Send } from "lucide-react";

/**
 * The Send button of the Bug/Wish panel.
 *
 * Its label lives in a <span> of its own, and that is the whole point of this
 * file. A browser's page translator (Edge, Chrome) replaces the text nodes it
 * translates with <font> elements. React still holds the old text node, so the
 * moment "Send" becomes "Sending…" and the spinner has to go in front of the
 * label, React calls insertBefore() against a node that is no longer in the
 * page. That throws, and because this panel is mounted in the app layout the
 * whole app was replaced by "Something went wrong" — while the report itself
 * was saved. With the label in its own element the spinner is inserted before
 * the <span>, which a translator never removes.
 *
 * Rule for anything added here: never leave a piece of text next to an element
 * that appears, disappears or changes type. send-button.test.tsx holds it.
 */
export function BetaReportSendButton({
  sending,
  onClick,
  label,
  sendingLabel,
}: {
  sending: boolean;
  onClick: () => void;
  label: string;
  sendingLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
    >
      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      <span>{sending ? sendingLabel : label}</span>
    </button>
  );
}
