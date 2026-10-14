import { useState } from "react";
import type { ArenaId } from "../../domain/combat/arenas";
export function ArenaBackdrop({ arena }: { arena: ArenaId }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {!failed && (
        <picture className="arena-backdrop">
          <source
            media="(max-width:700px) and (min-height:501px)"
            srcSet={`/combat/arenas/${arena}-portrait.webp`}
          />
          <img
            src={`/combat/arenas/${arena}-desktop.webp`}
            alt=""
            onError={() => setFailed(true)}
          />
        </picture>
      )}
      {failed && (
        <p className="arena-art-warning">
          Environment unavailable · your match is preserved
        </p>
      )}
    </>
  );
}
