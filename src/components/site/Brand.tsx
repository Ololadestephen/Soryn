import Image from "next/image";

/** The site mark matches the favicon; the wordmark retains the display face. */
export function Brand({ hero = false }: { hero?: boolean }) {
  return (
    <span className={`game-brand${hero ? " game-brand-hero" : ""}`}>
      {!hero && (
        <Image
          unoptimized
          src="/brand/soryn-icon.svg"
          width={40}
          height={40}
          alt=""
        />
      )}
      <svg className="wordmark-svg" viewBox="0 0 320 72" role="img">
        <title>Soryn</title>
        <text x="0" y="58" fill="#e7bc72">
          SORYN
        </text>
      </svg>
    </span>
  );
}
