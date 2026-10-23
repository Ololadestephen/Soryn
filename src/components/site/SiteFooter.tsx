import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer>
      <Link
        prefetch={false}
        className="wordmark"
        href="/"
        aria-label="Soryn home"
      >
        <Brand />
      </Link>
      <Link prefetch={false} href="/help">
        Help &amp; FAQ
      </Link>
      <div>
        <p>Soryn fiction · not official Chog or Monad lore.</p>
        <p className="music-credit">
          Music:{" "}
          <a href="https://www.scottbuckley.com.au/library/legionnaire-2022/">
            Legionnaire — Scott Buckley
          </a>{" "}
          · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        </p>
      </div>
    </footer>
  );
}
