import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MyChogPanel } from "../../src/components/identity/MyChogPanel";
import { HolderPerks } from "../../src/components/site/HolderPerks";
import { HolderCosmeticToggle } from "../../src/components/auth/HolderCosmeticToggle";
import ExplorePage from "../../src/app/explore/page";
import {
  HOLDER_QUALIFICATION_MESSAGE,
  STARTERS,
  PUBLIC_FIGHTERS,
  type AccessView,
} from "../../src/domain/access/policy";
import type { WalletAdapter } from "../../src/components/auth/WalletAdapter";
const wallet: WalletAdapter = {
  ready: true,
  authenticated: true,
  address: `0x${"ab".repeat(20)}`,
  wallets: [],
  login() {
    throw Error("SSR must not connect a wallet");
  },
  logout: () => Promise.reject(Error("SSR must not sign out")),
  selectWallet() {
    throw Error("SSR must not select a wallet");
  },
  provider: () => Promise.reject(Error("SSR must not request a provider")),
  headers: () => Promise.reject(Error("SSR must not request proof")),
};
const action = () =>
  Promise.reject(Error("Rendering must not mutate a session"));
function profile(view: AccessView | null, authenticated = true) {
  return renderToStaticMarkup(
    createElement(
      MyChogPanel,
      {
        wallet: { ...wallet, authenticated },
        view,
        busy: false,
        cooldown: 0,
        phase: null,
        error: "",
        signIn: action,
        signOut: action,
        recheck: action,
        equip: action,
      },
      createElement("p", null, "Private fixture records"),
    ),
  );
}
it("keeps the compact entry private until the server session authenticates", () => {
  for (const [view, connected] of [
    [null, false],
    [null, true],
  ] as const) {
    const html = profile(view, connected);
    expect(html).not.toContain("Private fixture records");
    expect(html).not.toContain(wallet.address);
  }
  const entry = profile(null, false);
  expect(entry).toContain("Connect wallet");
  expect(entry).toContain('href="/explore"');
  expect(entry).toContain("No transaction or spending approval");
  expect(entry).not.toContain("Chog holder access");
});
it("keeps a nonqualifying player's records readable without offering holder cosmetics", () => {
  const html = profile({
    authenticated: true,
    status: "practice-only",
    message: HOLDER_QUALIFICATION_MESSAGE,
    checkedAt: null,
    fighters: [...STARTERS],
  });
  expect(html).toContain("Private fixture records");
  expect(html).toContain("Hold 500 $CHOG or a Chog NFT");
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain(wallet.address);
});
it.each(["token", "nft", "both"] as const)(
  "presents %s perks without claiming a title is earned or publishing identity",
  (status) => {
    const view: AccessView = {
      authenticated: true,
      status,
      message: "Holder access unlocked",
      checkedAt: 1,
      fighters: [...PUBLIC_FIGHTERS],
    };
    const html = renderToStaticMarkup(
      createElement(HolderPerks, { view, profile: true }),
    );
    expect(html).toContain("Unlocked");
    expect(html).toContain(
      status === "token" ? "Requires a Chog NFT" : "Unlocked · Chog NFT",
    );
    expect(html).toContain("to earn “Keeper of the Echo”");
    expect(html).toContain("publishing each result requires consent");
    expect(html).not.toContain(wallet.address);
    expect(html).not.toContain("Coming soon");
  },
);
it("public exploration and cosmetic controls expose real actions with distinct consent", () => {
  const publicPage = renderToStaticMarkup(createElement(ExplorePage));
  expect(publicPage).toContain("Public history token ID");
  expect(publicPage).toContain("No wallet required");
  expect(publicPage).not.toContain("Private fixture records");
  const toggle = renderToStaticMarkup(
    createElement(
      HolderCosmeticToggle,
      {
        equipped: false,
        busy: false,
        equip: action,
      },
      createElement("p", null, "Private fixture records"),
    ),
  );
  expect(toggle).toContain('type="checkbox"');
  expect(toggle).not.toContain("checked=");
  expect(toggle).toContain("new encounters");
});
