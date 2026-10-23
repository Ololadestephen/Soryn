import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoomLobby } from "../../src/components/pvp/RoomLobby";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import type { PvpView } from "../../src/domain/pvp/view";

const actor = "11111111-1111-4111-8111-111111111111";
const opponent = "22222222-2222-4222-8222-222222222222";
function withRoom(publicMatch: boolean, check: (view: PvpView) => void) {
  const store = new Store(":memory:");
  try {
    const service = new PvpService(new PvpStore(store), PVP_TIMERS);
    const now = 1700000000000;
    const room = publicMatch
      ? service.openMatched(
          { actor, mode: "guest" },
          { actor: opponent, mode: "guest" },
          now,
        )
      : service.create({ actor, mode: "guest" }, now);
    const view = service.pollRoom(actor, room.invite, now);
    if (!view.seated) throw new Error("Fixture did not take a seat");
    check(view);
  } finally {
    store.close();
  }
}
function render(room: PvpView, error = "") {
  // Static markup only consumes state; interactive behavior is browser-tested.
  const game = { room, error, busy: false } as ComponentProps<
    typeof RoomLobby
  >["game"];
  return renderToStaticMarkup(
    createElement(RoomLobby, { game, leave: () => {} }),
  );
}
function findDisclosureBySummary(html: string, summaryText: string) {
  for (const [, attrs, body] of html.matchAll(
    /<details\b([^>]*)>([\s\S]*?)<\/details>/g,
  )) {
    const summary = /<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(body);
    if (summary?.[1]?.trim() === summaryText) {
      return { open: /\bopen(?:="")?/.test(attrs), body };
    }
  }
  return null;
}
it("public room markup never exposes private invitation controls or wording", () => {
  withRoom(true, (room) => {
    const html = render(room);
    expect(html).toContain("Public match");
    expect(findDisclosureBySummary(html, "Invite a friend")).toBeNull();
    for (const text of [
      "Invitation link",
      "Copy invitation",
      "Invite a friend",
      "/challenge/",
      "Private battle",
      "Close invitation",
    ])
      expect(html).not.toContain(text);
    expect(html).toContain("Ready up");
    expect(html).toContain('aria-label="Fighter selection and options"');
  });
});
it("private sharing is prominent before joining and secondary once occupied", () => {
  withRoom(false, (room) => {
    expect(findDisclosureBySummary(render(room), "Invite a friend")?.open).toBe(
      true,
    );
    room.opponent = {
      name: "Friend",
      characterId: null,
      ready: false,
      connected: true,
      locked: false,
      joined: true,
    };
    const html = render(room);
    const sharing = findDisclosureBySummary(html, "Invite a friend");
    expect(sharing?.open).toBe(false);
    expect(sharing?.body).toContain("Copy invitation");
    expect(html).toContain("Opponent is choosing");
  });
});
it("visible failures and archived results retain useful actions without reopening setup", () => {
  withRoom(true, (room) => {
    expect(render(room, "Ownership verification unavailable")).toMatch(
      /<[^>]*\brole="alert"[^>]*>Ownership verification unavailable<\//,
    );
    room.phase = "closed";
    const html = render(room);
    expect(html).toContain("Find another match");
    expect(html).toContain("Back to modes");
    expect(html).not.toContain("Ready up");
  });
});
