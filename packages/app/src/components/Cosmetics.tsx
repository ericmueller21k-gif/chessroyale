import { GodKingSprite } from "./GodKing.tsx";

/**
 * Shop cosmetics, drawn: the God King in a King effect's colours, his glow and a bolt beside him. (The pawn hats that
 * were here are crate items now, drawn in Items.tsx: Beta Crate, Oct 11, 2026.)
 */
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
