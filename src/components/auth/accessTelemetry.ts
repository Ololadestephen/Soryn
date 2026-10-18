export type LoginStage =
  | "connect-click"
  | "chooser-visible"
  | "wallet-selected"
  | "handoff-start"
  | "signature-request"
  | "signature-returned"
  | "session-ready"
  | "eligibility-start"
  | "eligibility-ready";
export function loginStage(stage: LoginStage, status?: string) {
  if (typeof window === "undefined") return;
  const at = performance.now();
  performance.mark(`soryn:${stage}`);
  // Local diagnostics only: no addresses, session tokens, signatures or network reporting.
  try {
    const previous = JSON.parse(
      sessionStorage.getItem("soryn-login-stages") ?? "[]",
    ) as { stage: LoginStage; at: number }[];
    sessionStorage.setItem(
      "soryn-login-stages",
      JSON.stringify(
        [...previous, { stage, at, ...(status ? { status } : {}) }].slice(-40),
      ),
    );
  } catch {
    /* Timing storage is optional and never blocks sign-in. */
  }
}
