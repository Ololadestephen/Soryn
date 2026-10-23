import type { AdventureMutationRequest } from "../../domain/requests";

type Props<T extends AdventureMutationRequest = AdventureMutationRequest> = {
  error: string;
  pending: T | null;
  busy: boolean;
  mutate: (input: T) => Promise<void>;
};

export function GuestRequestError<
  T extends AdventureMutationRequest = AdventureMutationRequest,
>({ error, pending, busy, mutate }: Props<T>) {
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
