/** Presentation only: never interprets an error as authorization. */
export function holderAccessMessage(error: string) {
  if (
    /ownership (?:evidence|verification).*unavailable|RPC.*unavailable/i.test(
      error,
    )
  )
    return "We couldn’t verify this Chog right now. Try again shortly, or play with a guest starter.";
  if (/grant unavailable or revoked|ownership change/i.test(error))
    return "Holder access has changed. Sign in again with the wallet that currently owns this Chog.";
  if (/Privy.*(?:unavailable|not configured|configuration)/i.test(error))
    return "Wallet sign-in is unavailable right now. Try again shortly; guest play is still open.";
  return error;
}
