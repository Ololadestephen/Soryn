import type { MoveTreatment } from "../../domain/combat/presentation/moves";

function Shape({ shape }: { shape: MoveTreatment["shape"] }) {
  switch (shape) {
    case "stone":
      return <circle cx="50" cy="50" r="24" />;
    case "lens":
      return (
        <>
          <circle cx="50" cy="50" r="32" fill="none" />
          <circle cx="50" cy="50" r="17" />
          <path d="M50 5V27M50 73V95M5 50H27M73 50H95" />
        </>
      );
    case "fist":
      return <path d="M26 64V31H39V21H55V24H71V39H83V66L64 80H41Z" />;
    case "parcel":
      return (
        <>
          <path d="M14 26L64 13L88 32V76L38 89L14 71Z" />
          <path d="M39 23L62 42V82M16 27L39 47L87 32" fill="none" />
        </>
      );
    case "tool":
      return (
        <path d="M20 20L38 13L37 31L29 37L77 78L71 87L22 44L10 41L8 28L17 31Z" />
      );
    case "gear":
      return (
        <>
          <path d="M43 7H57L60 23L76 16L86 27L76 41L93 44V58L78 62L85 77L73 85L59 76L55 93H42L38 77L22 84L13 72L24 58L7 55V41L23 38L16 23L27 14L41 24Z" />
          <circle cx="50" cy="50" r="15" fill="none" />
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M17 81Q5 15 83 16Q84 85 17 81Z" />
          <path d="M17 81L70 29" fill="none" />
        </>
      );
    case "bloom":
      return (
        <>
          <circle cx="50" cy="50" r="12" />
          {[0, 60, 120, 180, 240, 300].map((n) => (
            <ellipse
              key={n}
              cx="50"
              cy="24"
              rx="12"
              ry="20"
              transform={`rotate(${n} 50 50)`}
            />
          ))}
        </>
      );
    case "shield":
      return (
        <>
          <path d="M16 16L51 7L87 22L77 66L51 92L26 68Z" />
          <path d="M50 21V73M29 44H72" fill="none" />
        </>
      );
    case "slash":
      return <path d="M8 89Q71 38 88 9Q88 58 8 89Z" />;
    case "needle":
      return (
        <>
          <path d="M7 77L89 14L28 86Z" />
          <path d="M37 70L94 48M23 52L65 8" fill="none" />
        </>
      );
    case "orb":
      return (
        <>
          <circle cx="50" cy="50" r="23" />
          <path d="M12 73Q8 18 65 13" fill="none" />
        </>
      );
    case "mask":
      return (
        <>
          <path d="M12 27L48 39L88 20L80 62L49 83L20 64Z" />
          <path d="M25 44L39 52M61 48L75 37M38 64Q52 77 67 60" fill="none" />
        </>
      );
    case "dart":
      return <path d="M50 3L87 50L50 96L13 50ZM50 3V96" />;
    case "spectrum":
      return (
        <>
          <path d="M8 72L48 4L93 78Z" />
          <path d="M27 62L52 20L76 66M14 86H88" fill="none" />
        </>
      );
    case "spark":
      return <path d="M62 4L18 55H47L32 96L83 38H56Z" />;
    case "circuit":
      return (
        <>
          <path d="M8 18H33V49H71V17H94M9 83H39V62H85V94" fill="none" />
          <circle cx="8" cy="18" r="6" />
          <circle cx="94" cy="17" r="6" />
          <circle cx="9" cy="83" r="6" />
          <circle cx="85" cy="94" r="6" />
        </>
      );
    case "flame":
      return (
        <path d="M47 96Q3 78 25 43L33 54Q43 21 60 4Q54 41 79 50Q98 89 47 96Z" />
      );
    case "memory":
      return (
        <>
          <path d="M9 25Q34 13 50 27Q71 11 92 23V77Q70 65 50 83Q31 70 9 78ZM50 28V82" />
          <path
            d="M27 42Q42 28 40 48Q26 62 32 64M61 40H79M62 51H78"
            fill="none"
          />
        </>
      );
    default:
      throw new Error("Unsupported combat effect.");
  }
}
export function MoveEffect({
  treatment,
  hit = 1,
}: {
  treatment: MoveTreatment;
  hit?: number;
}) {
  return (
    <svg
      key={`${treatment.key}:${hit}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`move-effect effect-${treatment.shape} treatment-${treatment.key} hit-${hit}`}
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        <Shape shape={treatment.shape} />
      </g>
    </svg>
  );
}
