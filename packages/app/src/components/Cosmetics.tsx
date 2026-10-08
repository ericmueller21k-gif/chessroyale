import { GodKingSprite } from "./GodKing.tsx";

/**
 * Shop cosmetics, drawn: pawn hats (a 100 × 100 box the size of a square, the
 * hat sitting where a pawn's head is) and a preview of a God King effect.
 */
export function PawnHat({ hat }: { hat: string }) {
  if (hat === "none") return null;
  const line = { stroke: "#1d1d1f", "stroke-width": 3, "stroke-linejoin": "round" as const };
  return (
    <svg class="pawn-hat" viewBox="0 0 100 100" aria-hidden="true">
      {/* Drawn with brims near y 34; moved up so a hat sits snug on the pawn's head (brim near y 25, a few points
          below the top of the head), not over the whole head. */}
      <g transform="translate(0 -9)">
      {hat === "party" && (
        <g {...line}>
          <path d="M50 2 L64 34 L36 34 Z" fill="#ec4899" />
          <path d="M45 14 L55 14 M41 24 L59 24" stroke="#fde047" stroke-width="4" />
          <circle cx="50" cy="3" r="5" fill="#fde047" />
        </g>
      )}
      {hat === "crown" && (
        <g {...line}>
          <path d="M33 34 L31 14 L41 22 L50 9 L59 22 L69 14 L67 34 Z" fill="#f2c14e" />
          <circle cx="50" cy="26" r="3" fill="#e11d48" stroke-width="1.5" />
        </g>
      )}
      {hat === "wizard" && (
        <g {...line}>
          <path d="M30 34 Q50 28 70 34 L66 38 Q50 33 34 38 Z" fill="#3730a3" />
          <path d="M37 34 Q48 18 56 2 Q58 18 63 34 Z" fill="#4f46e5" />
          <path d="M50 20 l1.5 3 3 .5 -2.2 2 .6 3 -2.9-1.5 -2.9 1.5 .6-3 -2.2-2 3-.5 Z" fill="#fde047" stroke-width="1" />
        </g>
      )}
      {hat === "top" && (
        <g {...line}>
          <rect x="29" y="31" width="42" height="6" rx="2" fill="#1d1d1f" />
          <rect x="37" y="6" width="26" height="27" rx="2" fill="#27272a" />
          <rect x="37" y="24" width="26" height="5" fill="#dc2626" stroke-width="1.5" />
        </g>
      )}
      {hat === "viking" && (
        <g {...line}>
          <path d="M33 34 Q33 14 50 14 Q67 14 67 34 Z" fill="#9ca3af" />
          <path d="M33 30 Q22 26 20 12 Q28 22 35 24 Z" fill="#fef3c7" />
          <path d="M67 30 Q78 26 80 12 Q72 22 65 24 Z" fill="#fef3c7" />
          <rect x="32" y="31" width="36" height="5" rx="2" fill="#a16207" />
        </g>
      )}
      </g>
    </svg>
  );
}

/** A pawn of your colour wearing a hat (the shop's preview). */
export function HattedPawn({ hat, side = "w" }: { hat: string; side?: "w" | "b" }) {
  return (
    <span class="hatted-pawn cg-wrap" aria-hidden="true">
      <piece class={`${side === "w" ? "white" : "black"} pawn`} />
      <PawnHat hat={hat} />
    </span>
  );
}

/** The God King in a King effect's colours: his glow, and a bolt beside him. */
export function KingEffectPreview({ look, side = "w" }: { look: Record<string, string>; side?: "w" | "b" }) {
  return (
    <span class="king-effect-preview" style={{ "--ks-bolt": look.bolt, "--ks-glow": look.glow, "--ks-beam": look.beam } as Record<string, string>} aria-hidden="true">
      <svg class="kep-fx" viewBox="0 0 100 100">
        <rect x="38" y="0" width="24" height="86" fill="var(--ks-beam)" opacity="0.45" />
        <path class="ks-bolt" d="M14 4 L26 30 L18 34 L32 62 L24 64 L38 92" />
        <path class="ks-bolt" d="M86 6 L74 28 L82 32 L70 58 L78 60 L64 90" />
      </svg>
      <GodKingSprite side={side} anim="raised" class="kep-king" />
    </span>
  );
}
