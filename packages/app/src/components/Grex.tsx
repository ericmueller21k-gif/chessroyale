import { BOSS_POWERS } from "@chessroyale/core";
import { FIRE_BURN_MS, pieceAt } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt, type EffectName } from "../characters/power-art.ts";
import { CANDLE_SHOTS, candleMuzzle } from "../characters/grex.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BoardEffects, BossEffect, BossMoment, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Cast, Flight, PIECE_WORD, onSquare, stageSince, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";
import { CRITICAL } from "../speech.tsx";
import type { PieceDecor } from "../board/types.ts";

/**
 * Grex's fire on screen (the characters' sprites): the tiles in their stages on one canvas, each with a small
 * countdown (the crowd moves left before it burns: 3, 2, 1, and 0 as it burns), the sparkler, the Roman candle and its
 * fireballs (moments), the fireballs' shadows growing on the squares they'll hit (one canvas under the pieces), a piece
 * burning after the crowd's move (FireBurn), a piece the candle's fire charred (grexDecor, Eric, Nov 20), and the row of the
 * candle's shots still up in his boss card (CandlePips, the bar's prop slot: candleRow). His rules:
 * packages/chess/src/bosses/grex.ts.
 */

/**
 * Grex's sparkler: the banner, then his throw from the board's corner (his `ignite`, the sparkler leaving at its
 * `throw` cue), the sparkler's flight (`sparkFly`), the tile catching (`fireTile` ignite, then its first stage).
 */
export const SPARK = { flyAt: 1450, landAt: 1850 } as const;
/**
 * The Roman candle: the banner, then he drops onto the middle of the board (his `romanCandle`), slams the candle down
 * (the board jolts at its `slam` cue) and fires his 24 shots, sweeping it left and right: the first at its `launch` cue
 * and one at each `shot`, each a `candleShot` streaking off from the candle's top along its tilt, so they fan out, and
 * one more lit in the row of shots up in his boss card. Then he jumps off, and the first wave's shadows appear.
 */
const ROMAN = bossKit("Jefferson")?.ch.anims.romanCandle ?? null;
export const CANDLE = {
  rexAt: 1300,
  /** A shot's flight off the board. */
  shotMs: 700,
  /** He jumps off as his animation's last frame has held a moment. */
  get exitAt() {
    return 1300 + (ROMAN ? animLength(ROMAN) : 5600) - 200;
  },
  /** The board jolts as he slams the candle down. */
  get slamAt() {
    return 1300 + ((ROMAN && cueAt(ROMAN, "slam")) ?? 1150);
  },
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
export const BURN = {
  get goneAt() {
    return cueAt(EFFECTS.pieceBurn.ch.anims.burn!, "poof") ?? 520;
  },
  ms: FIRE_BURN_MS,
} as const;

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
 * A shadow growing on a square, a size a turn (1 to 3) until what casts it comes down on the crowd turn `lands`: grown
 * as first seen at its size. Grex's fireballs', and Alfil's Slam's pieces' (reused as is).
 */
export function fireShadowItem(square: string, lands: number, stage: number, now: number): BoardItem {
  const size = Math.min(3, Math.max(1, stage));
  return { square, name: "fireShadow", anim: `grow${size}`, then: `shadow${size}`, since: stageSince(`shadow:${square}:${lands}:${size}`, now), quiet: true };
}

/**
 * The fireballs' shadows on the board as `now`: each square still to be hit at its size (grown as first seen at it),
 * the wave landing this turn's at the biggest until its fireball lands, and the squares just picked (the smallest)
 * once the moment that picked them is over (the candle's as he jumps off; a wave's as its last fireball lands).
 */
export function shadowItems(boss: Pick<BossView, "powers">, moments: readonly Moment[], now: number): BoardItem[] {
  const shadows = boss.powers?.shadows ?? [];
  const candle = moments.find((m) => m.kind === "candle");
  const wave = moments.find((m) => m.kind === "fireball");
  const fresh = candle ? candle.at + shadowsAt() : wave ? wave.at + fireballLandAt((wave.squares?.length ?? 1) - 1) + LAND_MS() : 0;
  const item = (square: string, lands: number, stage: number) => fireShadowItem(square, lands, stage, now);
  const out = shadows.flatMap((sh) => (sh.stage <= 1 && now < fresh ? [] : [item(sh.square, sh.lands, sh.stage)]));
  // (This turn's wave: its shadows stay at their biggest until each fireball lands.)
  if (wave) (wave.squares ?? []).forEach((sq, i) => now < wave.at + fireballLandAt(i) && out.push(item(sq, boss.powers?.turn ?? 0, 3)));
  return out;
}

/**
 * After the crowd's move: a piece left on a tile ablaze burns up (`pieceBurn`, its kind's charred shape, over the
 * tile's burnOut), a tile under the king fizzles out (he's fireproof), and an empty one just burns out, as does one of the
 * candle's under a piece it only chars (the piece's charred look comes with its flames: grexDecor). One canvas over the
 * board, for BURN.ms from `since`.
 */
export function FireBurn({ burnt, since, now, orientation }: { burnt: readonly Burnt[]; since: number; now: number; orientation: "white" | "black" }) {
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
        <span key={`burn-${b.square}`} class={`pw-burn${b.fizzled ? " fizzled" : b.piece ? "" : b.charred ? " charred" : " out"}`} style={onSquare(b.square, orientation)} data-square={b.square}>
          {/* (The countdown reaches 0 as it burns.) */}
          <b class="pw-count">0</b>
        </span>
      ))}
    </div>
  );
}

type Burnt = { square: string; piece?: string; fizzled?: boolean; charred?: string; hits?: number };

/**
 * The dock's line for what the fire did after the crowd's move (one line on a phone: one or two pieces by name, more by how
 * many): pieces burnt; pieces the Roman candle only charred (Eric, Nov 20: "Charred! One more burns it", when one more does:
 * `toBurn`, candleHitsToBurn); both; or a tile that fizzled: under the king (fireproof), or under a piece whose loss would
 * leave a king in check (`fen`, the board after the fire, tells them apart: the review of Nov 20). Null: nothing to say (tiles
 * that just burnt out).
 */
export function fireLine(burnt: readonly Burnt[], fen?: string, toBurn: number = BOSS_POWERS.candleHitsToBurn): string | null {
  const names = (kinds: string[]) => (kinds.length > 2 ? `${kinds.length} pieces` : kinds.map((k) => PIECE_WORD[k] ?? "piece").join(" and "));
  const burning = burnt.filter((b) => b.piece).map((b) => b.piece!);
  const chars = burnt.filter((b) => b.charred);
  const charring = chars.map((b) => b.charred!);
  const cap = (x: string) => `${x.charAt(0).toUpperCase()}${x.slice(1)}`;
  if (burning.length && charring.length) return `${cap(names(burning))} burnt, ${charring.length > 1 ? `${charring.length}` : (PIECE_WORD[charring[0]!] ?? "piece")} charred`;
  if (burning.length) return `${cap(names(burning))} burnt!`;
  if (charring.length) return chars.every((b) => (b.hits ?? 1) + 1 >= toBurn) ? `Charred! One more burns ${charring.length > 1 ? "them" : "it"}` : `${cap(names(charring))} charred!`;
  const fizzled = burnt.filter((b) => b.fizzled);
  if (!fizzled.length) return null;
  // (No board to look at: the king's line, as before.)
  const shields = fen ? fizzled.filter((b) => pieceAt(fen, b.square)?.type !== "k") : [];
  return shields.length < fizzled.length ? "Your king is fireproof." : `Fizzled: ${shields.length > 1 ? "they shield" : "it shields"} a king`;
}

/**
 * The crowd's pieces the Roman candle's fire has charred (Eric, Nov 20), drawn as part of each piece (a board decor: the
 * `pw-charred` tone, styles.css), so it slides with it. While this crowd move's fire shows (`burnt`, from `since`), until its
 * flare (BURN.goneAt): a charred piece burning keeps the look until it comes off the board, and one the fire chars for the first
 * time doesn't have it yet (it takes it as its tile's flames die: the review of Nov 20 caught it charred under fresh flames).
 * Undefined: none to draw.
 */
export function grexDecor(boss: Pick<BossView, "id" | "crowdSide" | "powers"> | null | undefined, burnt: readonly Burnt[] = [], since = 0, now = 0): PieceDecor | undefined {
  const p = boss?.id === "grex" ? boss.powers : null;
  if (!p) return undefined;
  const early = now < since + BURN.goneAt;
  const fresh = early ? burnt.filter((b) => b.charred && (b.hits ?? 1) <= 1).map((b) => b.square) : [];
  const marks = (p.charred ?? []).filter((m) => !fresh.includes(m.square)).map((m) => `${m.square}${m.piece}`);
  if (early) for (const b of burnt) if (b.piece && (b.hits ?? 0) > 1) marks.push(`${b.square}${b.piece}`);
  if (!marks.length) return undefined;
  const side = boss!.crowdSide;
  return {
    key: `char:${marks.join(",")}`,
    of: (square, code) => (code[0] === side && marks.some((m) => m.slice(0, 2) === square && m[2] === code[1]) ? { cls: "pw-charred", kids: null } : null),
  };
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
let warmed = false;
/**
 * His Roman candle's frames drawn ahead, a slice each animation frame, as his battle starts: his own, a shot's rocket,
 * the column of shots still up and the fireballs, so the launch doesn't stall a slow phone the first time it shows
 * (Oct 14: drawing them as it went up took about 650 ms of a phone's time slowed 4x; .claude/LESSONS.md, "A stall the
 * first time an effect shows").
 */
export function prewarmGrex(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const all = (fx: EffectName) => Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const));
  prewarmSprite(kit.ch, kit.ch.anims[kit.anims.ultimate ?? ""]?.frames ?? []);
  for (const fx of ["candleShot", "candleShots", "fireballFall"] as const) prewarm(fx, all(fx));
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
const LAND_MS = () => animLength(EFFECTS.fireballFall.ch.anims.land!);
const FIZZLE_MS = () => animLength(EFFECTS.fireTile.ch.anims.fizzle!);

/**
 * The Roman candle's shots still up: the characters' row (`candleShots`, `left<n>`) in his boss card's free room under
 * "N moves left" (BossUi.barProp, as Hollow's bulbs and Timber's workshop; Eric, Nov 11: the column by the board's right
 * edge was cut off by a phone's screen), from the moment he fires until the last fireball lands.
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
      {banner("SPARKLER!", moment.square ? `Fire on ${moment.square}` : undefined, "fire", SPARK.flyAt)}
      {cast("throw", SPARK.flyAt)}
      {moment.square && t >= SPARK.flyAt && t < SPARK.landAt && <Flight name="sparkFly" square={moment.square} orientation={orientation} since={moment.at + SPARK.flyAt} ms={SPARK.landAt - SPARK.flyAt} />}
    </div>
  );
}

function candleMoment({ boss, moment, now, t, kit, banner, anim: kitAnim }: MomentProps) {
  const anim = kitAnim();
  const times = candleShotTimes(kit).map((x) => moment.at + CANDLE.rexAt + x);
  return (
    <div class="power-moment pm-candle">
      {banner("ROMAN CANDLE!", `${CANDLE_SHOTS} shots up…`, "fire long")}
      {t >= CANDLE.rexAt && (
        <span class={`pm-pogo pm-rex${t >= CANDLE.exitAt ? " out" : ""}`}>
          {/* (His last frame, the candle in hand, holds as he jumps off.) */}
          {anim ? <BossMoment boss={boss.name} anim={anim} since={moment.at + CANDLE.rexAt} /> : <BossFace boss={boss} />}
        </span>
      )}
      {times.map((since, i) => (now >= since && now < since + CANDLE.shotMs ? <CandleShot key={i} i={i} since={since} /> : null))}
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
          if (moment.fizzled?.includes(sq)) return now >= land && now < land + FIZZLE_MS() ? [{ square: sq, name: "fireTile", anim: "fizzle", since: land }] : [];
          return now >= land && now < land + LAND_MS() ? [{ square: sq, name: "fireballFall", anim: "land", since: land }] : [];
        })}
        orientation={orientation}
        class="pw-fire-board"
      />
    </div>
  );
}

/**
 * Grex laughs it off (Eric, Oct 11): the first time in a match one of his own pieces sits on fire from his Roman
 * candle (his pieces never burn), one of these, picked from the battle's seed (the moment's `pick`). Once a match.
 */
export const FIREPROOF_LINES = ["Ha! My pieces don't burn. Perks!", "Fireproof! Did I forget to say?", "Hot? Not for my team. Ha!", "Mine are fire-rated. Yours? Ha!"];
export const fireproofLine = (pick: number | undefined) => FIREPROOF_LINES[(pick ?? 0) % FIREPROOF_LINES.length]!;

/** His smug look by the board's corner as he says it, and a cool glint over his piece standing in the flames. */
function fireproofMoment({ boss, moment, now, t, orientation }: MomentProps) {
  return (
    <div class="power-moment pm-fireproof">
      <Cast boss={boss.name} anim="smug" since={moment.at} now={now} runKey={`${moment.key}:smug`} />
      {moment.square && t < 1800 && <span class="pw-fireproof" style={{ ...onSquare(moment.square, orientation), animationDelay: `${-t}ms` }} data-square={moment.square} />}
    </div>
  );
}

/**
 * The shots still up, in his boss card (BossUi.barProp): during the candle's own moment the row fills as he fires; after it,
 * the shots still to fall, counting those of a wave still in the air until each lands. Through his turn the bar draws it every
 * frame (BossBarExtra), so a shot lights or goes out as it's seen on the board.
 */
function candleRow({ boss, moments }: { boss: BossView; moments: () => Moment[] }) {
  const p = boss.powers;
  if (!p) return null;
  const list = moments();
  const now = Date.now();
  const candleM = list.find((m) => m.kind === "candle");
  if (candleM && now < candleM.at + candleM.ms) {
    const shots = candleShotTimes(bossKit(boss.name)).filter((x) => now >= candleM.at + CANDLE.rexAt + x).length;
    return shots > 0 ? <CandlePips left={shots} /> : null;
  }
  if (!p.candle) return null;
  const wave = list.find((m) => m.kind === "fireball");
  const inAir = wave ? (wave.squares ?? []).filter((_, i) => now < wave.at + fireballLandAt(i)).length : 0;
  return p.candle.left > 0 || inAir > 0 ? <CandlePips left={p.candle.left + inAir} /> : null;
}

export const GREX_UI = {
  id: "grex",
  barProp: candleRow,
  ultimate: { name: "the Roman Candle" },
  moments: {
    spark: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + SPARK.landAt : undefined), view: sparkMoment },
    // (A fireball's landing ends on the tile's first stage: the tile carries on from there.)
    fireball: {
      order: 0,
      kit: "ultimateHit",
      // (No banner: where the fire lands, in the dock, one line on a phone: two squares by name, more by how many; one
      // on your king's square fizzles out.)
      dock: (m) => {
        const lit = (m.squares ?? []).filter((sq) => !m.fizzled?.includes(sq));
        return lit.length > 2 ? `Fire on ${lit.length} squares` : lit.length ? `Fire on ${lit.join(" and ")}` : "Your king is fireproof.";
      },
      appearAt: (m, square) => (m.squares?.includes(square) ? m.at + fireballLandAt(m.squares.indexOf(square)) + LAND_MS() : undefined),
      view: fireballMoment,
    },
    candle: { order: 2, kit: "ultimate", view: candleMoment },
    // (Once a match, so it isn't lost in a queue: it cuts in like an ultimate's line.)
    fireproof: { order: 4, kit: "ultimateHit", dock: () => "Fire burns only your pieces.", line: (_kit, m) => fireproofLine(m.pick), lineAt: 150, priority: () => CRITICAL, view: fireproofMoment },
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
    // The fireballs' shadows: on a canvas of their own, under the pieces (a piece on the square stands on its shadow).
    const shadows = shadowItems(boss, moments, now);
    return {
      under: shadows.length > 0 && <BoardEffects items={shadows} orientation={orientation} class="pw-shadow-board" />,
      over: (
        <>
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
