import Link from "next/link";
import { Brand } from "./Brand";
import { SiteNavigation } from "./SiteNavigation";
export function SiteHeader({
  current = "/",
  cinematic = false,
}: {
  current?: string;
  cinematic?: boolean;
}) {
  return (
    <header className={cinematic ? "landing-nav" : "topbar"}>
      <Link
        prefetch={false}
        className={cinematic ? "landing-brand" : "wordmark"}
        href="/"
        aria-label="Soryn home"
      >
        <Brand />
      </Link>
      <SiteNavigation current={current} />
    </header>
  );
}
