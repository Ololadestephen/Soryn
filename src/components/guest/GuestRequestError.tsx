import type { useGuestGame } from "./useGuestGame";

type Props = Pick<
  ReturnType<typeof useGuestGame>,
  "error" | "pending" | "busy" | "mutate"
>;

export function GuestRequestError({ error, pending, busy, mutate }: Props) {
  if (!error) return null;
  return (
    <div role="alert" className="error">
      <p>{error}</p>
      <div className="button-row">
        {pending && (
          <button disabled={busy} onClick={() => void mutate(pending)}>
            Retry saved request
          </button>
        )}
        <button className="secondary" onClick={() => location.reload()}>
          Reload saved state
        </button>
      </div>
    </div>
  );
}
