import { PlayIdentity } from "../../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site/SiteHeader";
import { SiteFooter } from "../../../components/site/SiteFooter";
import { ChallengeRoom } from "../../../components/pvp/Challenge";

export const metadata: Metadata = { title: "Public match · Soryn" };

export default async function PublicMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { token } = await params;
  const official = (await searchParams).as === "chog";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#challenge-room">
        Skip to the battle
      </a>
      <SiteHeader current="/match" />
      <main className="arena-main" id="challenge-room" tabIndex={-1}>
        <PlayIdentity official={official} holder={!official}>
          <ChallengeRoom token={token} />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
