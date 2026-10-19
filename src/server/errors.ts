export class ServiceError extends Error {
  readonly retryAfterSeconds?: number;
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: "revision-conflict" | "stale-battle",
    options?: ErrorOptions & { retryAfterSeconds?: number },
  ) {
    super(message, options);
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
