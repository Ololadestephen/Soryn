import { Store } from "../../src/server/persistence";
import { TokenLocks } from "../../src/server/pvp/locks";
import { ServiceError } from "../../src/server/errors";
const [path, encounter, opening] = process.argv.slice(2);
const store = new Store(path);
try {
  const now = Number(opening);
  store.transaction(() =>
    new TokenLocks(store).acquire({
      token: "143:fixture:276",
      encounter,
      kind: encounter === "story" ? "story" : "series",
      owner: "fixture-owner",
      generation: "fixture-generation",
      openedAt: now,
      expiresAt: now + 60000,
    }),
  );
  process.stdout.write("acquired");
} catch (error) {
  if (!(error instanceof ServiceError) || error.status !== 409) throw error;
  process.stdout.write("conflict");
} finally {
  store.close();
}
