"use client";
import { competitorViewSchema } from "../../domain/responses";
import { ignoreResponse } from "../request";
import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import type { CompetitorView } from "../../domain/competitor";
import { request, RequestError } from "../request";
import { useWalletAdapter } from "../auth/WalletAdapter";

export function TokenPicker({
  onChangeToken,
  historyOnly = false,
}: {
  onChangeToken?: () => void;
  historyOnly?: boolean;
}) {
  const adapter = useWalletAdapter();
  const [reply, setReply] = useState<CompetitorView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(historyOnly);
  const getHeaders = useEffectEvent(() => adapter.headers());
  useEffect(() => {
    const abort = new AbortController();
    void getHeaders()
      .then((headers) =>
        request(
          `/api/competitor${historyOnly ? "?history=1" : ""}`,
          competitorViewSchema.parse,
          undefined,
          abort.signal,
          headers,
        ),
      )
      .then((next) => {
        if (!abort.signal.aborted) setReply(next);
      })
      .catch((problem: unknown) => {
        if (!abort.signal.aborted) {
          setReply(null);
          setError(
            historyOnly &&
              problem instanceof RequestError &&
              problem.status === 401
              ? "No linked NFT session is available in this browser. Your wallet history remains separate."
              : problem instanceof Error
                ? problem.message
                : "Verification unavailable.",
          );
        }
      });
    return () => abort.abort();
  }, [adapter.address, adapter.authenticated, historyOnly]);
  async function refresh(history = historyOnly) {
    setReply(
      await request(
        "/api/competitor" + (history ? "?history=1" : ""),
        competitorViewSchema.parse,
        undefined,
        undefined,
        await adapter.headers(),
      ),
    );
  }
  async function act(input?: Record<string, unknown>, history = historyOnly) {
    setBusy(true);
    setError("");
    try {
      if (input)
        await request(
          "/api/competitor",
          ignoreResponse,
          input,
          undefined,
          await adapter.headers(),
        );
      await refresh(history);
    } catch (problem) {
      setReply(null);
      setError(
        problem instanceof Error
          ? problem.message
          : "Verification unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  function publish(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void act({
      operation: "publish",
      id,
      alias: data.get("alias"),
      consent: data.get("consent") === "on",
    });
  }
  return (
    <section className="panel" aria-labelledby="competitor-title">
      <h3 id="competitor-title">
        {historyOnly ? "Private NFT records" : "Selected competitor"}
      </h3>
      {error && <p role="alert">{error}</p>}
      {!reply && !error && <p role="status">Verifying your selected Chog…</p>}
      {reply && (
        <>
          <p>
            <strong>Chog · token {reply.identity.tokenId}</strong>
          </p>
          <p>
            {reply.verifiedAt
              ? "Ownership verified at " +
                new Date(reply.verifiedAt).toISOString() +
                ". Checked again for official actions."
              : "Private historical session only. Current-token authority is not verified."}
          </p>
          <Link prefetch={false} href={"/chog/" + reply.identity.tokenId}>
            Public Chog profile
          </Link>
          {reply.verifiedAt && (
            <div className="button-row">
              {reply.active ? (
                <Link prefetch={false} href={reply.active.href}>
                  Resume{" "}
                  {reply.active.kind === "series"
                    ? "series"
                    : reply.active.kind === "queue"
                      ? "match search"
                      : "Story encounter"}
                </Link>
              ) : (
                <>
                  <Link prefetch={false} href="/match?as=chog">
                    Find a Match as this Chog
                  </Link>
                  <Link prefetch={false} href="/story?as=chog">
                    Story as this Chog
                  </Link>
                  <Link prefetch={false} href="/challenge?as=chog">
                    Private Chog challenge
                  </Link>
                </>
              )}
            </div>
          )}
          <details>
            <summary>Record privacy and transfers</summary>
            <p>
              Results remain private until you publish. Public entries show this
              token, your chosen alias, loadout, result and date. Published
              history follows the token with its original attribution. Private
              sessions and unfinished Story runs stay with their keeper.
            </p>
          </details>
          {!historyOnly && onChangeToken && (
            <>
              <button
                className="secondary"
                disabled={busy || !!reply.active}
                onClick={onChangeToken}
              >
                Choose another Chog
              </button>
            </>
          )}
          {reply.active && (
            <p>
              Finish or cancel the current encounter before changing your
              selection.
            </p>
          )}
          <details
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary>Your private results and publication consent</summary>
            {!reply.entries.length && <p>No private results yet.</p>}
            {reply.entries.map((entry) => (
              <article className="panel" key={entry.id}>
                <h5>
                  {entry.headline} · {entry.kind.replaceAll("-", " ")}
                </h5>
                <p>
                  {entry.fighter} ·{" "}
                  {new Date(entry.recordedAt).toISOString().slice(0, 10)} ·{" "}
                  {entry.publication}
                </p>
                {entry.canPublish && (
                  <form onSubmit={(event) => publish(event, entry.id)}>
                    <label>
                      Public attribution alias
                      <input
                        name="alias"
                        required
                        minLength={1}
                        maxLength={32}
                        autoComplete="off"
                      />
                    </label>
                    <label className="consent">
                      <input type="checkbox" name="consent" required />
                      Publish this result and alias on this Chog’s public Soryn
                      profile.
                    </label>
                    <button disabled={busy}>Publish this result</button>
                  </form>
                )}
                {entry.publication === "published" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act({ operation: "withdraw", id: entry.id }, true)
                    }
                  >
                    Withdraw this publication
                  </button>
                )}
              </article>
            ))}
          </details>
        </>
      )}
      <div className="button-row">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void act()}
        >
          Verify again
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setHistoryOpen(true);
            void act(undefined, true);
          }}
        >
          View my private history
        </button>
      </div>
      <p className="muted">
        Soryn stores these records in its own database. No NFT metadata or
        on-chain record is changed. Guest play remains separate.
      </p>
    </section>
  );
}
