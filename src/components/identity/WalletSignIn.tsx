"use client";
import { useState } from "react";
import Link from "next/link";
import { holderAccessMessage } from "./accessMessage";
import type { useOfficialGame } from "./useOfficialGame";

export function WalletSignIn({
  game,
}: {
  game: ReturnType<typeof useOfficialGame>;
}) {
  const [tokenId, setTokenId] = useState("");
  return (
    <div className="identity-status">
      <span className="badge">
        {game.error
          ? "Holder access needs attention"
          : game.account?.grant
            ? "Verified Chog holder"
            : "Chog holder access"}
      </span>
      <h3>
        {game.account
          ? `Token ${game.account.identity.tokenId}`
          : "Bring your Chog’s next chapter."}
      </h3>
      <p>
        Sign in with your wallet, then choose your Chog. No NFT transaction or
        spending approval is needed. You review and sign the access message
        yourself.
      </p>
      {!game.wallet && (
        <button disabled={!game.providerReady} onClick={() => game.connect()}>
          Sign in with Privy
        </button>
      )}
      <p className="muted">
        <Link prefetch={false} href="/arena">
          Play with a guest starter
        </Link>
      </p>
      {game.authenticated && !!game.wallets.length && !game.account && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void game.prepare(tokenId);
          }}
        >
          <p className="wallet-address">Privy wallet: {game.wallet}</p>
          {game.wallets.length > 1 && (
            <label>
              Wallet for this Chog
              <select
                value={game.wallet}
                onChange={(event) => game.selectWallet(event.target.value)}
              >
                {game.wallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.label} · {wallet.address}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Chog token ID
            <input
              name="token-id"
              inputMode="numeric"
              pattern="(0|[1-9][0-9]*)"
              maxLength={78}
              value={tokenId}
              onChange={(event) => {
                setTokenId(event.target.value);
                game.clearChallenge();
              }}
              required
              aria-describedby="token-help"
            />
          </label>
          <p id="token-help" className="muted">
            Use the blockchain token ID from your item details, never its
            display name.
          </p>
          <button disabled={game.busy}>Prepare chapter grant</button>
        </form>
      )}
      {game.authenticated && !game.wallets.length && (
        <p>
          No linked Ethereum wallet is connected. Sign out and reconnect a
          wallet through Privy.
        </p>
      )}
      {game.challenge && (
        <div className="sign-in-message">
          <p>
            {game.challenge.owner
              ? "Ownership checked for the selected wallet."
              : "No eligible Chog found for this wallet and token ID. Choose a token you currently own, or continue guest play."}
          </p>
          <details open>
            <summary>Review your chapter grant</summary>
            <pre>{game.challenge.message}</pre>
          </details>
          <button disabled={game.busy} onClick={() => void game.sign()}>
            Authorize this Chog
          </button>
        </div>
      )}
      {game.authenticated && (
        <>
          <p className="wallet-address">
            Signed in with Privy: {game.wallet || "no connected wallet"}
          </p>
          {game.account && !game.account.grant && (
            <p>
              Holder access unavailable. Check that you still own this Chog,
              then sign in again. Guest practice and public chapters remain
              available.
            </p>
          )}
          <button
            className="secondary"
            disabled={game.busy}
            onClick={() => void game.logout()}
          >
            Sign out
          </button>
        </>
      )}
      {game.busy && (
        <p role="status">
          {game.authenticated
            ? "Verifying holder access…"
            : "Preparing wallet sign-in…"}
        </p>
      )}
      {game.error && (
        <p role="alert" className="error">
          {holderAccessMessage(game.error)}
        </p>
      )}
    </div>
  );
}
