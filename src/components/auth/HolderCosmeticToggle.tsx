"use client";
/** One opt-in control for the same server-backed presentation setting. */
export function HolderCosmeticToggle({
  equipped,
  busy,
  equip,
}: {
  equipped: boolean;
  busy: boolean;
  equip: (enabled: boolean) => Promise<void>;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={equipped}
        disabled={busy}
        onChange={(event) => void equip(event.target.checked)}
      />
      Equip holder frame, arena light and companion celebration for new
      encounters
    </label>
  );
}
