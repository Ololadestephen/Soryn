"use client";
import dynamic from "next/dynamic";
import { IdentityIntro } from "./IdentityIntro";
import { PublicChapterLookup } from "./PublicChapters";

const PrivyIdentity = dynamic(() => import("../auth/PrivyIdentity"), {
  ssr: false,
  loading: () => <p role="status">Loading Privy wallet sign-in…</p>,
});
export function OfficialIdentity({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (appId)
    return <PrivyIdentity appId={appId} onMuseumChanged={onMuseumChanged} />;
  return (
    <section
      id="character"
      className="official-identity"
      aria-labelledby="identity-title"
    >
      <div className="identity">
        <IdentityIntro />
        <div className="identity-status">
          <span className="badge">Wallet sign-in · Privy</span>
          <h3>Privy setup is pending.</h3>
          <p>
            Wallet sign-in will open through Privy once this installation is
            configured. Guest adventures and public chapters are available now.
          </p>
          <button disabled>Sign in with Privy</button>
          <p className="muted">
            No NFT transaction or spending approval is needed.
          </p>
        </div>
      </div>
      <PublicChapterLookup />
    </section>
  );
}
