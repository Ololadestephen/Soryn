import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site/SiteHeader";
import { SiteFooter } from "../../../components/site/SiteFooter";
import { ChallengeRoom } from "../../../components/pvp/Challenge";

export const metadata: Metadata = { title: "Private battle · Chog Déjà Vu" };

export default async function ChallengeInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#challenge-room">
        Skip to the battle
      </a>
      <SiteHeader current="/challenge" />
      <main className="arena-main" id="challenge-room" tabIndex={-1}>
        <ChallengeRoom token={token} />
      </main>
      <SiteFooter />
    </div>
  );
}
