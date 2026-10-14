import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { ChallengeHome } from "../../components/pvp/Challenge";

export const metadata: Metadata = {
  title: "Challenge a friend · Chog Déjà Vu",
};

export default function ChallengePage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#challenge-main">
        Skip to the challenge
      </a>
      <SiteHeader current="/challenge" />
      <main className="arena-main" id="challenge-main" tabIndex={-1}>
        <ChallengeHome />
      </main>
      <SiteFooter />
    </div>
  );
}
