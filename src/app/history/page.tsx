import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { BattleHistoryPage } from "../../components/pvp/History";

export const metadata: Metadata = { title: "Battle history · Chog Déjà Vu" };

export default function HistoryPage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#history-main">
        Skip to battle history
      </a>
      <SiteHeader current="/history" />
      <main className="arena-main" id="history-main" tabIndex={-1}>
        <BattleHistoryPage />
      </main>
      <SiteFooter />
    </div>
  );
}
