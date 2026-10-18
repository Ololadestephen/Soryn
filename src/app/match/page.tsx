import { PlayIdentity } from "../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { MatchScreen } from "../../components/match/MatchScreen";

export const metadata: Metadata = {
  title: "Find a Match · Soryn",
  description: "Public unranked best-of-three battles. No invitation required.",
};

export default async function MatchPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const official = (await searchParams).as === "chog";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#match-main">
        Skip to matchmaking
      </a>
      <SiteHeader current="/match" />
      <main className="arena-main" id="match-main" tabIndex={-1}>
        <PlayIdentity official={official} holder={!official}>
          <MatchScreen />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
