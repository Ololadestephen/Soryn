import { parseInput } from "../httpShared";
import { characterIdSchema } from "../../domain/characters/definitions";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  stepRequestSchema,
  publicationRequestSchema,
  withdrawalRequestSchema,
} from "../../domain/requests";
import { RunService } from "./runs";
import { GuestJournal } from "./journal";
import { database } from "../database";
import {
  response,
  failure,
  body,
  guestCookieOptions,
  requireJsonOrigin,
} from "../httpShared";
import { ServiceError } from "../errors";

const requestSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("start"),
    id: z.uuid(),
    mode: z.literal("guest"),
    characterId: characterIdSchema.optional(),
    exhibitId: z.uuid().nullable(),
    retryOf: z.uuid().nullable(),
  }),
  stepRequestSchema,
  publicationRequestSchema,
  withdrawalRequestSchema,
  z.strictObject({
    operation: z.literal("race"),
    id: z.uuid(),
    chapterId: z.uuid(),
  }),
]);
const cookieName = "chog_guest";
function actorFor(request: NextRequest): string | null {
  const parsed = z.uuid().safeParse(request.cookies.get(cookieName)?.value);
  return parsed.success ? parsed.data : null;
}

export function getGame(request: NextRequest): NextResponse {
  try {
    const existing = actorFor(request);
    const actor = existing ?? randomUUID();
    const db = database();
    db.rateLimit(
      existing ? `read:${actor}` : "read:anonymous-guest",
      Date.now(),
      existing ? 90 : 120,
    );
    const service = new RunService(db);
    const exhibit = request.nextUrl.searchParams.get("replay");
    const chapter = request.nextUrl.searchParams.get("chapter");
    if (exhibit && chapter)
      throw new ServiceError(400, "Choose one replay source.");
    const journal = new GuestJournal(db, service);
    const data = chapter
      ? { chapter: journal.chapter(actor, parseInput(z.uuid(), chapter)) }
      : exhibit
        ? service.publicReplay(actor, parseInput(z.uuid(), exhibit))
        : { ...service.session(actor), journal: journal.read(actor) };
    const result = response(data);
    const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
    result.cookies.set(cookieName, actor, guestCookieOptions(request, origin));
    return result;
  } catch (error) {
    return failure(error);
  }
}

export async function postGame(request: NextRequest): Promise<NextResponse> {
  try {
    const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
    requireJsonOrigin(request, origin);
    const actor = actorFor(request);
    if (!actor)
      throw new ServiceError(
        401,
        "Open the game to establish a guest session.",
      );
    const db = database();
    db.rateLimit(actor);
    const input = parseInput(requestSchema, await body(request));
    const service = new RunService(db);
    const journal = new GuestJournal(db, service);
    return db.transaction(() => {
      switch (input.operation) {
        case "start":
          return response({
            run: service.start(
              actor,
              input.id,
              input.exhibitId,
              input.retryOf,
              null,
              input.characterId,
            ),
            journal: journal.read(actor),
          });
        case "step":
          return response({
            run: service.step(actor, input.id, input.step, input.action),
            journal: journal.read(actor),
          });
        case "publish":
          return response({
            exhibit: service.publish(
              actor,
              input.id,
              input.title,
              input.alias,
              input.consent,
            ),
            journal: journal.read(actor),
          });
        case "withdraw":
          service.withdraw(actor, input.id);
          return response({ withdrawn: true, journal: journal.read(actor) });
        case "race":
          return response({
            run: journal.race(actor, input.id, input.chapterId),
            journal: journal.read(actor),
          });
        default:
          throw new ServiceError(400, "Unsupported operation.");
      }
    });
  } catch (error) {
    return failure(error);
  }
}
