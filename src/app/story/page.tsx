import { PlayIdentity } from "../../components/auth/PlayIdentity";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { StoryScreen } from "../../components/story/StoryScreen";

export const metadata: Metadata = {
  title: "The Fractured Sanctuary · Soryn",
  description:
    "Soryn fiction. A combat chapter about fighters, companions and a sanctuary whose guardians have turned on each other.",
};

export default async function StoryPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const official = (await searchParams).as === "chog";
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#story-main">
        Skip to the chapter
      </a>
      <SiteHeader current="/story" />
      <main className="arena-main" id="story-main" tabIndex={-1}>
        <PlayIdentity official={official} holder={!official}>
          <StoryScreen />
        </PlayIdentity>
      </main>
      <SiteFooter />
    </div>
  );
}
