import Image from "next/image";

/** Original vector lettering and nested memory seal; no external font request. */
export function Brand({ hero = false }: { hero?: boolean }) {
  return (
    <span className={`game-brand${hero ? " game-brand-hero" : ""}`}>
      {!hero && (
        <Image
          unoptimized
          src="/brand/emblem.svg"
          width={40}
          height={40}
          alt=""
        />
      )}
      <Image
        unoptimized
        src="/brand/wordmark.svg"
        width={575}
        height={118}
        alt="Déjà Vu"
        priority={hero}
      />
    </span>
  );
}
