export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: "revision-conflict" | "stale-battle",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
