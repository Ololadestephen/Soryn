import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    channel:
      process.env.CHOG_E2E_BROWSER_CHANNEL === "chrome" ? "chrome" : undefined,
  },
  webServer: [
    {
      command: "node tests/browser-support/rpc-server.mjs",
      url: "https://127.0.0.1:3200/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3100",
      url: baseURL,
      reuseExistingServer: false,
      env: {
        APP_ORIGIN: baseURL,
        CHOG_DB_PATH: "test-results/e2e.sqlite",
        MONAD_RPC_URL: "https://127.0.0.1:3200",
        CHOG_PRIVY_SERVER_APP_ID: "chog-character-fixture",
        PRIVY_VERIFICATION_MODE: "pem",
        PRIVY_VERIFICATION_KEY: process.env.CHOG_E2E_JWT_PUBLIC ?? "",
        CHOG_PVP_TIMERS: "test",
        CHOG_PVP_MOVE_MS: "8000",
        CHOG_PVP_PRESENT_MS: "500",
        CHOG_PVP_LOADING_MS: "4000",
      },
    },
  ],
});
