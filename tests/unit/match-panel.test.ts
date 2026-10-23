import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchPanel } from "../../src/components/match/MatchPanel";
import type { QueueView } from "../../src/domain/pvp/queue";
const initial: QueueView = {
  status: "idle",
  othersWaiting: 0,
  accepted: false,
  deadlineAt: null,
  serverNow: 10000,
  invite: null,
  lockedUntil: null,
  message: "Fixture queue message",
};
function render(queue: QueueView | null, busy = false) {
  return renderToStaticMarkup(
    createElement(MatchPanel, {
      queue,
      busy,
      error: "",
      onAction: async () => {},
    }),
  );
}
function findButton(html: string, label: string) {
  for (const [, attrs, text] of html.matchAll(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/g,
  )) {
    if (text.trim() === label) {
      return { disabled: /\bdisabled(?:="")?/.test(attrs) };
    }
  }
  return null;
}
function listItemsByAriaLabel(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<ul\\b[^>]*aria-label="${escaped}"[^>]*>([\\s\\S]*?)<\\/ul>`,
  ).exec(html);
  if (!match) return [];
  return [...match[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(
    ([, item]) => item,
  );
}
describe("queue presentation preserves authoritative available actions", () => {
  it("presents one six-fighter roster and loading without inviting premature submission", () => {
    const html = render(null);
    expect(html).toContain("Opening matchmaking");
    expect(findButton(html, "Find a match")).toEqual({ disabled: true });
    expect(listItemsByAriaLabel(html, "Eligible fighters")).toHaveLength(6);
  });
  it("waiting keeps joining disabled and exposes cancellation", () => {
    const html = render({ ...initial, status: "waiting" });
    expect(html).toContain("Finding your opponent");
    expect(findButton(html, "Still looking")).toEqual({ disabled: true });
    expect(findButton(html, "Leave queue")).toEqual({ disabled: false });
  });
  it("offered seats expose accept and secondary decline with the server deadline", () => {
    const html = render({ ...initial, status: "offered", deadlineAt: 24000 });
    expect(html).toContain("Opponent found");
    expect(findButton(html, "Accept opponent")).toEqual({ disabled: false });
    expect(findButton(html, "Decline")).toEqual({ disabled: false });
    expect(html).toContain("<strong>14s</strong>");
  });
  it("an accepted offer cannot be accepted again and reports remaining offer time", () => {
    const html = render({
      ...initial,
      status: "offered",
      accepted: true,
      deadlineAt: 24000,
    });
    expect(html).toContain("Offer accepted");
    expect(html).toContain("Offer expires in");
    expect(findButton(html, "Accept opponent")).toBeNull();
    expect(findButton(html, "Decline")).toBeNull();
  });
  it("blocked state keeps entry disabled and retains server message", () => {
    const html = render({
      ...initial,
      status: "blocked",
      message: "Fixture temporary block",
    });
    expect(html).toContain("Queue unavailable");
    expect(html).toContain("Fixture temporary block");
    expect(findButton(html, "Find a match")).toEqual({ disabled: true });
  });
  it("pending submission disables both offered actions", () => {
    const html = render({ ...initial, status: "offered" }, true);
    expect(findButton(html, "Accept opponent")).toEqual({ disabled: true });
    expect(findButton(html, "Decline")).toEqual({ disabled: true });
  });
});
