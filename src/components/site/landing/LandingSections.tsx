import Link from "next/link";
export function HolderInvite() {
  return (
    <section
      className="landing-holders landing-section"
      id="holders"
      aria-labelledby="holder-title"
    >
      <h2 id="holder-title">Your Chog, in the arena.</h2>
      <div>
        <p>
          Verified Chog Genesis holders unlock eight additional fighters.
          Private records stay with you.
        </p>
        <Link
          prefetch={false}
          href="/character"
          className="world-button outline"
        >
          My Chog
        </Link>
      </div>
    </section>
  );
}
