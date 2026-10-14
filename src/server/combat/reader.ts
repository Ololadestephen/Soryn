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
}
export async function battleReader(
  request: NextRequest,
  auth: AuthService,
  verifier: PrivyVerifier,
): Promise<BattleReader> {
  const mode = battleModeSchema.parse(
    request.nextUrl.searchParams.get("mode") ?? "guest",
  );
  if (mode === "official") {
    const session = matchSession(
      auth,
      walletSecret(request),
      await privyFor(request, verifier),
    );
    return { mode, session, actor: session.actor };
  }
  const cookie = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  return {
    mode,
    session: null,
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
  const record = service.records.get(z.uuid().parse(id), actor);
  if (record.mode !== mode)
    throw new ServiceError(404, "Battle unavailable in this mode.");
  return { ...saved, battle: service.view(record) };
}
