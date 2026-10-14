export async function request<T>(
  path: string,
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
  const data = await reply.json();
  if (!reply.ok) throw new Error(data.error ?? "Try again.");
  return data as T;
}
