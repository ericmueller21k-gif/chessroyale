import type { ItemDraft } from "../../item-kit.tsx";
import { Region, LINE, lw } from "../../item-kit.tsx";

const N = 10;
const HAND: [number, number] = [76, 61];
const REST: [number, number] = [6, -31]; // knot, from the hand

// puffy balloon-animal knight head, knot at (0,0), facing left (toward the pawn)
const KNIGHT =
  "M 8 -4 C 14 -9 16 -18 13 -26 C 12 -30 10 -32 9 -33 L 7.5 -38.5 C 4.5 -37.5 2.5 -35.5 1 -33 C -6 -32 -12 -27 -15 -20 C -17 -16 -15.5 -12 -11.5 -12 C -8.5 -12 -6 -14 -3 -14 C -4 -10 -8 -8 -7 -4 C -4 -1 4 -1 8 -4 Z";
const KNOT = "M 0 -2 L -2.6 2.4 L 2.6 2.4 Z";

export const item: ItemDraft = {
  id: "babur-balloon",
  name: "Babur's Balloon",
  tier: "rare",
  slot: "weapon",
  description: "A knight that only moves up. Babur swears it's an L-shaped float.",
  frame: [56, -9, 50, 74],
  motion: { ms: Array(N).fill(300) },
  Art: ({ p, f }) => {
    const t = (f / N) * Math.PI * 2;
    const a = 6 * Math.sin(t);
    const bob = 0.9 * (1 - Math.cos(2 * t));
    const r = (a * Math.PI) / 180;
    const kx = HAND[0] + REST[0] * Math.cos(r) - REST[1] * Math.sin(r);
    const ky = HAND[1] + REST[0] * Math.sin(r) + REST[1] * Math.cos(r) + bob;
    // string: a small curl near the hand, then a bend that lags the sway
    const cx = (HAND[0] + kx) / 2 - a * 0.9;
    const cy = (HAND[1] + ky) / 2;
    const s = `M ${HAND[0]} ${HAND[1]} c 2 -2 4 -5 2 -7 c -2 -2 -4 1 -2 3 c 1 1 2 0 3 -1 Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${kx.toFixed(2)} ${(ky + 2).toFixed(2)}`;
    const tilt = a * 1.5;
    return (
      <g>
        <path d={s} fill="none" stroke="#1d1d1f" stroke-linecap="round" stroke-linejoin="round" {...lw(1.3)} />
        <circle cx={HAND[0]} cy={HAND[1]} r={1.8} fill="#f4f0e6" {...LINE} {...lw(1.4)} />
        <g transform={`translate(${kx.toFixed(2)} ${ky.toFixed(2)}) rotate(${tilt.toFixed(2)}) scale(0.98)`}>
          <Region p={p} name="knot" d={[KNOT]} line={1.6} />
          <Region p={p} name="knight" d={[KNIGHT]} />
          {/* gloss */}
          <path d="M 10.5 -29 q 3 2 2 5 q 3 2.5 1 6 q 2.5 2.5 0 5.5" fill="none" stroke="#1d1d1f" stroke-linecap="round" stroke-linejoin="round" opacity="0.45" {...lw(1.4)} />
          <path d="M -9 -25 C -6 -29.5 -1 -31 3 -30.5" fill="none" stroke="#fff" stroke-linecap="round" {...lw(3.2)} />
          <ellipse cx={5} cy={-14} rx={1.8} ry={5} fill="#fff" opacity="0.8" transform="rotate(-15 5 -14)" />
          <circle cx={-12.5} cy={-21} r={1.2} fill="#fff" />
          {/* eye and nostril */}
          <circle cx={-2.5} cy={-25} r={1.7} fill="#1d1d1f" />
          <circle cx={-13} cy={-15.5} r={0.9} fill="#1d1d1f" />
        </g>
      </g>
    );
  },
};
