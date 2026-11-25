import { useLayoutEffect } from "preact/hooks";
import { RANKED_1V1, emblemId, type RankView } from "@chessroyale/core";
import { RankEmblem } from "./RankEmblem.tsx";

/**
 * "Ranks" (MOCKUP, Nov 25; claude/game-layout-mockup): what every rank means, opened by tapping a player's rank (a 1 v 1 strip, the
 * ladder's rows, a profile's rank card). Every tier in order, Wood to Radiant, each with its five divisions' emblems (5 is the lowest,
 * 80 RP each), then the two top tiers by place (Pearlescent: the top 500; Transcendent: the top 100). The tapped player's spot lit,
 * with their words ("Illustrious 4 · 67 of 80 RP"). How RP moves, in plain words.
 */
export function RanksPopup({ rank, who, onClose }: { rank: RankView | null; who: string; onClose: () => void }) {
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const per = RANKED_1V1.pointsPerDivision;
  const divs = Array.from({ length: RANKED_1V1.divisions }, (_, i) => RANKED_1V1.divisions - i);
  const here = (tier: string, d: number | null) => !!rank && rank.tier === tier && rank.division === d;
  const words = !rank || rank.placement ? null : rank.division === null ? `${rank.tier} · ${rank.points} RP` : `${rank.tier} ${rank.division} · ${rank.points} of ${per} RP`;
  return (
    <div class="rk-scrim" onClick={onClose}>
      <div class="rk-pop" role="dialog" aria-label="Ranks" onClick={(e) => e.stopPropagation()}>
        <div class="rk-head">
          <h2>Ranks</h2>
          <button type="button" class="rk-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p class="rk-sub">
          Every tier has {RANKED_1V1.divisions} divisions of {per} RP: 5 is the lowest, 1 the highest. Win to earn RP and climb; lose and you
          drop.
        </p>
        {words && (
          <p class="rk-you">
            <strong>{who}</strong>: {words}
          </p>
        )}
        <div class="rk-list">
          {RANKED_1V1.tiers.map((t) => (
            <div class={`rk-row${rank?.tier === t.name ? " rk-on" : ""}`} key={t.name} style={{ "--rank": t.color }}>
              <span class="rk-name">{t.name}</span>
              <span class="rk-divs">
                {divs.map((d) => (
                  <span class={`rk-div${here(t.name, d) ? " rk-here" : ""}`} key={d}>
                    <RankEmblem id={emblemId(t.name, d)} class="rk-em" />
                    <small>{d}</small>
                  </span>
                ))}
              </span>
            </div>
          ))}
          {RANKED_1V1.topTiers.map((t) => (
            <div class={`rk-row rk-top${here(t.name, null) ? " rk-on" : ""}`} key={t.name} style={{ "--rank": t.color }}>
              <span class="rk-name">{t.name}</span>
              <span class="rk-divs">
                <span class={`rk-div${here(t.name, null) ? " rk-here" : ""}`}>
                  <RankEmblem id={emblemId(t.name, null)} class="rk-em" />
                </span>
                <span class="rk-place">The top {t.top} players</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
