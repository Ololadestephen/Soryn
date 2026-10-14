import { useSyncExternalStore } from "react";
import { combatAudio } from "./runtime";
export function AudioControls() {
  const { enabled, volume } = useSyncExternalStore(
    combatAudio.subscribe,
    combatAudio.snapshot,
    combatAudio.serverSnapshot,
  );
  return (
    <fieldset className="sound-controls">
      <legend>Sound effects</legend>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            combatAudio.set(event.target.checked, volume);
            combatAudio.activate();
          }}
        />
        Sound effects on
      </label>
      <label>
        Sound effect volume
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => {
            const value = Number(event.target.value);
            combatAudio.set(enabled, value);
            combatAudio.activate();
          }}
        />
      </label>
      <p>
        Original sound cues start when you interact. Every action remains
        visible when muted.
      </p>
      <button type="button" onClick={() => combatAudio.ui("select")}>
        Try sound
      </button>
    </fieldset>
  );
}
