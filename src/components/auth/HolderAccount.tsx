"use client";
import Link from "next/link";
import Image from "next/image";
import { HolderCosmeticToggle } from "./HolderCosmeticToggle";
import type { useAccessController } from "./useAccessController";

export function HolderAccount({
  controller: c,
}: {
  controller: ReturnType<typeof useAccessController>;
}) {
  const view = c.view;
  if (!view) return null;
  const kind =
    view.status === "token"
      ? "$CHOG"
      : view.status === "nft"
        ? "Chog NFT"
        : "$CHOG + Chog NFT";
  const address = c.wallet.address;
  return (
    <details
      className="wallet-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        <span className="wallet-status-dot" aria-hidden="true" />
        <span>
          <strong>
            {address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Wallet player"}
          </strong>
          <small>{kind}</small>
        </span>
        <span className="wallet-menu-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="wallet-menu-content">
        {view.equipped && (
          <div className="holder-profile-frame">
            <Image src="/brand/soryn-icon.svg" width={36} height={36} alt="" />
            <div>
              <strong>Soryn player</strong>
              <span className="holder-badge">{kind} holder</span>
            </div>
          </div>
        )}
        <nav aria-label="Wallet account">
          <Link href="/character">My Chog & NFT competitors</Link>
          <Link href="/history?as=holder">Private battle history</Link>
        </nav>
        <HolderCosmeticToggle
          equipped={!!view.equipped}
          busy={c.busy}
          equip={c.equip}
        />
        <p className="wallet-menu-note">
          Cosmetics do not publish your wallet or results.
        </p>
        <button
          className="secondary"
          disabled={c.busy}
          onClick={() => void c.signOut()}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
