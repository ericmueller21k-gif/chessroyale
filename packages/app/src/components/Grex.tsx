import { BOSS_POWERS } from "@chessroyale/core";
import { FIRE_BURN_MS } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import { CANDLE_SHOTS, candleMuzzle } from "../characters/grex.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BoardEffects, BossEffect, BossMoment, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, onSquare, stageSince, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * G-REX's fire on screen (the characters' sprites): the tiles in their stages on one canvas, each with a small
 * countdown (the crowd moves left before it burns: 3, 2, 1, and 0 as it burns), the sparkler, the Roman candle and its
 * fireballs (moments), the fireballs' shadows growing on the squares they'll hit (one canvas under the pieces), a piece
 * burning after the crowd's move (FireBurn), and the column of the candle's shots still up by the board's right edge
 * (CandlePips). His rules: packages/chess/src/bosses/grex.ts.
 */

/**
 * G-REX's sparkler: the banner, then his throw from the board's corner (his `ignite`, the sparkler leaving at its
 * `throw` cue), the sparkler's flight (`sparkFly`), the tile catching (`fireTile` ignite, then its first stage).
 */
export const SPARK = { flyAt: 1450, landAt: 1850 } as const;
/**
 * The Roman candle: the banner, then he drops onto the middle of the board (his `romanCandle`), slams the candle down
 * (the board jolts at its `slam` cue) and fires his 24 shots, sweeping it left and right: the first at its `launch` cue
 * and one at each `shot`, each a `candleShot` streaking off from the candle's top along its tilt, so they fan out, and
 * one more lit in the column of shots up by the board. Then he jumps off, and the first wave's shadows appear.
 */
const ROMAN = bossKit("Jefferson")?.ch.anims.romanCandle ?? null;
export const CANDLE = {
  rexAt: 1300,
  /** A shot's flight off the board. */
  shotMs: 700,
  /** He jumps off as his animation's last frame has held a moment. */
  exitAt: 1300 + (ROMAN ? animLength(ROMAN) : 5600) - 200,
  /** The board jolts as he slams the candle down. */
  slamAt: 1300 + ((ROMAN && cueAt(ROMAN, "slam")) ?? 1150),
  slamMs: 280,
} as const;
/** When each of the candle's 24 shots goes up (ms into his romanCandle): its `launch` and `shot` cues. */
export function candleShotTimes(kit: BossKit | null): number[] {
  const a = kit?.ch.anims[kit.anims.ultimate ?? ""];
  const out: number[] = [];
  let t = 0;
  for (const f of a?.frames ?? []) {
    if (f.cue === "launch" || f.cue === "shot") out.push(t);
    t += f.ms;
  }
  return out.length ? out.slice(0, CANDLE_SHOTS) : Array.from({ length: CANDLE_SHOTS }, (_, i) => 1500 + i * 130);
}
/** When the candle's moment shows the first wave's shadows (ms into the moment): as he jumps off. */
export const shadowsAt = () => CANDLE.exitAt;
/** A wave of fireballs: each falls from above onto its square (a little after the one before), lands, and is a fire tile. */
export const FIREBALL = { fallMs: 620, stagger: 170 } as const;
export const fireballLandAt = (i: number) => i * FIREBALL.stagger + FIREBALL.fallMs;
/** A piece burning after the crowd's move: the real piece comes off at the burn's `poof`. */
export const BURN = { goneAt: cueAt(EFFECTS.pieceBurn.ch.anims.burn!, "poof") ?? 520, ms: FIRE_BURN_MS } as const;

/** A fire tile's look as the board shows it: its stage's loop, after the step up into it (or its landing). */
function tileItem(t: { square: string; lit: number; stage: number }, since: number, landed: "spark" | "fireball" | null, now: number): BoardItem {
  const stage = Math.min(3, Math.max(1, t.stage));
  if (stage === 1) {
    // A sparkler's tile catches (ignite); a fireball's landing already ends on the first stage's look.
    if (landed === "spark") return { square: t.square, name: "fireTile", anim: "ignite", then: "stage1", since };
    return { square: t.square, name: "fireTile", anim: "stage1", since: since || t.lit };
  }
  const began = stageSince(`${t.square}:${t.lit}:${stage}`, now);
  return { square: t.square, name: "fireTile", anim: `spread${stage}`, then: `stage${stage}`, since: began, quiet: true };
}

/**
 * A fire tile's countdown: the crowd moves left before it burns out and destroys what's on it, this one included
 * (a singe: 3, more burn: 2, ablaze: 1; 0 as it burns, after the crowd's move on its last stage).
 */
export const fireCountdown = (stage: number, stages = BOSS_POWERS.fireStages) => Math.max(0, stages - Math.max(1, stage) + 1);

/**
 * The fireballs' shadows on the board as `now`: each square still to be hit at its size (grown as first seen at it),
 * the wave landing this turn's at the biggest until its fireball lands, and the squares just picked (the smallest)
 * once the moment that picked them is over (the candle's as he jumps off; a wave's as its last fireball lands).
 */
export function shadowItems(boss: Pick<BossView, "powers">, moments: readonly Moment[], now: number): BoardItem[] {
  const shadows = boss.powers?.shadows ?? [];
  const candle = moments.find((m) => m.kind === "candle");
  const wave = moments.find((m) => m.kind === "fireball");
  const fresh = candle ? candle.at + shadowsAt() : wave ? wave.at + fireballLandAt((wave.squares?.length ?? 1) - 1) + LAND_MS : 0;
  const item = (square: string, lands: number, stage: number): BoardItem => {
    const size = Math.min(3, Math.max(1, stage));
    return { square, name: "fireShadow", anim: `grow${size}`, then: `shadow${size}`, since: stageSince(`shadow:${square}:${lands}:${size}`, now), quiet: true };
  };
  const out = shadows.flatMap((sh) => (sh.stage <= 1 && now < fresh ? [] : [item(sh.square, sh.lands, sh.stage)]));
  // (This turn's wave: its shadows stay at their biggest until each fireball lands.)
  if (wave) (wave.squares ?? []).forEach((sq, i) => now < wave.at + fireballLandAt(i) && out.push(item(sq, boss.powers?.turn ?? 0, 3)));
  return out;
}

/**
 * After the crowd's move: a piece left on a tile ablaze burns up (`pieceBurn`, its kind's charred shape, over the
 * tile's burnOut), a tile under the king fizzles out (he's fireproof), and an empty one just burns out. One canvas over
 * the board, for BURN.ms from `since`.
 */
export function FireBurn({ burnt, since, now, orientation }: { burnt: readonly { square: string; piece?: string; fizzled?: boolean }[]; since: number; now: number; orientation: "white" | "black" }) {
  if (!burnt.length || now < since || now >= since + BURN.ms) return null;
  const items: BoardItem[] = burnt.flatMap((b): BoardItem[] =>
    b.fizzled
      ? [{ square: b.square, name: "fireTile", anim: "fizzle", since }]
      : [{ square: b.square, name: "fireTile", anim: "burnOut", since, quiet: !!b.piece }, ...(b.piece ? [{ square: b.square, name: "pieceBurn" as const, anim: b.piece, since }] : [])],
  );
  return (
    <div class="power-board pw-burns" aria-hidden="true">
      <BoardEffects items={items} orientation={orientation} class="pw-fire-board" />
      {burnt.map((b) => (
        <span key={`burn-${b.square}`} class={`pw-burn${b.fizzled ? " fizzled" : b.piece ? "" : " out"}`} style={onSquare(b.square, orientation)} data-square={b.square}>
          {/* (The countdown reaches 0 as it burns.) */}
          <b class="pw-count">0</b>
        </span>
      ))}
    </div>
  );
}

/**
 * One of the Roman candle's 24 shots (`candleShot`): from the candle's top (where it is in his frame, his frame being
 * .pm-rex's box on the board) off along its tilt, a few degrees either way, so the volley fans out across the sky.
 */
export function candleShotPath(i: number): { left: number; top: number; deg: number; reach: number } {
  const { at, deg } = candleMuzzle(i);
  // (.pm-pogo.pm-rex: left 29%, top 14%, 42% of the board wide, 100 x 122 frame pixels.)
  const left = 29 + (at[0] / 100) * 42;
  const top = 14 + (at[1] / 122) * 42 * (122 / 100);
  const jitter = ((i * 37) % 11) - 5;
  // (Its reach in its own box's size, two squares: five to seven squares.)
  return { left, top, deg: deg * 1.25 + jitter, reach: 260 + ((i * 53) % 4) * 30 };
}
function CandleShot({ i, since }: { i: number; since: number }) {
  const { left, top, deg, reach } = candleShotPath(i);
  const a = (deg * Math.PI) / 180;
  // (Its box is two squares; its rocket's head is near the top middle, 30% down.)
  const style: Record<string, string> = {
    left: `${left - 12.5}%`,
    top: `${top - 7.5}%`,
    rotate: `${deg}deg`,
    "--sx": `${Math.sin(a) * reach}%`,
    "--sy": `${-Math.cos(a) * reach}%`,
    animationDuration: `${CANDLE.shotMs}ms`,
    animationDelay: `${since - Date.now()}ms`,
  };
  return (
    <span class="pw-shot" style={style}>
      <BossEffect name="candleShot" since={since} id={`shot-${i}`} />
    </span>
  );
}

/** A fireball (`fireballFall`) falling from above the board onto its square, moved with a transform. */
function Fireball({ square, orientation, since }: { square: string; orientation: "white" | "black"; since: number }) {
  const { x, y } = squareXY(square, orientation);
  const style: Record<string, string> = {
    left: `${(x - 50) / 8}%`,
    top: `${(y - 50) / 8}%`,
    "--fy": `${-(y + 120)}%`,
    animationDuration: `${FIREBALL.fallMs}ms`,
    animationDelay: `${since - Date.now()}ms`,
  };
  return (
    <span class="pw-fireball" style={style}>
      <BossEffect name="fireballFall" since={since} id={`fb-${square}`} />
    </span>
  );
}
const LAND_MS = animLength(EFFECTS.fireballFall.ch.anims.land!);
const FIZZLE_MS = animLength(EFFECTS.fireTile.ch.anims.fizzle!);

/**
 * The Roman candle's shots still up: the characters' column by the board's right edge (`candleShots`, `left<n>`), in
 * the gutter beside the board (never over it, its timer bar or the eval bar), from the moment he fires until the last
 * fireball lands.
 */
export function CandlePips({ left }: { left: number }) {
  const n = Math.max(0, Math.min(CANDLE_SHOTS, left));
  return (
    <div class="pw-pips" role="img" aria-label={`${n} fireballs to fall`} data-left={n}>
      <BossEffect name="candleShots" anim={`left${n}`} since={0} id="pips" />
    </div>
  );
}

function sparkMoment({ moment, t, orientation, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-spark">
      {t < 1500 && banner("SPARKLER!", moment.square ? `Fire on ${moment.square}` : undefined, "fire")}
      {cast("throw", SPARK.flyAt)}
      {moment.square && t >= SPARK.flyAt && t < SPARK.landAt && <Flight name="sparkFly" square={moment.square} orientation={orientation} since={moment.at + SPARK.flyAt} ms={SPARK.landAt - SPARK.flyAt} />}
    </div>
  );
}

function candleMoment({ boss, moment, now, t, kit, banner, anim: kitAnim }: MomentProps) {
  const anim = kitAnim();
  const times = candleShotTimes(kit).map((x) => moment.at + CANDLE.rexAt + x);
  const shots = times.filter((x) => now >= x).length;
  return (
    <div class="power-moment pm-candle">
      {t < 1500 && banner("ROMAN CANDLE!", `${CANDLE_SHOTS} shots up…`, "fire long")}
      {t >= CANDLE.rexAt && (
        <span class={`pm-pogo pm-rex${t >= CANDLE.exitAt ? " out" : ""}`}>
          {/* (His last frame, the candle in hand, holds as he jumps off.) */}
          {anim ? <BossMoment boss={boss.name} anim={anim} since={moment.at + CANDLE.rexAt} /> : <BossFace boss={boss} />}
        </span>
      )}
      {times.map((since, i) => (now >= since && now < since + CANDLE.shotMs ? <CandleShot key={i} i={i} since={since} /> : null))}
      {shots > 0 && <CandlePips left={shots} />}
    </div>
  );
}

function fireballMoment({ moment, now, orientation, cast }: MomentProps) {
  return (
    <div class="power-moment pm-fireball">
      {cast("", 0)}
      {(moment.squares ?? []).map((sq, i) => {
        const since = moment.at + i * FIREBALL.stagger;
        return now >= since && now < moment.at + fireballLandAt(i) ? <Fireball key={`fb-${sq}`} square={sq} orientation={orientation} since={since} /> : null;
      })}
      {/* Each lands on its square (its landing ends on the tile's first stage, which the board layer carries on); one
          on the crowd king's square fizzles out (he's fireproof: never a tile under him). */}
      <BoardEffects
        items={(moment.squares ?? []).flatMap((sq, i): BoardItem[] => {
          const land = moment.at + fireballLandAt(i);
          if (moment.fizzled?.includes(sq)) return now >= land && now < land + FIZZLE_MS ? [{ square: sq, name: "fireTile", anim: "fizzle", since: land }] : [];
          return now >= land && now < land + LAND_MS ? [{ square: sq, name: "fireballFall", anim: "land", since: land }] : [];
        })}
        orientation={orientation}
        class="pw-fire-board"
      />
    </div>
  );
}

export const GREX_UI = {
  id: "grex",
  ultimate: { name: "the Roman Candle" },
  moments: {
    spark: { order: 0, kit: "power", dock: "Sparkler!", appearAt: (m, square) => (m.square === square ? m.at + SPARK.landAt : undefined), view: sparkMoment },
    // (A fireball's landing ends on the tile's first stage: the tile carries on from there.)
    fireball: {
      order: 0,
      kit: "ultimateHit",
      dock: "Fireballs!",
      appearAt: (m, square) => (m.squares?.includes(square) ? m.at + fireballLandAt(m.squares.indexOf(square)) + LAND_MS : undefined),
      view: fireballMoment,
    },
    candle: { order: 2, kit: "ultimate", dock: "Roman candle!", view: candleMoment },
  },
  board: ({ boss, p, orientation, moments, now, appearAt }) => {
    // His fire tiles, each in its stage (a singe, more burn, ablaze), drawn as it lands: all on one canvas.
    const fire = p.fire ?? [];
    const tiles = fire.flatMap((t) => {
      const since = appearAt(t.square);
      if (now < since) return [];
      const landed = moments.some((m) => m.kind === "spark" && m.square === t.square) ? "spark" : moments.some((m) => m.kind === "fireball" && m.squares?.includes(t.square)) ? "fireball" : null;
      return [tileItem(t, since, landed, now)];
    });
    // The candle's pips: shots still to fall (during the candle's own moment, it shows them filling).
    const candleM = moments.find((m) => m.kind === "candle");
    const wave = moments.find((m) => m.kind === "fireball");
    const inAir = wave ? (wave.squares ?? []).filter((_, i) => now < wave.at + fireballLandAt(i)).length : 0;
    const pips = p.candle && !(candleM && now < candleM.at + candleM.ms) && (p.candle.left > 0 || inAir > 0) ? p.candle.left + inAir : null;
    // The fireballs' shadows: on a canvas of their own, under the pieces (a piece on the square stands on its shadow).
    const shadows = shadowItems(boss, moments, now);
    return {
      under: shadows.length > 0 && <BoardEffects items={shadows} orientation={orientation} class="pw-shadow-board" />,
      over: (
        <>
          {pips !== null && <CandlePips left={pips} />}
          {fire.length > 0 && <BoardEffects items={tiles} orientation={orientation} class="pw-fire-board" />}
          {/* (One marker a tile: what's on fire, at which stage, and its countdown: the crowd moves left before it burns.) */}
          {fire.map((t) =>
            now >= appearAt(t.square) ? (
              <span key={`fire-${t.square}-${t.lit}`} class={`pw-fire stage-${Math.min(3, t.stage)}`} style={onSquare(t.square, orientation)} data-square={t.square} data-stage={t.stage}>
                <b class="pw-count">{fireCountdown(t.stage)}</b>
              </span>
            ) : null,
          )}
          {/* (Markers for the shadows too: which squares are coming, how big.) */}
          {shadows.map((sh) => (
            <span key={`shadow-${sh.square}`} class={`pw-shadow size-${sh.anim!.slice(-1)}`} style={onSquare(sh.square, orientation)} data-square={sh.square} data-size={sh.anim!.slice(-1)} />
          ))}
        </>
      ),
    };
  },
} satisfies BossUi;
