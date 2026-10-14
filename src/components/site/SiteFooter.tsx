import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer>
      <Link
        prefetch={false}
        className="wordmark"
        href="/"
        aria-label="Déjà Vu home"
      >
        <Brand />
      </Link>
      <p>
        Creature battles. Second chances.
        <br />
        Guest practice is private · local preview
      </p>
    </footer>
  );
}
