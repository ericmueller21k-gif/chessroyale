import { BATTLE_TOWER } from "@chessroyale/core";
import { livesLeftWords } from "../tower.ts";

/**
 * A Battle Tower run's lives as hearts (Eric, Nov 20: "2 lives"; docs/decisions/2026-11-20-tower-lives.md): always every one of them
 * (BATTLE_TOWER.lives), a spent one greyed (Eric's rule: nothing hidden, nothing shifts), the ones left first. The run's strip, the
 * floor room and the clerk's card show it (tower.css `.tw-hearts`).
 */
export function TowerHearts({ lives, class: cls }: { lives: number; class?: string }) {
  return (
    <span class={`tw-hearts${cls ? ` ${cls}` : ""}`} role="img" aria-label={livesLeftWords(lives)} data-lives={lives}>
      {Array.from({ length: BATTLE_TOWER.lives }, (_, i) => (
        <svg key={i} class={`tw-heart${i < lives ? "" : " spent"}`} viewBox="0 0 16 14" aria-hidden="true">
          <path d="M8 13.6 1.7 7.6C-.4 5.6.1 1.7 3.1.7 5.1 0 7 .9 8 2.5 9 .9 10.9 0 12.9.7c3 1 3.5 4.9 1.4 6.9Z" />
        </svg>
      ))}
    </span>
  );
}
