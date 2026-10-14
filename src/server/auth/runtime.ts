import { AuthService } from "./service";
import { IdentityStore } from "./persistence";
import { PrivyTokenVerifier } from "./privy";
import { database } from "../database";
import { MonadReader } from "../nft/rpc";

export function identityRuntime() {
  const store = database(),
    records = new IdentityStore(store);
  const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";
  return {
    store,
    records,
    origin,
    auth: new AuthService(records, new MonadReader(), origin),
    verifier: new PrivyTokenVerifier(
      process.env.CHOG_PRIVY_SERVER_APP_ID ||
        process.env.NEXT_PUBLIC_PRIVY_APP_ID ||
        "",
      process.env.PRIVY_VERIFICATION_KEY ?? "",
      Date.now,
      process.env.PRIVY_VERIFICATION_MODE === "jwks" ? "jwks" : "pem",
    ),
  };
}
