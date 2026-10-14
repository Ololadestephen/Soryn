import { type CharacterId } from "../../domain/characters/definitions";
function StarterEquipment({ id }: { id: CharacterId; defeated: boolean }) {
  switch (id) {
    case "pip":
      return (
        <>
          <path d="M57 70Q56 40 90 39Q119 40 120 65L131 72H57" fill="#dcc36a" />
          <path d="M65 132L82 145L62 187L45 151Z" fill="#f7db65" />
          <circle cx="145" cy="172" r="17" fill="#dff1ff" />
          <path d="M134 184L120 206" strokeWidth="8" />
        </>
      );
    case "bolt":
      return (
        <>
          <path
            d="M57 56L40 12L66 27L79 60M102 56L129 12L125 55"
            fill="#c9a3df"
          />
          <path d="M61 121L119 121L110 144L65 150Z" fill="#dc8366" />
          <path
            d="M53 260L25 246L31 269L68 280M118 260L147 246L144 275L110 282"
            fill="#f7db65"
          />
        </>
      );
    case "patch":
      return (
        <>
          <path d="M77 74L132 77L134 92L77 91Z" fill="#719baf" />
          <circle cx="94" cy="82" r="9" fill="#fff4ca" />
          <circle cx="118" cy="81" r="11" fill="#fff4ca" />
          <path d="M65 139H113L119 218H61Z" fill="#719baf" />
          <path d="M71 170H108V195H71Z" fill="#e9e2f0" />
          <path
            d="M132 131L150 141L144 160L136 151L124 189"
            fill="none"
            strokeWidth="9"
          />
        </>
      );
    case "moss":
      return (
        <>
          <path
            d="M47 75Q31 31 87 26Q146 31 130 79L114 59L61 64Z"
            fill="#84ad83"
          />
          <path d="M91 47Q80 16 112 10Q117 37 91 47Z" fill="#84ad83" />
          <path d="M58 134L120 134L132 215L90 204L49 215Z" fill="#84ad83" />
          <path d="M137 126V256" fill="none" strokeWidth="7" />
          <path d="M118 140L157 140L150 163H126Z" fill="#bc9471" />
          <path
            d="M135 140Q115 111 122 104Q146 108 138 140Q143 100 159 116Q157 137 135 140"
            fill="#84ad83"
          />
        </>
      );
    default:
      throw new Error("Unsupported starter combat equipment.");
  }
}

function HolderEquipment({ id }: { id: CharacterId; defeated: boolean }) {
  switch (id) {
    case "aegis":
      return (
        <>
          <path
            d="M51 61Q83 30 119 51L136 81L128 113L104 119L65 105L52 83Z"
            fill="#9187bc"
          />
          <path d="M78 63L125 69L129 91L83 91Z" fill="#292137" />

          <path d="M47 128L67 119L115 119L136 132L117 163H63Z" fill="#9187bc" />
          <path d="M124 143L157 156L151 202L132 225L114 195Z" fill="#f7db65" />
          <path d="M132 161V201" fill="none" />
          <path d="M20 173L33 131L40 170L34 221Z" fill="#d5d3e2" />
        </>
      );
    case "nyx":
      return (
        <>
          <path
            d="M49 95L51 53L90 12L133 66L129 109L113 80L64 74Z"
            fill="#6b6087"
          />
          <path d="M57 93H122L104 116H72Z" fill="#6b6087" />
          <path
            d="M56 123L84 131L76 199L44 228L18 227L31 170Z"
            fill="#6b6087"
          />
          <path
            d="M17 163L34 138L32 179ZM139 177L156 149L153 193Z"
            fill="#d5d3e2"
          />
        </>
      );
    case "echo":
      return (
        <>
          <path
            d="M53 68L34 31L64 40L86 12L102 40L144 30L126 73Z"
            fill="#c08ab4"
          />
          <path
            d="M59 124L82 137L109 121L134 150L105 156L89 178L70 155L45 151Z"
            fill="#c08ab4"
          />
          <path
            d="M46 180Q6 188 12 237Q18 263 43 244"
            fill="none"
            strokeWidth="12"
          />
          <circle cx="145" cy="178" r="16" fill="#f7db65" />
        </>
      );
    case "prism":
      return (
        <>
          <path d="M37 76L91 10L145 77Z" fill="#7eb7b5" />
          <path d="M78 27L91 13L103 30L91 47Z" fill="#f7db65" />
          <path d="M62 133L89 153L116 132L127 220H56Z" fill="#7eb7b5" />
          <path d="M142 108V261" fill="none" strokeWidth="7" />
          <path d="M142 90L125 116L143 146L162 116Z" fill="#bde4ed" />
        </>
      );
    case "atlas":
      return (
        <>
          <path d="M34 123L66 120L69 214H29Z" fill="#bc9471" />
          <path
            d="M43 123L64 105L121 107L145 134L134 212L49 215Z"
            fill="#bc9471"
          />
          <path
            d="M67 127L80 200M112 127L103 200"
            fill="none"
            strokeWidth="8"
          />
          <path d="M122 156H165V206H122Z" fill="#f7db65" />
          <path d="M143 157V205M123 178H164" fill="none" />
        </>
      );
    case "flux":
      return (
        <>
          <path
            d="M52 69Q49 37 89 34Q125 35 127 69H137V79H45V69Z"
            fill="#f7db65"
          />
          <path d="M80 35H98V69H80Z" fill="#a6a97e" />
          <path d="M65 130L70 160H108L114 130L125 218H55Z" fill="#a6a97e" />
          <path
            d="M134 114L153 103L156 124L147 133L136 129L122 198"
            fill="none"
            strokeWidth="9"
          />
        </>
      );
    case "ember":
      return (
        <>
          <path
            d="M51 70L41 45L61 49L66 17L88 36L109 8L111 41L142 26L125 73Z"
            fill="#dc8366"
          />
          <path d="M60 131L91 153L115 128L125 205L55 205Z" fill="#dc8366" />
          <path d="M91 144L80 171H95L86 195L111 162H95Z" fill="#f7db65" />
          <path
            d="M29 162L21 145L25 133M139 164L156 150L152 135"
            fill="none"
            strokeWidth="6"
          />
        </>
      );
    case "mneme":
      return (
        <>
          <path
            d="M55 62Q28 30 49 23Q78 21 71 51M111 59Q148 21 159 44Q161 65 132 66"
            fill="#c9a3df"
          />
          <path d="M56 133L87 150L119 134L128 211L54 215Z" fill="#a58abd" />
          <path
            d="M114 168Q130 157 144 167Q156 154 171 163V198Q154 192 144 203Q129 194 114 201Z"
            fill="#fff4ca"
          />
          <path d="M144 168V201" fill="none" />
          <path
            d="M90 165Q70 154 73 179Q90 199 105 181Q111 169 92 173"
            fill="none"
            strokeWidth="4"
          />
        </>
      );
    default:
      throw new Error("Unsupported holder combat equipment.");
  }
}

export function Equipment(props: { id: CharacterId; defeated: boolean }) {
  return ["pip", "bolt", "patch", "moss"].includes(props.id) ? (
    <StarterEquipment {...props} />
  ) : (
    <HolderEquipment {...props} />
  );
}
