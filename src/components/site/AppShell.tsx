"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { useGuestSession } from "../guest/GuestProvider";
import { GuestRequestError } from "../guest/GuestRequestError";

const headings: Record<string, [string, string]> = {
  "/play": ["Guest practice", "Adventure"],
  "/museum": ["Public adventure challenges", "Museum of Bad Decisions"],
  "/journal": ["Private guest records", "Adventure journal"],
  "/character": ["Chog holder access", "My Chog"],
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const game = useGuestSession();
  const [label, title] = headings[pathname] ?? headings["/play"];
  useEffect(() => {
    if (previousPath.current !== pathname)
      (
        document.getElementById("page-title") ??
        document.getElementById("page-content")
      )?.focus({ preventScroll: true });
    previousPath.current = pathname;
  }, [pathname]);
  return (
    <div className="site-wrap">
      <a
        className="skip-link"
        href={pathname === "/play" ? "#adventure" : "#page-content"}
      >
        {pathname === "/play" ? "Skip to the adventure" : "Skip to content"}
      </a>
      <SiteHeader current={pathname} />
      <main id="page-content" className="app-content" tabIndex={-1}>
        {pathname !== "/character" && (
          <div className="page-intro">
            <p className="eyebrow">{label}</p>
            <h1 id="page-title" tabIndex={-1}>
              {title}
            </h1>
          </div>
        )}
        {pathname !== "/play" && pathname !== "/character" && (
          <GuestRequestError {...game} />
        )}
        {(pathname === "/play" ||
          pathname === "/journal" ||
          pathname === "/museum") && (
          <p className="archive-banner">
            This adventure is archived. Saved records are still here.{" "}
            <Link href="/archive">About the archive</Link>
            {pathname === "/play" && (
              <>
                {" · "}
                <Link href="/journal">Open the journal</Link>
              </>
            )}
            {" · "}
            <Link href="/arena">Back to battles</Link>
          </p>
        )}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
