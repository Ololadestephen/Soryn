import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { PublicChapterLookup } from "../../components/identity/PublicChapters";
export const metadata: Metadata = { title: "Explore Chogs · Soryn" };
export default function ExplorePage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#explore-main">
        Skip to public history
      </a>
      <SiteHeader />
      <main id="explore-main" className="mychog-explore" tabIndex={-1}>
        <h1>Explore Chogs</h1>
        <p>Find consented public records by blockchain token ID.</p>
        <PublicChapterLookup />
        <Link prefetch={false} href="/character">
          My Chog
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
