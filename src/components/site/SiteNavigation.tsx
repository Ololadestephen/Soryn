"use client";
import { useRef } from "react";
import Link from "next/link";
const secondary = [
  ["/help", "Help & FAQ"],
  ["/history", "Battle History"],
  ["/archive", "Archive"],
] as const;
export function SiteNavigation({ current }: { current: string }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  function closeMore() {
    if (more.current) more.current.open = false;
  }
  const links = secondary.map(([href, label]) => (
    <Link
      key={href}
      prefetch={false}
      href={href}
      aria-current={current === href ? "page" : undefined}
      onClick={() => {
        closeMore();
        drawer.current?.close();
      }}
    >
      {label}
    </Link>
  ));
  return (
    <div className="site-navigation">
      <nav className="nav-primary" aria-label="Main navigation">
        <Link prefetch={false} className="nav-wide" href="/#fighters">
          Fighters
        </Link>
        <Link
          prefetch={false}
          className="nav-wide"
          href="/character"
          aria-current={current === "/character" ? "page" : undefined}
        >
          My Chog
        </Link>
        <Link
          prefetch={false}
          className="nav-play"
          href="/start"
          aria-current={current === "/start" ? "page" : undefined}
        >
          Play now
        </Link>
      </nav>
      <details
        className="nav-more"
        ref={more}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeMore();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeMore();
            summary.current?.focus();
          }
        }}
      >
        <summary ref={summary}>More</summary>
        <nav aria-label="Secondary navigation">{links}</nav>
      </details>
      <button
        className="nav-mobile-toggle"
        aria-haspopup="dialog"
        onClick={() => drawer.current?.showModal()}
      >
        Menu
      </button>
      <dialog
        className="nav-drawer"
        ref={drawer}
        aria-labelledby="navigation-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
      >
        <div className="nav-drawer-content">
          <div className="nav-drawer-heading">
            <h2 id="navigation-title">Explore Soryn</h2>
            <button onClick={() => drawer.current?.close()}>Close menu</button>
          </div>
          <nav aria-label="Mobile navigation">
            <Link
              prefetch={false}
              href="/#fighters"
              onClick={() => drawer.current?.close()}
            >
              Fighters
            </Link>
            <Link
              prefetch={false}
              href="/character"
              onClick={() => drawer.current?.close()}
            >
              My Chog
            </Link>
          </nav>
          <p className="eyebrow">Help &amp; records</p>
          <nav aria-label="Mobile secondary navigation">{links}</nav>
        </div>
      </dialog>
    </div>
  );
}
