import { useLayoutEffect, useMemo } from "preact/hooks";
import { KING_ATTACK, kingAttackHits, lastStandHits, mateAttackDue } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, darkItem, type SquareItem } from "../characters/power-art.ts";
import { pickLine } from "../characters/boss-beats.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, SpriteAnim, prewarm, prewarmSprite } from "./BossEffect.tsx";
import { onSquare } from "./PowerParts.tsx";
import { CRITICAL, bossVoice } from "../speech.tsx";

/**
 * A boss's attack on a king (its kit's `kingAttack`; Hollow's, Eric, Oct 10), over the board, on the shared beats
 * (KING_ATTACK, boss-timing.ts) from `startAt` (a Date.now() time every screen agrees on): he drops in beside the king's
 * square (on the side towards the board's middle, mirrored when the king is to his left), lashes it, and leaps off.
 * Each hit plays the kit's `hit` on the king's square (on one shared canvas) and pops a "−N" off the king, in the God
 * King's strike style (`ks-hp`). His line goes into his voice as he lands. His usual figure hides meanwhile.
 *
 * Two places use it: the God King's Last Stand (the God King stands on `square`; LastStand.tsx draws him and his blows)
 * and the boss's mate (`king`: the crowd's king, which this draws in place of the real one: it flickers at each lash,
 * topples at the last and fades into the dark, and stays gone until the result).
 */

/** What the attack shows at `t` ms after it starts, for its king (pure, so tests can check the beats). */
export function kingAttackBeat(t: number): { hit: number; lit: boolean; dim: number; topple: number; gone: number } {
  const hits = kingAttackHits();
  let hit = -1;
  for (let i = 0; i < hits.length; i++) if (t >= hits[i]!) hit = i;
  const lit = hit >= 0 && t < hits[hit]! + 90;
  const A = KING_ATTACK;
  const topple = Math.max(0, Math.min(1, (t - A.toppleAt) / A.toppleMs));
  const gone = Math.max(0, Math.min(1, (t - A.toppleAt - A.toppleMs * 0.4) / (A.toppleMs * 0.9)));
  // Darker with each lash, down to half.
  return { hit, lit, dim: hit < 0 ? 0 : (hit + 1) / hits.length, topple, gone };
}

/**
 * A boss's attack drawn ahead (its frames and its hits), a slice each animation frame, as its battle starts: its first
 * drop-in frame paints new parts (about 80 ms on a computer), which would stall a phone the first time it shows. Once.
 */
const warmed = new Set<string>();
export function prewarmKingAttack(name: string): void {
  const ka = bossKit(name)?.kingAttack;
  if (!ka || warmed.has(name)) return;
  warmed.add(name);
  prewarmSprite(ka.ch, ka.ch.anims[ka.anim]?.frames ?? []);
  prewarm("lashHit", Object.entries(EFFECTS.lashHit.ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

/**
 * The boss's mate brings its attack on the crowd's king: its move mated the crowd and its kit has one. (Read on every
 * frame of the boss's screen: the board's check for mate is worked out once per position.)
 */
const mated = { key: "", due: false };
export function mateAttack(boss: BossView | null | undefined): boolean {
  if (!boss || !bossKit(boss.name)?.kingAttack) return false;
  const key = `${boss.id}:${boss.crowdSide}:${boss.board.fen}`;
  if (mated.key !== key) {
    mated.key = key;
    mated.due = mateAttackDue(boss);
  }
  return mated.due;
}

/** Where the attack's "−N" numbers float off the king (squares from its middle): round it, kept on the board. */
function hpSpot(i: number, col: number, row: number): { x: number; y: number } {
  const a = ((i * 137.5 - 90) * Math.PI) / 180;
  const r = 0.55 + (i % 3) * 0.16;
  let x = Math.cos(a) * r * 1.1;
  let y = -0.2 + Math.sin(a) * r * 0.8;
  if (col + 0.5 + x < 0.35 || col + 0.5 + x > 7.65) x = -x;
  if (row + 0.5 + y < 0.3 || row + 0.5 + y > 7.7) y = -0.4 - y;
  return { x, y };
}

export function KingAttack({
  boss,
  square,
  orientation,
  startAt,
  now,
  seed,
  king,
}: {
  boss: Pick<BossView, "name" | "id" | "startMove">;
  square: string;
  orientation: "white" | "black";
  startAt: number;
  now: number;
  /** The same on every screen for the same attack (its "−N" numbers and his line come from it). */
  seed: string;
  /** At a mate: the crowd's king (its colour), drawn here in place of the real one. */
  king?: "w" | "b";
}) {
  const kit = bossKit(boss.name);
  const ka = kit?.kingAttack;
  const t = now - startAt;
  const hp = useMemo(() => lastStandHits(`attack:${seed}`, KING_ATTACK.lashes), [seed]);
  // His line, as he lands: into his voice (his text box, for its time).
  const landed = t >= KING_ATTACK.landAt;
  useLayoutEffect(() => {
    if (!landed || !kit || t > KING_ATTACK.ms) return;
    const line = pickLine(kit, "kingAttack", seed) ?? kit.lines.kingAttack?.[0];
    if (line) bossVoice.say(line, `${boss.id}:${boss.startMove}:kingAttack:${seed}`, CRITICAL);
  }, [landed]);
  if (!kit || !ka || t < 0) return null;
  // (At a mate the king stays gone, in the dark, until the result; in the Last Stand it's over when he's gone.)
  if (!king && t > KING_ATTACK.ms) return null;
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  // He stands on the side towards the board's middle: to the king's left (as drawn) on the right half, else to its
  // right, mirrored.
  const left = col >= 4;
  const from = left ? "L" : "R";
  const { ch } = ka;
  const w = ch.w / ka.perSquare;
  const h = (w * ch.h) / ch.w;
  const footX = col + 0.5 + (left ? -ka.stand : ka.stand);
  const footY = row + 1 - 0.04;
  const footFrac = left ? ch.foot[0] / ch.w : 1 - ch.foot[0] / ch.w;
  const box = { x: footX - w * footFrac, y: footY - h * (ch.foot[1] / ch.h) };
  const sq = (v: number) => `calc(var(--cg-size, 100%) * ${v.toFixed(4)} / 8)`;
  const hits = kingAttackHits();
  const beat = kingAttackBeat(t);
  const items: SquareItem[] = [];
  hits.forEach((at, i) => {
    if (t >= at && t < at + 220) items.push(ka.hit(square, i, from, startAt + at));
  });
  // At a mate the king fades into the dark: the dark gathers on its square as it goes, and stays.
  const darkAt = startAt + KING_ATTACK.toppleAt + KING_ATTACK.toppleMs * 0.5;
  if (king && now >= darkAt) items.push(darkItem(square, "new", darkAt));
  const him = t <= KING_ATTACK.ms;
  // The king: a flash at each lash, a jolt, darker each time; then it topples away from him and goes.
  const jolt = beat.lit ? (beat.hit % 2 ? -1 : 1) * 4 : 0;
  const kingStyle = king
    ? {
        ...onSquare(square, orientation),
        translate: `${(left ? 1 : -1) * Math.abs(jolt) * 0.6 + beat.topple * (left ? 8 : -8)}% ${beat.topple * 4}%`,
        rotate: `${(left ? 1 : -1) * 84 * beat.topple * beat.topple}deg`,
        transformOrigin: left ? "80% 92%" : "20% 92%",
        filter: beat.lit ? "brightness(1.9) drop-shadow(0 0 4px #9c6cff)" : `brightness(${(1 - 0.45 * beat.dim) * (1 - 0.8 * beat.gone)})`,
        opacity: String(1 - beat.gone),
      }
    : undefined;
  return (
    <div class={`king-attack${him ? " on" : ""}`} aria-hidden="true" data-hit={beat.hit} data-from={from} data-start={startAt}>
      <BoardEffects items={items} orientation={orientation} class="pw-fire-board ka-hits" />
      {king && (
        <span class={`ka-king cg-wrap ${king}`} style={kingStyle} data-square={square}>
          <piece class={`${king === "w" ? "white" : "black"} king`} />
        </span>
      )}
      {him && (
        <span class={`ka-boss${left ? "" : " flip"}`} style={{ left: sq(box.x), top: sq(box.y), width: sq(w), aspectRatio: `${ch.w} / ${ch.h}` }}>
          <SpriteAnim ch={ch} anim={ka.anim} since={startAt} sounds={kit.sounds} id={`attack-${seed}`} />
        </span>
      )}
      {hits.map((at, i) => {
        if (t < at || t >= at + 1000) return null;
        const p = hpSpot(i, col, row);
        return (
          <span key={i} class="ks-hp ka-hp" style={{ left: sq(col + 0.5 + p.x), top: sq(row + 0.5 + p.y) }}>
            −{hp[i]}
          </span>
        );
      })}
    </div>
  );
}
