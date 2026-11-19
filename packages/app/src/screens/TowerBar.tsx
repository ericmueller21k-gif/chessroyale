import { useMemo, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount } from "@chessroyale/core";
import { artOf, bossKit } from "../characters/kits.ts";
import { SpriteAnim, frameImage } from "../components/BossEffect.tsx";
import type { Character } from "../characters/sprite.ts";
import { BossBarExtra, RageMeter } from "../components/BossPowers.tsx";
import { BossFace, BossSide } from "../components/BossCharacter.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { VoiceBubble, bossVoice } from "../speech.tsx";
import { BossLevel } from "./Boss.tsx";
import { Beaten } from "./Tower.tsx";
import { floorRating } from "../tower.ts";
import type { BossView, GameView } from "../game.ts";

/**
 * A Battle Tower floor's battle (PR 10, the approved mockups 1 to 6 on stills/battle-tower): the run's strip in place of the title
 * line, the boss bar split in equal parts for 2 or 3 bosses (each figure whole, one scale for all; the boss to move lit with a TO
 * MOVE tag, the others dimmed, never hidden), and on a computer the figures stacked beside the board in turn order, the one to move
 * stepped forward. One boss: today's bar and figure. Every part keeps its size and place for the whole floor.
 */

/** Each boss on a floor of several, as a bar draws him (his own view, with the battle's board); null with one boss. */
export function sideOf(boss: BossView): { bosses: BossView[]; toMove: number; moved: number } | null {
  const side = boss.side;
  if (!side || side.bosses.length < 2) return null;
  return { bosses: side.bosses.map((b) => ({ ...b, board: boss.board }) as BossView), toMove: side.toMove, moved: side.moved };
}

/** The boss who made the side's last move (the dock's "Ginger plays e5"): the one who moved on a floor of several, else the boss. */
export function moverOf(boss: BossView): BossView {
  const s = sideOf(boss);
  return s ? (s.bosses[s.moved] ?? boss) : boss;
}

/** The run's strip: "Battle Tower · Floor 4 of 99", the bosses beaten (the last 6, or 9 on a computer; the rest counted), the next floor's rating, the moves left. */
export function TowerStrip({ match, computer = false }: { match: GameView; computer?: boolean }) {
  const play = match.tower;
  const boss = match.boss;
  if (!play) return null;
  const left = boss ? Math.max(0, boss.maxMoves - boss.crowdMoves) : null;
  const next = play.floor + 1;
  return (
    <span class={`tw-strip${computer ? " tw-strip-wide" : ""}`} data-tower-floor={play.floor}>
      <span class="tw-strip-top">
        Battle Tower<span> · Floor {play.floor} of {BATTLE_TOWER.floors}</span>
      </span>
      <span class="tw-strip-row">
        {computer && boss && <span>Move {Math.min(boss.crowdMoves + 1, boss.maxMoves)} ·</span>}
        {play.beaten.length > 0 && <Beaten ids={play.beaten.flat()} max={computer ? 9 : 6} />}
        {next <= BATTLE_TOWER.floors && (
          <span>
            Next floor <b>{floorRating(next, floorBossCount(next))}</b>
          </span>
        )}
        {left !== null && <span class="tw-left">{`${left} ${left === 1 ? "move" : "moves"} left`}</span>}
      </span>
    </span>
  );
}

/** The figure box's height in a phone's part (px): the bar's 99 less its name, level and meters lines. */
const PART_FIGURE_H = 46;

/** A figure's drawn part in its idle's first frame (sprite px): its canvas has room around it for his moves and props. */
const drawn = new Map<string, { top: number; bottom: number; left: number; right: number }>();
function drawnBox(name: string, art: Character, idle: string): { top: number; bottom: number; left: number; right: number } {
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
            {/* (His words from his own part of the bar: the boss to move's, whose turn and powers come next.) */}
            {on && !computer && <VoiceBubble voice={bossVoice} class="bc-bubble tw-bubble" balanced />}
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
export function TowerSide({ boss }: { boss: BossView }) {
  const side = sideOf(boss)!;
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const [since] = useState(() => Date.now());
  const scale = useMemo(() => sharedScale(side.bosses.map((b) => b.name), 150, 170), [side.bosses.map((b) => b.name).join(",")]);
  const n = side.bosses.length;
  return (
    <div class="boss-side tw-side">
      {side.bosses.map((b, i) => (
        <span class={`tw-side-fig${i === side.toMove ? " tw-to-move" : ""}`} key={`${i}-${b.id}`} data-boss={b.id} style={{ bottom: `${((n - 1 - i) * 100) / n}%`, height: `${100 / n}%` }}>
          {i === side.toMove && <VoiceBubble voice={bossVoice} class="bc-bubble tw-side-bubble" />}
          <Figure boss={b} scale={scale} since={since} still={still} />
        </span>
      ))}
    </div>
  );
}

/** The figures beside the board (a computer's): the floor's several stacked (TowerSide), else the boss's own (BossSide). */
export function SideFigures({ match }: { match: GameView }) {
  return match.boss && sideOf(match.boss) ? <TowerSide boss={match.boss} /> : <BossSide match={match} />;
}
