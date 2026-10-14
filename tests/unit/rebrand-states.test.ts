import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WalletSignIn } from "../../src/components/identity/WalletSignIn";
import { emptyWalletSession } from "../../src/components/identity/useWalletSession";
import { identityFor } from "../../src/domain/identity";
import { holderAccessMessage } from "../../src/components/identity/accessMessage";
import { GameplayShowcase } from "../../src/components/site/landing/GameplayShowcase";
import { Brand } from "../../src/components/site/Brand";

type Game = Parameters<typeof WalletSignIn>[0]["game"];
function state(overrides: Partial<Game> = {}): Game {
  return {
    ...emptyWalletSession,
    selectedCharacter: "pip",
    setSelectedCharacter: () => {},
    providerReady: true,
    authenticated: false,
    wallets: [],
    selectWallet: () => {},
    busy: false,
    error: "",
    pending: null,
    wallet: "",
    challenge: null,
    connect: () => {},
    prepare: async () => {},
    sign: async () => {},
    logout: async () => {},
    mutate: async () => {},
    start: () => {},
    clearChallenge: () => {},
    ...overrides,
  };
}
const render = (overrides: Partial<Game> = {}) =>
  renderToStaticMarkup(createElement(WalletSignIn, { game: state(overrides) }));

it("keeps signed-out, preparing and no-eligible-token states distinct without granting UI access", () => {
  expect(render()).toContain("Sign in with Privy");
  const preparing = render({ busy: true, providerReady: false });
  expect(preparing).toContain('disabled=""');
  expect(preparing).toContain("Preparing wallet sign-in");
  const nonOwner = render({
    challenge: {
      owner: false,
      nonce: "test",
      message: "Disposable fixture access message",
    },
  });
  expect(nonOwner).toContain("No eligible Chog found");
  expect(nonOwner).not.toContain("Verified Chog holder");
  expect(nonOwner).toContain('href="/arena"');
});
it("labels a verified grant but replaces the badge on ownership or provider failure", () => {
  const account = {
    wallet: `0x${"1".repeat(40)}`,
    identity: identityFor("276"),
    expires: 1,
    grant: true,
  };
  expect(render({ account })).toContain("Verified Chog holder");
  for (const error of [
    "Current-owner grant unavailable or revoked. Sign in again after any ownership change.",
    "Fresh, consistent Monad ownership evidence unavailable. Retry; guest play remains available.",
    "Privy session unavailable.",
  ]) {
    const html = render({ account, error });
    expect(html).toContain("Holder access needs attention");
    expect(html).not.toContain("Verified Chog holder");
    expect(html).toContain('role="alert"');
    expect(html).toContain(holderAccessMessage(error));
    expect(html).not.toContain("No official write was authorized");
  }
  expect(holderAccessMessage("Wallet session expired. Sign in again.")).toBe(
    "Wallet session expired. Sign in again.",
  );
});
it("ships a readable vector brand and an explicit gameplay control without initial video or poster media", () => {
  const brand = renderToStaticMarkup(createElement(Brand, { hero: true }));
  expect(brand).toContain('alt="Déjà Vu"');
  expect(brand).toContain("/brand/wordmark.svg");
  const showcase = renderToStaticMarkup(createElement(GameplayShowcase));
  expect(showcase).toContain("Play gameplay");
  expect(showcase).toContain("Defence prepares");
  expect(showcase).not.toMatch(/<video|src="[^\"]*(?:mp4|webm|poster)/);
});
