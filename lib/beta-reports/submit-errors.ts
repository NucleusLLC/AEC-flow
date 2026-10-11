/**
 * What a tester is told when a Bug/Wish report cannot be sent. Pure: shared by
 * the server action and the widget, no Prisma, no React.
 *
 * A failed submit used to hand the caught error's own text to the panel, so a
 * database or driver failure would have been shown to the tester word for
 * word. Only sentences written for a person may reach the screen; everything
 * else becomes one of the two below and the detail goes to the server log.
 */

/** The server was reached and could not store the report. */
export const SUBMIT_FAILED_MESSAGE =
  "We couldn't save your report. Please try again in a moment.";

/** The request itself failed: offline, a timeout, or a page older than the running app. */
export const SUBMIT_UNREACHABLE_MESSAGE =
  "We couldn't reach AEC-flow to send your report. Check your connection, or reload the page, and try again.";

/** The panel itself broke while it was on screen. */
export const PANEL_CRASHED_MESSAGE =
  "The feedback panel hit a problem. Your report may already have been sent, so reload the page before sending it again.";

/**
 * The sentence to show for a failed submit. `ActorError` (lib/server/actor.ts)
 * is the one error whose message is written for the person reading it: "You
 * must be signed in.", "Your account is not active." Matched by name so this
 * module stays free of the server imports that class lives beside.
 */
export function submitFailureMessage(error: unknown): string {
  if (error instanceof Error && error.name === "ActorError" && error.message.trim()) {
    return error.message;
  }
  return SUBMIT_FAILED_MESSAGE;
}
