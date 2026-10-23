import { PlayIdentity } from "../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { CombatScreen } from "../../components/combat/Screen";
import { arenaSuggestion } from "../../domain/combat/arenas";

export const metadata: Metadata = { title: "Practice · Soryn" };
export default async function ArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string | string[]; as?: string }>;
}) {
  const params = await searchParams;
  const suggestedArena = arenaSuggestion(params.arena);
  const wallet = params.as === "holder";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#arena-main">
        Skip to the arena
      </a>
      <SiteHeader current="/arena" />
      <main className="arena-main" id="arena-main" tabIndex={-1}>
        <div className="arena-intro">
          <h1>Practice</h1>
        </div>
        <PlayIdentity official={false} holder={wallet}>
          <CombatScreen
            key={suggestedArena ?? "resume"}
            suggestedArena={suggestedArena}
          />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
