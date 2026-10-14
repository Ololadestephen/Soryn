import Link from "next/link";
import { SiteHeader } from "../components/site/SiteHeader";
import { SiteFooter } from "../components/site/SiteFooter";

export default function NotFound() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#missing-page">
        Skip to content
      </a>
      <SiteHeader />
      <main id="missing-page" className="app-content" tabIndex={-1}>
        <div className="page-intro">
          <p className="eyebrow">404 · Page not found</p>
          <h1>This path has faded.</h1>
        </div>
        <p>
          The page you’re looking for is unavailable. Your next battle is still
          waiting.
        </p>
        <div className="button-row">
          <Link className="action-link" prefetch={false} href="/arena">
            Enter the arena
          </Link>
          <Link className="action-link secondary" prefetch={false} href="/">
            Return home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
