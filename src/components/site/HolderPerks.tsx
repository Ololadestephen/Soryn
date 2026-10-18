import Link from "next/link";
import {
  CHOG_REQUIREMENT,
  TOKEN_UNLOCKS,
  type AccessView,
} from "../../domain/access/policy";
import { character } from "../../domain/characters/definitions";
import { companions } from "../combat/rendered/catalogue";
import { IdleArt } from "./landing/IdleArt";

export function HolderPerks({
  view,
  profile = false,
}: {
  view?: AccessView | null;
  profile?: boolean;
}) {
  const unlocked =
    view?.status === "token" ||
    view?.status === "nft" ||
    view?.status === "both";
  const nft = view?.status === "nft" || view?.status === "both";
  const label = unlocked ? "Unlocked" : "Requires holder access";
  return (
    <section
      className={`holder-perks${profile ? "" : " landing-section"}`}
      id={profile ? "my-perks" : "holders"}
      aria-labelledby={profile ? "my-perks-title" : "holder-title"}
    >
      <h2 id={profile ? "my-perks-title" : "holder-title"}>Holder perks</h2>
      <p>
        {profile && unlocked
          ? "Your wallet qualifies. "
          : `When access is open, hold ${CHOG_REQUIREMENT}. `}
        Holdings are checked, never spent. No stat boosts.
      </p>
      <div className="holder-perk-grid">
        {TOKEN_UNLOCKS.map((id) => (
          <article className="holder-perk" key={id}>
            <div className="holder-perk-art">
              <IdleArt id={id} loading="lazy" />
              <div className="holder-perk-companion">
                <IdleArt id={id} companion loading="lazy" />
              </div>
            </div>
            <span className="perk-state">{label}</span>
            <h3>
              {character(id).name} &amp; {companions[id]}
            </h3>
            <p>
              Additional fighter and companion. Both qualification routes unlock
              this pair.
            </p>
          </article>
        ))}
        <article className="holder-perk">
          <span className="perk-state">{label}</span>
          <h3>Make your entrance</h3>
          <p>
            Opt-in profile frame, arena light and companion victory celebration.
            Apply them to new encounters.
          </p>
          <Link
            prefetch={false}
            href={profile && unlocked ? "#holder-cosmetics" : "/character"}
          >
            Manage presentation
          </Link>
        </article>
        <article className="holder-perk">
          <span className="perk-state">{label} · after Story completion</span>
          <h3>The echo nook</h3>
          <p>
            Complete the optional Story encounter to earn “Keeper of the Echo”.
            Earned titles stay in your private Story progress.
          </p>
          <Link prefetch={false} href="/story">
            View Story
          </Link>
        </article>
        <article className="holder-perk">
          <span className="perk-state">
            {nft ? "Unlocked · Chog NFT" : "Requires a Chog NFT"}
          </span>
          <h3>A persistent competitor</h3>
          <p>
            Select an owned Chog for token-bound results and the broader private
            roster. Player history stays separate; publishing each result
            requires consent.
          </p>
          <Link
            prefetch={false}
            href={profile && nft ? "#nft-competitor" : "/character"}
          >
            Select an NFT competitor
          </Link>
        </article>
      </div>
      {!profile && (
        <Link
          prefetch={false}
          className="world-button outline"
          href="/character"
        >
          My Chog
        </Link>
      )}
    </section>
  );
}
