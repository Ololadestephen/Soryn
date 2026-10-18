"use client";
import { ignoreResponse } from "../request";

import { officialStartRequest } from "../characters/startRequests";
import type { CharacterId } from "../../domain/characters/definitions";
import { useRef, useState } from "react";
import { identityFor } from "../../domain/identity";
import {
  officialSessionSchema,
  signInChallengeSchema,
} from "../../domain/adventure/responses";
import { request } from "../request";
import { useWalletAdapter } from "../auth/WalletAdapter";

import { selectedWallet, hexMessage } from "./wallet";
import { useWalletSession, emptyWalletSession } from "./useWalletSession";

export function useOfficialGame(onMuseumChanged: () => Promise<void>) {
  const {
    session,
    setSession,
    wallet,
    challenge,
    setChallenge,
    busy,
    setBusy,
    error,
    setError,
    pending,
    setPending,
    revision,
  } = useWalletSession();
  const adapter = useWalletAdapter();
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterId>("pip");
  const lock = useRef(false);
  const selected = async () =>
    selectedWallet(await adapter.provider(), adapter.address);
  const authorizedRequest = async <T>(
    parse: (value: unknown) => T,
    input: Record<string, unknown>,
  ) =>
    request("/api/identity", parse, input, undefined, await adapter.headers());
  async function perform(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Wallet operation unavailable.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function connect() {
    adapter.login();
  }
  function prepare(tokenId: string) {
    return perform(async () => {
      const selectedAddress = await selected();
      if (selectedAddress !== wallet)
        throw new Error("Wallet changed. Connect again before signing.");
      setChallenge(
        await authorizedRequest(signInChallengeSchema.parse, {
          operation: "challenge",
          wallet: selectedAddress,
          identity: identityFor(tokenId),
        }),
      );
    });
  }
  function sign() {
    return perform(async () => {
      if (!challenge || (await selected()) !== wallet)
        throw new Error(
          "Request a new sign-in message for the selected wallet.",
        );
      const signedRevision = revision.current;
      const hex = hexMessage(challenge.message);
      const signature = await (
        await adapter.provider()
      ).request({
        method: "personal_sign",
        params: [hex, wallet],
      });
      if (revision.current !== signedRevision || (await selected()) !== wallet)
        throw new Error("Wallet changed while signing. Request a new message.");
      const signed = await authorizedRequest(officialSessionSchema.parse, {
        operation: "verify",
        nonce: challenge.nonce,
        message: challenge.message,
        signature,
      });
      if (revision.current !== signedRevision) {
        await request("/api/identity", ignoreResponse, { operation: "logout" });
        throw new Error("Wallet changed while verifying. Sign in again.");
      }
      setSession(signed);
      setChallenge(null);
    });
  }
  function mutate(input: Record<string, unknown>) {
    return perform(async () => {
      setPending(input);
      if ((await selected()) !== session.account?.wallet)
        throw new Error("Wallet changed. Sign in again.");
      setSession(await authorizedRequest(officialSessionSchema.parse, input));
      setPending(null);
      if (input.operation === "publish" || input.operation === "withdraw")
        await onMuseumChanged();
    });
  }
  function start(
    exhibitId: string | null = null,
    retryOf: string | null = null,
  ) {
    if (exhibitId) {
      setError("Museum challenges use labelled guest practice.");
      return;
    }
    void mutate(officialStartRequest(selectedCharacter, retryOf));
  }
  function logout() {
    return perform(async () => {
      await request("/api/identity", ignoreResponse, { operation: "logout" });
      await adapter.logout();
      setSession(emptyWalletSession);
      setChallenge(null);
      setPending(null);
    });
  }
  function changeToken() {
    return perform(async () => {
      await request("/api/identity", ignoreResponse, { operation: "logout" });
      setSession(emptyWalletSession);
      setChallenge(null);
      setPending(null);
    });
  }
  return {
    changeToken,
    ...session,
    selectedCharacter,
    setSelectedCharacter,
    providerReady: adapter.ready,
    authenticated: adapter.authenticated,
    wallets: adapter.wallets,
    selectWallet: adapter.selectWallet,
    busy,
    error,
    pending,
    wallet,
    challenge,
    connect,
    prepare,
    sign,
    logout,
    mutate,
    start,
    clearChallenge: () => setChallenge(null),
  };
}
