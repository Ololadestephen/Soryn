"use client";
import { WalletBoundary } from "../auth/WalletSession";
import { MyChogEntry } from "./MyChogPanel";
import { MyChog } from "./MyChog";

export function OfficialIdentity({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (appId)
    return (
      <WalletBoundary>
        <MyChog onMuseumChanged={onMuseumChanged} />
      </WalletBoundary>
    );
  return (
    <div className="mychog-page">
      <MyChogEntry
        ready={false}
        message="Wallet sign-in is unavailable while Privy is unconfigured."
      />
    </div>
  );
}
