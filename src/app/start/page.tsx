import type { Metadata } from "next";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { PlayMenu } from "../../components/site/PlayMenu";
export const metadata: Metadata = {
  title: "Play · Soryn",
  description:
    "Choose a public match, a friend room, The Fractured Sanctuary or Practice.",
};
export default function StartPage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#play-main">
        Skip to play modes
      </a>
      <SiteHeader current="/start" />
      <main className="arena-main" id="play-main" tabIndex={-1}>
        <PlayMenu />
      </main>
      <SiteFooter />
    </div>
  );
}
