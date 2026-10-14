import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "./errors";
const MAX_BODY_BYTES = 4096;
export const GUEST_COOKIE_SECONDS = 7 * 24 * 60 * 60;

/** Secure when the browser is on HTTPS or the configured public origin is HTTPS. */
export function guestCookieOptions(request: NextRequest, origin: string) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure:
      request.nextUrl.protocol === "https:" || origin.startsWith("https:"),
    path: "/",
    maxAge: GUEST_COOKIE_SECONDS,
  };
}
export function requireJsonOrigin(request: NextRequest, origin: string): void {
  if (request.headers.get("origin") !== origin)
    throw new ServiceError(403, "Same-origin requests required.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ServiceError(415, "JSON content type required.");
}
export function response(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown): NextResponse {
  if (error instanceof ServiceError)
    return response({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return response(
      { error: "Invalid request. Check fields and supported versions." },
      400,
    );
  console.error(
    "Chog request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return response(
    {
      error:
        "Storage unavailable. Your action was not acknowledged; retry or reload.",
    },
    503,
  );
}
export async function body(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "Request body required.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ServiceError(413, "Request exceeds 4 KB.");
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ServiceError(400, "Malformed JSON request.");
  }
}
