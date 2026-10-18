import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";

export const metadata: Metadata = { title: "Archive · Soryn" };

export default function ArchivePage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#archive-main">
        Skip to the archive
      </a>
      <SiteHeader current="/archive" />
      <main className="arena-main pvp-archive" id="archive-main" tabIndex={-1}>
        <p className="eyebrow">Kept, not deleted</p>
        <h1>Earlier adventures</h1>
        <p>
          Soryn is a battle game. The sandwich adventure, its journal, the
          Museum of Bad Decisions and adventure ghosts are no longer part of the
          main path. Their records stay here and are not mixed into Story.
          Nothing was erased.
        </p>
        <ul>
          <li>
            <Link href="/play">Play the archived adventure</Link>
            <span>
              Your guest session can still open an unfinished chapter.
            </span>
          </li>
          <li>
            <Link href="/journal">Open the adventure journal</Link>
            <span>
              Private chapters stay with this browser’s guest session.
            </span>
          </li>
          <li>
            <Link href="/museum">Visit the Museum of Bad Decisions</Link>
            <span>Consented public chapters remain readable.</span>
          </li>
        </ul>
        <p>
          <Link href="/story">Play the new story</Link>
        </p>
        <p>
          <Link href="/arena">Practice</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
