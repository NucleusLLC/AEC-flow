/**
 * The Bug/Wish panel must survive a browser page translator.
 *
 * Production, 11 Oct 2026: a tester using Edge's translation pressed Send and
 * the whole app turned into "Something went wrong" (`Failed to execute
 * 'insertBefore' on 'Node'`), twice, although both reports were saved. The
 * translator had swapped the button's "Send" text node for a <font> element;
 * React then tried to insert the spinner before the text node it remembered.
 *
 * What makes markup safe is structural, so it can be checked without a browser:
 * no element may hold a text node NEXT TO other children. Text that is the only
 * child of its element can be replaced by a translator without React ever
 * needing that node as an insertion point.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BetaReportSendButton } from "./send-button";

type Node = { tag: string; text: boolean; elements: number };

/** Elements whose children mix a text node with at least one element. */
function mixedContent(html: string): string[] {
  const stack: Node[] = [{ tag: "#root", text: false, elements: 0 }];
  const bad: string[] = [];
  const token = /<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)((?:"[^"]*"|[^>"])*?)(\/?)>|([^<]+)/g;
  for (const m of html.matchAll(token)) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      const closed = stack.pop()!;
      if (closed.text && closed.elements > 0) bad.push(closed.tag);
    } else if (m[2]) {
      top.elements += 1;
      if (!m[4]) stack.push({ tag: m[2], text: false, elements: 0 });
    } else if (m[5].trim()) {
      top.text = true;
    }
  }
  return bad;
}

const render = (sending: boolean) =>
  renderToStaticMarkup(
    createElement(BetaReportSendButton, {
      sending,
      onClick: () => {},
      label: "Send",
      sendingLabel: "Sending…",
    }),
  );

describe("mixedContent (the checker itself)", () => {
  it("flags text beside an element and accepts text alone in its element", () => {
    expect(mixedContent("<button><svg></svg>Send</button>")).toEqual(["button"]);
    expect(mixedContent("<button><svg><path d=\"M1 1\"/></svg><span>Send</span></button>")).toEqual([]);
  });
});

describe("Bug/Wish Send button", () => {
  it("never leaves its label next to the icon that is swapped while sending", () => {
    expect(mixedContent(render(false))).toEqual([]);
    expect(mixedContent(render(true))).toEqual([]);
  });

  it("shows the right label in each state and is disabled while sending", () => {
    expect(render(false)).toContain("<span>Send</span>");
    expect(render(false)).not.toContain('disabled=""');
    expect(render(true)).toContain("<span>Sending…</span>");
    expect(render(true)).toContain('disabled=""');
  });
});
