import { PlayIdentity } from "../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { BattleHistoryPage } from "../../components/pvp/History";

export const metadata: Metadata = { title: "Battle History · Soryn" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const wallet = (await searchParams).as === "holder";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#history-main">
        Skip to battle history
      </a>
      <SiteHeader current="/history" />
      <main className="arena-main" id="history-main" tabIndex={-1}>
        <PlayIdentity official={false} holder={wallet} recordsOnly>
          <BattleHistoryPage />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
