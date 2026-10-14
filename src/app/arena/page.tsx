import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { CombatScreen } from "../../components/combat/Screen";
import { arenaSuggestion } from "../../domain/combat/arenas";

export const metadata: Metadata = { title: "Arena · Chog Déjà Vu" };
export default async function ArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string | string[] }>;
}) {
  const suggestedArena = arenaSuggestion((await searchParams).arena);
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#arena-main">
        Skip to the arena
      </a>
      <SiteHeader current="/arena" />
      <main className="arena-main" id="arena-main" tabIndex={-1}>
        <div className="arena-intro">
          <p className="eyebrow">Déjà Vu · creature battles</p>
          <h1>Prepare for battle.</h1>
        </div>
        <CombatScreen
          key={suggestedArena ?? "resume"}
          suggestedArena={suggestedArena}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
