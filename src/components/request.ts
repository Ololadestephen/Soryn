export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export async function request<T>(
  path: string,
  parse: (value: unknown) => T,
  input?: Record<string, unknown>,
  signal?: AbortSignal,
  headers: Record<string, string> = {},
): Promise<T> {
  const reply = await fetch(
    path,
    input
      ? {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal,
        }
      : { cache: "no-store", signal, headers },
  );
  const retryAfter =
    reply.status === 429
      ? retryDelay(reply.headers?.get("Retry-After"))
      : undefined;
  let data: unknown;
  try {
    data = await reply.json();
  } catch {
    throw new RequestError(
      reply.ok
        ? "The server response was unavailable. Reload or retry the saved request."
        : `Request unavailable (${reply.status}). Please retry.`,
      reply.status,
      undefined,
      retryAfter,
    );
  }
  if (!reply.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Try again.";
    const code =
      data &&
      typeof data === "object" &&
      "code" in data &&
      typeof data.code === "string" &&
      data.code.length <= 48
        ? data.code
        : undefined;
    throw new RequestError(message, reply.status, code, retryAfter);
  }
  try {
    return parse(data);
  } catch {
    throw new RequestError(
      "The server response was invalid. Reload or retry the saved request.",
      reply.status,
    );
  }
}

function retryDelay(value: string | null | undefined): number {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, seconds) : 60;
}

/** Use only for acknowledged operations whose response body is not consumed. */
export function ignoreResponse(): void {}
