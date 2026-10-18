import { z } from "zod";
import { ServiceError } from "./errors";

export function readStored<T>(schema: z.ZodType<T>, record: unknown): T {
  try {
    return schema.parse(JSON.parse(String(record)));
  } catch (cause) {
    throw new ServiceError(
      503,
      "Stored game data failed validation. No permissions or writes were authorized.",
      undefined,
      { cause },
    );
  }
}
