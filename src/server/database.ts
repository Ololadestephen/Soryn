import { Store } from "./persistence";
let store: Store | undefined;
export function database(): Store {
  store ??= new Store(process.env.CHOG_DB_PATH ?? "data/local/chog.sqlite");
  return store;
}
