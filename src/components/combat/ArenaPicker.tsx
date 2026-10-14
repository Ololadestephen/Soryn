import { arenaIds, arenas, type ArenaChoice } from "../../domain/combat/arenas";

import Image from "next/image";
export function ArenaPicker({
  value,
  disabled,
  onChange,
}: {
  value: ArenaChoice;
  disabled: boolean;
  onChange: (choice: ArenaChoice) => void;
}) {
  return (
    <fieldset className="arena-picker" disabled={disabled}>
      <legend>
        Choose an arena <small>Cosmetic · same combat rules</small>
      </legend>
      <div className="arena-options">
        {arenaIds.map((id) => (
          <label key={id} className={value === id ? "arena-selected" : ""}>
            <Image
              unoptimized
              src={`/combat/arenas/${id}-preview.webp`}
              alt=""
              width={240}
              height={160}
            />
            <input
              type="radio"
              name="arena"
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span>{arenas[id].name}</span>
          </label>
        ))}
      </div>
      <label className="arena-random">
        <input
          type="radio"
          name="arena"
          value="random"
          checked={value === "random"}
          onChange={() => onChange("random")}
        />
        Random · chosen once for this match
      </label>
    </fieldset>
  );
}
