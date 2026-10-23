import { useSyncExternalStore } from "react";
import { gameMusic } from "./runtime";
export function AudioControls({
  navigation = false,
}: {
  navigation?: boolean;
}) {
  const { enabled, volume } = useSyncExternalStore(
    gameMusic.subscribe,
    gameMusic.snapshot,
    gameMusic.serverSnapshot,
  );
  return (
    <fieldset className="sound-controls">
      <legend>Music</legend>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            gameMusic.set(event.target.checked, volume);
            gameMusic.activate();
          }}
        />
        {navigation ? "Background soundtrack" : "Music on"}
      </label>
      <label>
        {navigation ? "Background volume" : "Music volume"}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => {
            const value = Number(event.target.value);
            gameMusic.set(enabled, value);
            gameMusic.activate();
          }}
        />
      </label>
      <button type="button" onClick={() => gameMusic.activate()}>
        Play music
      </button>
    </fieldset>
  );
}
