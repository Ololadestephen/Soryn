import { createContext, useContext } from "react";
export interface FixtureState {
  authenticated: boolean;
  user: string;
  access: string | null;
  identity: string | null;
}
export const FixtureContext = createContext<FixtureState>({
  authenticated: true,
  user: "one",
  access: "access-fixture",
  identity: "identity-fixture",
});
let identity: string | null = "identity-fixture";
export function usePrivy() {
  const state = useContext(FixtureContext);
  return {
    ready: true,
    authenticated: state.authenticated,
    user: { id: state.user },
    login: () => {},
    logout: async () => {},
    getAccessToken: async () => state.access,
  };
}
export function setIdentityToken(value: string | null) {
  identity = value;
}
export function getIdentityToken() {
  return Promise.resolve(identity);
}
export function useWallets() {
  return {
    ready: true,
    wallets: [
      {
        address: "0xAAAA",
        linked: true,
        type: "ethereum",
        meta: { name: "First" },
        getEthereumProvider: async () => ({ fixture: "first" }),
      },
      {
        address: "0xBBBB",
        linked: true,
        type: "ethereum",
        meta: { name: "Second" },
        getEthereumProvider: async () => ({ fixture: "second" }),
      },
      {
        address: "0xCCCC",
        linked: false,
        type: "ethereum",
        meta: { name: "Unlinked" },
        getEthereumProvider: async () => ({ fixture: "unlinked" }),
      },
      {
        address: "solana-fixture",
        linked: true,
        type: "solana",
        meta: { name: "Solana" },
        getEthereumProvider: async () => ({ fixture: "solana" }),
      },
    ],
  };
}
