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
      mode: "guest",
      walletPlay: true,
      onAction: async () => {},
    }),
  );
}
describe("queue presentation preserves authoritative available actions", () => {
  it("presents one six-fighter roster and loading without inviting premature submission", () => {
    const html = render(null);
    expect(html).toContain("Opening matchmaking");
    expect(html).toMatch(/<button disabled="">Find a match/);
    const roster = html.split('class="match-roster"')[1].split("</ul>")[0];
    expect(roster.match(/<li>/g)).toHaveLength(6);
  });
  it("waiting keeps joining disabled and exposes cancellation", () => {
    const html = render({ ...initial, status: "waiting" });
    expect(html).toContain("Finding your opponent");
    expect(html).toMatch(/<button disabled="">Still looking/);
    expect(html).toContain("Leave queue");
  });
  it("offered seats expose accept and secondary decline with the server deadline", () => {
    const html = render({ ...initial, status: "offered", deadlineAt: 24000 });
    expect(html).toContain("Opponent found");
    expect(html).toContain("Accept opponent");
    expect(html).toMatch(/class="secondary">Decline/);
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
    expect(html).not.toContain("Accept opponent");
    expect(html).not.toContain("Decline");
  });
  it("blocked state keeps entry disabled and retains server message", () => {
    const html = render({
      ...initial,
      status: "blocked",
      message: "Fixture temporary block",
    });
    expect(html).toContain("Queue unavailable");
    expect(html).toContain("Fixture temporary block");
    expect(html).toMatch(/<button disabled="">Find a match/);
  });
  it("pending submission disables both offered actions", () => {
    const html = render({ ...initial, status: "offered" }, true);
    expect(html).toMatch(/<button disabled="">Accept opponent/);
    expect(html).toMatch(/class="secondary" disabled="">Decline/);
  });
});
