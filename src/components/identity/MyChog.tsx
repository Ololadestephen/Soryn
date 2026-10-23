"use client";
import { useState } from "react";
import Image from "next/image";
import { TokenPicker } from "./TokenPicker";
import Link from "next/link";
import { AccessGate, useAccessState } from "../auth/AccessGate";
import { character } from "../../domain/characters/definitions";
import { HolderPerks } from "../site/HolderPerks";
import assets from "../combat/rendered/assets.json";
import { OfficialExperience } from "./OfficialExperience";

function MyCollection({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const view = useAccessState();
  const [historicalOpen, setHistoricalOpen] = useState(false);
  const nft = view?.status === "nft" || view?.status === "both";
  return (
    <>
      <nav className="mychog-progress button-row" aria-label="Your progress">
        <Link prefetch={false} href="/story">
          Story progress
        </Link>
        <Link prefetch={false} href="/history?as=holder">
          Wallet history
        </Link>
        <Link prefetch={false} href="/arena">
          Practice
        </Link>
      </nav>
      {nft && (
        <section
          id="nft-competitor"
          className="mychog-competitor"
          aria-labelledby="nft-title"
        >
          <h2 id="nft-title">NFT competitor</h2>
          <OfficialExperience onMuseumChanged={onMuseumChanged} />
        </section>
      )}
      <section className="mychog-fighters" aria-labelledby="available-title">
        <h2 id="available-title">Available fighters</h2>
        <ul data-count={view?.fighters.length}>
          {view?.fighters.map((id) => (
            <li key={id}>
              <Image
                unoptimized
                loading="lazy"
                src={assets[id].thumbnail}
                alt=""
                width={72}
                height={72}
              />
              <span>
                <strong>{character(id).name}</strong>
                <small>{character(id).role}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <details className="mychog-perks">
        <summary>Holder perks</summary>
        <HolderPerks view={view} profile />
      </details>
      {!nft && (
        <details
          className="mychog-record-history"
          onToggle={(event) => setHistoricalOpen(event.currentTarget.open)}
        >
          <summary>Previous NFT records and publication consent</summary>
          {historicalOpen && <TokenPicker historyOnly />}
        </details>
      )}
    </>
  );
}
export function MyChog({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  return (
    <AccessGate profile>
      <MyCollection onMuseumChanged={onMuseumChanged} />
    </AccessGate>
  );
}
