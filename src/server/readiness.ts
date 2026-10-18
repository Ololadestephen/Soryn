import { database } from "./database";
import type { Store } from "./persistence";
import { response } from "./httpShared";

export function readiness(
  open: () => Store = database,
  identifier = process.env.SORYN_BUILD_ID ?? "local-development",
) {
  const build = /^[a-zA-Z0-9._-]{1,80}$/.test(identifier)
    ? identifier
    : "unidentified";
  try {
    const store = open();
    store.transaction(() => store.db.prepare("SELECT 1").get());
    return response({ ready: true, build });
  } catch {
    return response({ ready: false, build }, 503);
  }
}
