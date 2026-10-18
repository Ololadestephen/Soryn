"use client";
import dynamic from "next/dynamic";
import { MyChogEntry } from "./MyChogPanel";
import { MyChog } from "./MyChog";

const PrivyIdentity = dynamic(() => import("../auth/PrivyIdentity"), {
  ssr: false,
  loading: () => (
    <div className="mychog-page">
      <MyChogEntry ready={false} message="Loading wallet sign-in…" />
    </div>
  ),
});
export function OfficialIdentity({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (appId)
    return (
      <PrivyIdentity appId={appId}>
        <MyChog onMuseumChanged={onMuseumChanged} />
      </PrivyIdentity>
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
