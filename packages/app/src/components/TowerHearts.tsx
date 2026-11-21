import { BATTLE_TOWER } from "@chessroyale/core";
import { livesLeftWords } from "../tower.ts";

/**
 * A pixel heart on a 9 x 8 grid (Eric, Nov 21: "drawn hearts ... more like video game pixelated ... two different colors of red, like one
 * as a border"). `.` empty, `B` border, `R` fill, `H` highlight; the colors are in tower.css (`.tw-px-*`), a spent one greyed.
 */
const HEART = [
  ".BB...BB.",
  "BRRB.BRRB",
  "BRHRBRRRB",
  "BRRRRRRRB",
  ".BRRRRRB.",
  "..BRRRB..",
  "...BRB...",
  "....B....",
];

const PIXELS = HEART.flatMap((row, y) =>
  [...row].flatMap((c, x) => {
    const cls = c === "B" ? "tw-px-b" : c === "R" ? "tw-px-r" : c === "H" ? "tw-px-h" : "";
    return cls ? [<rect key={`${x}-${y}`} class={cls} x={x} y={y} width="1" height="1" />] : [];
  }),
);

/**
 * A Battle Tower run's lives as hearts (Eric, Nov 20: "2 lives"; docs/decisions/2026-11-20-tower-lives.md): always every one of them
 * (BATTLE_TOWER.lives), a spent one hollow (its border greyed, its slot faint; Eric, Nov 21: "they're both hollow ... it just looks like
 * there's a slot there"), the ones left first. The run's strip, the floor room, the clerk's card and the board's side show it.
 */
export function TowerHearts({ lives, class: cls }: { lives: number; class?: string }) {
  return (
    <span class={`tw-hearts${cls ? ` ${cls}` : ""}`} role="img" aria-label={livesLeftWords(lives)} data-lives={lives}>
      {Array.from({ length: BATTLE_TOWER.lives }, (_, i) => (
        <svg key={i} class={`tw-heart${i < lives ? "" : " spent"}`} viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true">
          {PIXELS}
        </svg>
      ))}
    </span>
  );
}
