import Link from "next/link";
export function HolderInvite() {
  return (
    <section
      className="landing-holders landing-section"
      id="holders"
      aria-labelledby="holder-title"
    >
      <div>
        <p className="world-kicker">Chog holder access</p>
        <h2 id="holder-title">
          Your Chog.
          <br />
          <em>Your next chapter.</em>
        </h2>
      </div>
      <div>
        <p className="holder-lead">Start with four. Discover eight more.</p>
        <p>
          Four guest starters need no wallet. Verified current Chog Genesis
          holders can access eight additional fighters through My Chog.
        </p>
        <p>
          Play with your Chog’s identity and keep a private battle history.
          Private records stay with you.
        </p>
        <Link
          prefetch={false}
          href="/character"
          className="world-button outline"
        >
          Meet My Chog
        </Link>
        <p className="holder-footnote">
          Connect only when you choose to. Guest play is always available.
        </p>
      </div>
    </section>
  );
}
export function Closing() {
  return (
    <section className="landing-closing" aria-labelledby="closing-title">
      <p className="world-kicker">The next move is yours</p>
      <h2 id="closing-title">
        Your first battle
        <br />
        is one move away.
      </h2>
      <div className="gateway-actions">
        <Link prefetch={false} className="world-button" href="/arena">
          Enter the arena
        </Link>
        <Link prefetch={false} className="closing-holder" href="/character">
          Explore holder fighters
        </Link>
      </div>
      <p>Four guest starters. No wallet required.</p>
    </section>
  );
}
export function SecondaryExperiences() {
  return (
    <section
      className="landing-secondary landing-section"
      id="questions"
      aria-labelledby="questions-title"
    >
      <p className="world-kicker">Before you battle</p>
      <h2 id="questions-title">Four starters. No wallet required.</h2>
      <p className="secondary-intro">
        Challenge a friend or practice against the computer. Holder fighters
        stay locked until My Chog verifies ownership.
      </p>
      <div className="secondary-links">
        <Link prefetch={false} href="/challenge">
          <span>Two seats</span>
          <strong>Challenge a friend</strong>
          <p>Send an invitation. Your friend takes the open seat.</p>
        </Link>
        <Link prefetch={false} href="/arena">
          <span>Computer practice</span>
          <strong>Enter the arena</strong>
          <p>Easy, medium and hard practice still use the current rules.</p>
        </Link>
        <Link prefetch={false} href="/archive">
          <span>Earlier adventures</span>
          <strong>Open the archive</strong>
          <p>Saved sandwich chapters, the journal and the museum stay put.</p>
        </Link>
      </div>
      <details>
        <summary>Do I need a wallet to battle a friend?</summary>
        <p>
          No. Four starter fighters can challenge a friend or practice against
          the computer. Eight holder fighters stay locked until verified
          ownership. Guest battles never create official token history.
        </p>
      </details>
      <details>
        <summary>Does a battle become public?</summary>
        <p>
          No. Practice and private friend battles stay with the people who
          played them. There is no public matchmaking, ranking or wager in this
          version.
        </p>
      </details>
    </section>
  );
}
