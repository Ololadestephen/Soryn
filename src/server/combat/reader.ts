import { AccessBoundary, protectWalletActor } from "../access/boundary";
import { parseInput } from "../httpShared";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { battleModeSchema } from "../../domain/combat/contracts";
import { AuthService } from "../auth/service";
import { type PrivyVerifier } from "../auth/privy";
import { type WalletSession } from "../auth/persistence";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import { ServiceError } from "../errors";
import { BattleService } from "./service";

interface BattleReader {
  actor: string;
  mode: "guest" | "official";
  session: WalletSession | null;
  existingGuest: boolean;
}
export async function battleReader(
  request: NextRequest,
  auth: AuthService,
  verifier: PrivyVerifier,
  store: import("../persistence").Store,
): Promise<BattleReader> {
  const mode = parseInput(
    battleModeSchema,
    request.nextUrl.searchParams.get("mode") ?? "guest",
  );
  const access = new AccessBoundary(
    store,
    new URL(request.url).origin,
    auth,
    verifier,
  );
  const player = await access.player(request);
  if (mode === "guest" && player)
    return { mode, session: null, actor: player.actor, existingGuest: true };
  if (mode === "official") {
    const secret = walletSecret(request);
    const session = matchSession(
      auth,
      secret,
      await privyFor(request, verifier),
    );
    await auth.authorize(secret);
    return { mode, session, actor: session.actor, existingGuest: false };
  }
  const cookie = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  if (cookie.success) protectWalletActor(store, cookie.data);
  return {
    mode,
    session: null,
    existingGuest: cookie.success,
    actor: cookie.success ? cookie.data : randomUUID(),
  };
}
export function readBattleView(
  request: NextRequest,
  service: BattleService,
  reader: BattleReader,
) {
  const { actor, mode, session } = reader;
  const id = request.nextUrl.searchParams.get("id");
  const saved = service.session(actor, mode, session ?? undefined);
  if (!id) return saved;
  const record = service.records.get(parseInput(z.uuid(), id), actor);
  if (record.mode !== mode)
    throw new ServiceError(404, "Battle unavailable in this mode.");
  return { ...saved, battle: service.view(record) };
}
