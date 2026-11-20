import { useMemo, useState } from "preact/hooks";
import { artOf, bossKit } from "../characters/kits.ts";
import { SpriteAnim, frameImage } from "../components/BossEffect.tsx";
import type { Character } from "../characters/sprite.ts";
import { BossBarExtra, RageMeter } from "../components/BossPowers.tsx";
import { BossFace, BossSide } from "../components/BossCharacter.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { VoiceBubble, bossVoice } from "../speech.tsx";
import { BossLevel } from "./Boss.tsx";
import { BossPortrait } from "../components/BossPortrait.tsx";
import { portraitName } from "../characters/portraits.ts";
import { livesOf, towerBoss } from "../tower.ts";
import { TowerHearts } from "../components/TowerHearts.tsx";
import type { BossView, GameView } from "../game.ts";
import { sideOf } from "../boss-side.ts";
import "../tower.css";

/**
 * A Battle Tower floor's battle (PR 10, the approved mockups 1 to 6 on stills/battle-tower): the run's strip in place of the title
 * line, the boss bar split in equal parts for 2 or 3 bosses (each figure whole, one scale for all; the boss to move lit with a TO
 * MOVE tag, the others dimmed, never hidden), and on a computer the figures stacked beside the board in turn order, the one to move
 * stepped forward. One boss: today's bar and figure. Every part keeps its size and place for the whole floor.
 */

// (Each boss on a floor of several, from his own part of the view: boss-side.ts.)
export { moverOf, sideOf } from "../boss-side.ts";

/** Portraits of the bosses beaten, the last `max` (the rest counted: "+3"), never cut off. (Moved here from the tower's screen, PR 11b.) */
export function Beaten({ ids, max }: { ids: readonly string[]; max: number }) {
  const shown = ids.slice(-max);
  const more = ids.length - shown.length;
  return (
    <span class="tw-beaten">
      {more > 0 && <span class="tw-more">+{more}</span>}
      {shown.map((id, i) => {
        const b = towerBoss(id);
        return (
          <span class="tw-face" key={`${i}-${id}`} title={b.name}>
            {b.known && portraitName(b) ? <BossPortrait boss={b} /> : <span class="tw-unknown" aria-label={b.name}>?</span>}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Who says the line keyed `key` on a floor of several: the boss whose id starts it (a moment's line is keyed by the boss who cast it,
 * BossPowers.tsx useMomentSpeech), else the boss to move. His bubble shows it, by his own part of the bar (audit 2, finding 1).
 */
export function speakerOf(side: { bosses: readonly { id?: string }[]; toMove: number }, key: string): number {
  const i = side.bosses.findIndex((b) => !!b.id && key.startsWith(`${b.id}:`));
  return i < 0 ? side.toMove : i;
}

/**
 * The run's strip (Eric, Nov 20): "Battle Tower · Floor 4" and the run's lives (two hearts, a spent one greyed), centered. No floor count
 * (nobody is to know how many floors there are), no next floor and no moves left (the boss card says those). The beaten bosses stay on
 * the tower's own card.
 */
export function TowerStrip({ match }: { match: GameView }) {
  // (A solo floor's run, or a party floor's: Nov 20.)
  const play = match.tower ?? match.towerParty;
  if (!play) return null;
  return (
    <span class="tw-strip" data-tower-floor={play.floor}>
      <span class="tw-strip-top">
        Battle Tower<span> · Floor {play.floor}</span>
      </span>
      <TowerHearts lives={livesOf(play.lives)} />
    </span>
  );
}

/** The figure box's height in a phone's part (px): the bar's 99 less its name, level and meters lines. */
const PART_FIGURE_H = 46;

/** A figure's drawn part in its idle's first frame (sprite px): its canvas has room around it for his moves and props. */
const drawn = new Map<string, { top: number; bottom: number; left: number; right: number }>();
export function drawnBox(name: string, art: Character, idle: string): { top: number; bottom: number; left: number; right: number } {
  let b = drawn.get(name);
  if (b) return b;
  b = { top: 0, bottom: art.h, left: 0, right: art.w };
  const frame = art.anims[idle]?.frames[0];
  if (frame && typeof ImageData !== "undefined") {
    const d = frameImage(art, frame).data;
    let top = art.h, bottom = -1, left = art.w, right = -1;
    for (let y = 0; y < art.h; y++)
      for (let x = 0; x < art.w; x++)
        if (d[(y * art.w + x) * 4 + 3]) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    if (bottom >= 0) b = { top, bottom: bottom + 1, left, right: right + 1 };
  }
  drawn.set(name, b);
  return b;
}

/** One scale for every figure: the largest at which each one's drawn part fits its box (`w` × `h` px) whole. */
function sharedScale(names: readonly string[], w: number, h: number): number {
  let s = 3;
  for (const n of names) {
    const kit = bossKit(n);
    if (!kit) continue;
    const b = drawnBox(n, artOf(kit), kit.anims.idle ?? "idle");
    s = Math.min(s, w / (b.right - b.left), h / (b.bottom - b.top));
  }
  return Math.max(0.25, s);
}

/**
 * A boss's figure in his idle, at `scale` screen px a sprite px, cut to his drawn part (his canvas's room around him left out); a still
 * portrait for a boss with no figure (or an id this app doesn't know).
 */
function Figure({ boss, scale, since, still }: { boss: BossView; scale: number; since: number; still: boolean }) {
  const kit = bossKit(boss.name);
  if (!kit) return <BossFace boss={boss} class="tw-part-portrait" label="" live />;
  const art = artOf(kit);
  const idle = kit.anims.idle ?? "idle";
  const b = drawnBox(boss.name, art, idle);
  return (
    <span class="tw-fig-box" style={{ width: `${(b.right - b.left) * scale}px`, height: `${(b.bottom - b.top) * scale}px` }}>
      <SpriteAnim ch={art} anim={idle} since={since} still={still} class="tw-fig" style={{ width: `${art.w * scale}px`, height: `${art.h * scale}px`, left: `${-b.left * scale}px`, top: `${-b.top * scale}px` }} />
    </span>
  );
}

/** The split bar: one part a boss, in turn order (left to right), the boss to move lit; his words over the bar. */
export function TowerBar({ boss, match }: { boss: BossView; match: GameView }) {
  const side = sideOf(boss)!;
  const computer = useMedia("(min-width: 900px) and (pointer: fine)");
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const [since] = useState(() => Date.now());
  const n = side.bosses.length;
  // (A phone's bar is 400 px at 428: n parts, 4 px gaps, each with 4 px of padding and a 3 px outline either side.)
  const scale = useMemo(() => sharedScale(side.bosses.map((b) => b.name), (400 - 8 - 4 * (n - 1)) / n - 14, PART_FIGURE_H), [side.bosses.map((b) => b.name).join(","), n]);
  const until = match.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0;
  return (
    <div class={`boss-bar tw-bar tw-bar-${n}`} role="status" aria-label={`${side.bosses.map((b) => b.name).join(", ")}; ${side.bosses[side.toMove]?.name ?? ""} to move`}>
      {side.bosses.map((b, i) => {
        const on = i === side.toMove;
        return (
          <span class={`tw-part${on ? " tw-to-move" : ""}`} key={`${i}-${b.id}`} data-boss={b.id}>
            {on && <span class="tw-tag">TO MOVE</span>}
            {/* (His prop where it fits a part, a phone's: Babur's pump, BossUi.towerProp; Eric, Nov 20: his balloons weren't to be seen. A
                computer's stands beside his figure by the board: TowerSide. One pump on the page, never two.) */}
            {!computer && <BossBarExtra boss={b} until={until} part="towerProp" />}
            {/* (His words from his own part of the bar: the boss who says them, the one who cast a moment, else the boss to move.) */}
            {!computer && <VoiceBubble voice={bossVoice} class="bc-bubble tw-bubble" balanced mine={(k) => speakerOf(side, k) === i} />}
            <span class="tw-part-face" aria-hidden="true">
              {computer ? <BossFace boss={b} label="" live /> : <Figure boss={b} scale={scale} since={since} still={still} />}
            </span>
            <span class="tw-part-text">
              <strong class="tw-part-name">{b.name}</strong>
              <span class="tw-part-meters">
                <BossLevel boss={b} />
                <RageMeter boss={b} />
                <BossBarExtra boss={b} until={until} part="ult" />
                <BossBarExtra boss={b} until={until} />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * A computer's figures beside the board on a floor of several: stacked top to bottom in turn order (the bar's, left to right), one
 * scale for all, each one's feet at the foot of his third of the board's height; the boss to move stepped toward the board and in full
 * color, the others dimmed (as the phone's bar).
 */
export function TowerSide({ boss, match }: { boss: BossView; match: GameView }) {
  const side = sideOf(boss)!;
  const computer = useMedia("(min-width: 900px) and (pointer: fine)");
  const until = match.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0;
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const [since] = useState(() => Date.now());
  const scale = useMemo(() => sharedScale(side.bosses.map((b) => b.name), 150, 170), [side.bosses.map((b) => b.name).join(",")]);
  const n = side.bosses.length;
  return (
    <div class="boss-side tw-side">
      {side.bosses.map((b, i) => (
        <span class={`tw-side-fig${i === side.toMove ? " tw-to-move" : ""}`} key={`${i}-${b.id}`} data-boss={b.id} style={{ bottom: `${((n - 1 - i) * 100) / n}%`, height: `${100 / n}%` }}>
          {/* (His words over his own head, whoever is to move: the figure's drawn box, not his third of the board's height.) */}
          <span class="tw-side-body">
            <VoiceBubble voice={bossVoice} class="bc-bubble tw-side-bubble" mine={(k) => speakerOf(side, k) === i} />
            <Figure boss={b} scale={scale} since={since} still={still} />
            {/* (His prop beside him, a computer's: Babur's pump by his feet, toward the window's edge, as by a lone boss's figure.) */}
            {computer && <BossBarExtra boss={b} until={until} part="towerProp" />}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The figures beside the board (a computer's): the floor's several stacked (TowerSide), else the boss's own (BossSide). */
export function SideFigures({ match }: { match: GameView }) {
  return match.boss && sideOf(match.boss) ? <TowerSide boss={match.boss} match={match} /> : <BossSide match={match} />;
}
