import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site/SiteHeader";
import { SiteFooter } from "../../components/site/SiteFooter";
import { helpSections } from "./content";
import "./help.css";

export const metadata: Metadata = {
  title: "Help & FAQ · Soryn",
  description:
    "Learn Soryn’s controls, modes, wallet access, saved progress and privacy. Find help with matchmaking, connection issues and safe sign-in.",
};

export default function HelpPage() {
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#help-main">
        Skip to help
      </a>
      <SiteHeader current="/help" />
      <main className="help-page" id="help-main" tabIndex={-1}>
        <header className="help-intro">
          <p className="eyebrow">A guide to the arena</p>
          <h1>Help &amp; FAQ</h1>
          <p>How to play, connect your wallet and keep your progress.</p>
          <div className="help-actions">
            <Link prefetch={false} className="world-button" href="/start">
              Play now
            </Link>
            <Link prefetch={false} href="/arena">
              Try Practice
            </Link>
          </div>
        </header>
        <div className="help-layout">
          <nav className="help-topics" aria-label="Help topics">
            <p className="eyebrow">On this page</p>
            {helpSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
          <div className="help-sections">
            {helpSections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
              >
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                <p className="help-section-intro">{section.intro}</p>
                {section.questions.map(({ question, answer }) => (
                  <details className="help-question" key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
                <a className="help-back" href="#help-main">
                  Back to topics
                </a>
              </section>
            ))}
          </div>
        </div>
        <aside className="help-recovery" aria-labelledby="help-recovery-title">
          <h2 id="help-recovery-title">Looking for an existing save?</h2>
          <p>
            Keep your current browser session. Choose the identity and mode you
            used before.
          </p>
          <nav aria-label="Saved progress help">
            <Link prefetch={false} href="/history">
              Guest battle history
            </Link>
            <Link prefetch={false} href="/history?as=holder">
              Wallet history
            </Link>
            <Link prefetch={false} href="/character">
              My Chog
            </Link>
            <Link prefetch={false} href="/archive">
              Earlier adventures
            </Link>
          </nav>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
