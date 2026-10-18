import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site/SiteHeader";
import { SiteFooter } from "../../../components/site/SiteFooter";
import {
  profileIdentity,
  limitPublicProfile,
} from "../../../server/records/http";
import { ServiceError } from "../../../server/errors";
import { identityRuntime } from "../../../server/auth/runtime";
import { TokenRecords } from "../../../server/records/tokenRecords";
import { TokenProfileService } from "../../../server/records/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chog record · Soryn" };

const day = (at: number) => new Date(at).toISOString().slice(0, 10);

const kindLabel = {
  series: "Series",
  battle: "Battle",
  story: "Story",
  "story-encounter": "Story encounter",
  "no-contest": "No contest",
} as const;

export default async function ChogRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tokenId } = await params;
  let identity;
  try {
    const query = await searchParams;
    const fields = new URLSearchParams();
    for (const name of ["chainId", "collection"]) {
      const value = query[name];
      if (Array.isArray(value)) notFound();
      if (value !== undefined) fields.set(name, value);
    }
    identity = profileIdentity(tokenId, fields);
  } catch {
    notFound();
  }
  const { store, auth } = identityRuntime();
  try {
    limitPublicProfile(store);
  } catch (error) {
    if (!(error instanceof ServiceError) || error.status !== 429) throw error;
    return (
      <div className="site-wrap">
        <SiteHeader current="/chog" />
        <main>
          <h1>Chog profile temporarily unavailable</h1>
          <p role="status">
            Please wait a minute before checking this public profile again.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }
  const profile = await new TokenProfileService(
    new TokenRecords(store),
    auth.ownership,
  ).profile(identity);
  return (
    <div className="site-wrap">
      <a className="skip-link" href="#chog-record">
        Skip to the Chog record
      </a>
      <SiteHeader current="/chog" />
      <main className="arena-main" id="chog-record" tabIndex={-1}>
        <h1>Chog · token {profile.identity.tokenId}</h1>
        <p className="muted">
          Chain {profile.identity.chainId} · collection{" "}
          {profile.identity.collection}
        </p>
        {profile.ownership.status === "verified" ? (
          <p>
            Ownership verified at{" "}
            <time
              dateTime={new Date(profile.ownership.checkedAt!).toISOString()}
            >
              {new Date(profile.ownership.checkedAt!).toISOString()}
            </time>
            . Owner {profile.ownership.owner}. This is a dated verification, not
            a live guarantee; ownership can change afterwards.
          </p>
        ) : (
          <p role="status">
            Ownership verification is unavailable right now. Records below are
            Soryn-stored history for this token ID; treat the current owner as
            unverified until this check succeeds.
          </p>
        )}
        <section className="panel">
          <h2>Combat record</h2>
          <p>
            Series {profile.summary.series} · {profile.summary.wins} wins,{" "}
            {profile.summary.losses} losses, {profile.summary.draws} draws ·{" "}
            {profile.summary.noContest} no contests · {profile.summary.battles}{" "}
            battles recorded · {profile.summary.story} story completions.
          </p>
          {profile.records.length === 0 && (
            <p className="muted">
              No published results yet. Private official results, guest practice
              and private drafts never appear here.
            </p>
          )}
          {profile.records.map((record) => (
            <article className="panel" key={record.id}>
              <h3>
                {record.headline} · {kindLabel[record.kind]}
              </h3>
              <p>
                {record.explanation}
                {record.score ? ` Series score ${record.score}.` : ""}
              </p>
              <p>
                Played by {record.attribution}, the participating keeper at the
                time. Rules: {record.rules}. A later owner did not personally
                earn this result.
              </p>
              <p className="muted">
                {record.fighter ?? "Starter"} vs{" "}
                {record.opponentFighter ?? record.opponent ?? "unknown"} ·{" "}
                {record.arena ?? "The Fractured Sanctuary"}
                {record.rounds !== null ? ` · ${record.rounds} rounds` : ""}
                {record.route ? ` · ${record.route} route` : ""} ·{" "}
                {day(record.recordedAt)}
              </p>
            </article>
          ))}
        </section>
        <p className="muted">
          Fighters and companions are chosen Soryn loadouts, not immutable NFT
          traits. These records are stored by Soryn for this token ID; they are
          not written to the NFT or the chain. Published public history
          transfers with the character, while private sessions and account
          details stay private. <Link href="/match">Find a match</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
