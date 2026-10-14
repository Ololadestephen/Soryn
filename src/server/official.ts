import type { CharacterId } from "../domain/characters/definitions";
import { createHash, randomUUID } from "node:crypto";
import { initialState, replay } from "../domain/game/engine";
import { deriveProfile } from "../domain/ghosts/policy";
import { tokenKey, type OfficialAuthority } from "../domain/identity";
import type { Action } from "../domain/game/contracts";
import { RunService } from "./runs";
import { ServiceError } from "./errors";
import {
  IdentityStore,
  type WalletSession,
  type PublicChapter,
} from "./auth/persistence";

export class OfficialService {
  readonly runs: RunService;
  constructor(private records: IdentityStore) {
    this.runs = new RunService(records.store);
  }
  session(session: WalletSession) {
    const chapters = this.records.chapters(session.identity);
    for (const chapter of chapters)
      this.records.store.expose(session.actor, chapter.scenario);
    const latest =
      !session.revoked && session.generation
        ? this.records.store
            .history(session.actor)
            .find(
              (run) =>
                run.mode === "official" &&
                run.authority?.generation === session.generation &&
                tokenKey(run.authority.identity) === tokenKey(session.identity),
            )
        : null;
    return {
      account: {
        wallet: session.wallet,
        identity: session.identity,
        expires: session.expires,
        grant: !!session.generation && !session.revoked,
      },
      run: latest ? this.runs.view(latest) : null,
      chapters,
      publication: latest ? this.publication(latest.id) : null,
      withdrawals: this.records.withdrawals(session.actor),
    };
  }
  start(
    session: WalletSession,
    authority: OfficialAuthority,
    id: string,
    retryOf: string | null,
    characterId?: CharacterId,
  ) {
    return this.runs.start(
      session.actor,
      id,
      null,
      retryOf,
      authority,
      characterId,
    );
  }
  step(
    session: WalletSession,
    authority: OfficialAuthority,
    id: string,
    step: number,
    action: Action,
  ) {
    return this.runs.step(session.actor, id, step, action, authority);
  }
  publish(
    session: WalletSession,
    authority: OfficialAuthority,
    id: string,
    title: string,
    alias: string,
    museum: boolean,
  ): PublicChapter {
    const run = this.records.store.getRun(id, session.actor);
    if (
      run.mode !== "official" ||
      run.authority?.generation !== authority.generation ||
      tokenKey(run.authority.identity) !== tokenKey(authority.identity)
    )
      throw new ServiceError(
        403,
        "Only your current-generation official run can be published.",
      );
    const state =
      replay(run.scenario, run.actions).at(-1) ?? initialState(run.scenario);
    if (!state.outcome)
      throw new ServiceError(422, "Finish the chapter before publication.");
    if (museum && state.outcome === "escaped")
      throw new ServiceError(422, "Only failures belong in the museum.");
    // Chapter and museum snapshots commit together, including nested run-service writes.
    this.records.store.transaction(() => {
      const prior = this.records.publication(run.id);
      if (prior?.status === "withdrawn")
        throw new ServiceError(410, "This chapter was withdrawn.");
      if (!prior) {
        const profile = deriveProfile([run]);
        const frozen = {
          identity: authority.identity,
          scenario: run.scenario,
          actions: [...run.actions],
          profile,
        };
        this.records.publish(
          {
            id: randomUUID(),
            runId: run.id,
            identity: authority.identity,
            title,
            alias,
            scenario: run.scenario,
            actions: [...run.actions],
            ghost: {
              version: createHash("sha256")
                .update(JSON.stringify(frozen))
                .digest("hex"),
              profile,
            },
            publishedAt: Date.now(),
            status: "published",
          },
          session.actor,
        );
      }
      if (museum)
        this.runs.publish(session.actor, id, title, alias, true, authority);
    });
    const chapter = this.publication(id);
    if (!chapter)
      throw new ServiceError(503, "Chapter publication unavailable.");
    return chapter;
  }
  private publication(runId: string): PublicChapter | null {
    const record = this.records.publication(runId);
    if (!record || record.status !== "published") return null;
    return (
      this.records
        .chapters(record.identity)
        .find((chapter) => chapter.id === record.id) ?? null
    );
  }
  withdraw(session: WalletSession, id: string): void {
    const run = this.records.store.getRun(id, session.actor);
    if (run.mode !== "official")
      throw new ServiceError(403, "This is not an official chapter.");
    // Consent revocation belongs to the original author, including after transfer.
    this.records.store.transaction(() => {
      this.records.withdraw(id, session.actor);
      if (this.records.store.publication(id))
        this.runs.withdraw(session.actor, id, true);
    });
  }
}
