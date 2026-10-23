"use client";
import type { StepRequest } from "../../domain/requests";
import type { RunView } from "../../domain/views";
const labels: Record<string, string> = {
  inspect: "Inspect nearby clue",
  "inspect-mechanism": "Inspect room mechanism",
  arch: "Enter archway",
  door: "Test painted door",
  sneak: "Cross guard patrol",
  vent: "Enter service vent",
  take: "Handle sandwich",
  swap: "Use paperweight",
  exit: "Use emergency exit",
};
export function RoomInteractions({
  run,
  busy,
  mutate,
}: {
  run: RunView;
  busy: boolean;
  mutate: (input: StepRequest) => Promise<void>;
}) {
  if (!run.observation.tactics || run.observation.outcome) return null;
  return (
    <div
      className="room-interactions"
      role="group"
      aria-label="Room interactions"
    >
      {run.observation.choices
        .filter((choice) => labels[choice.action.replace("commit-", "")])
        .map((choice) => (
          <button
            className="secondary"
            key={choice.action}
            disabled={busy}
            onClick={() =>
              void mutate({
                operation: "step",
                id: run.id,
                step: run.step,
                action: choice.action,
              })
            }
          >
            {labels[choice.action.replace("commit-", "")]}
          </button>
        ))}
    </div>
  );
}
