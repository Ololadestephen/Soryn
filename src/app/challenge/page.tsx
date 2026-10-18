import { PlayIdentity } from "../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { ChallengeHome } from "../../components/pvp/Challenge";

export const metadata: Metadata = {
  title: "Challenge a Friend · Soryn",
};

export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const official = (await searchParams).as === "chog";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#challenge-main">
        Skip to the challenge
      </a>
      <SiteHeader current="/challenge" />
      <main className="arena-main" id="challenge-main" tabIndex={-1}>
        <PlayIdentity official={official} holder={!official}>
          <ChallengeHome />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
