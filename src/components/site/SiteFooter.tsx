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
      <p>Soryn fiction · not official Chog or Monad lore.</p>
    </footer>
  );
}
