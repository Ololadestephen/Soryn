import Link from "next/link";
import { Brand } from "./Brand";

const destinations = [
  ["/challenge", "Challenge"],
  ["/arena", "Practice"],
  ["/#fighters", "Fighters"],
  ["/character", "My Chog"],
  ["/history", "Battle history"],
] as const;

export function SiteHeader({ current = "/" }: { current?: string }) {
  return (
    <header className="topbar">
      <Link
        prefetch={false}
        className="wordmark"
        href="/"
        aria-label="Chog Déjà Vu home"
      >
        <Brand />
      </Link>
      <nav aria-label="Main navigation">
        {destinations.map(([href, label]) => (
          <Link
            key={href}
            prefetch={false}
            href={href}
            aria-current={current === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <span className="badge">Local preview</span>
    </header>
  );
}
