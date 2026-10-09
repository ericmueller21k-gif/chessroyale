import type { ComponentChildren } from "preact";
import { BOSS_POWERS, type PowerEventKind } from "@chessroyale/core";
import { FIRE_BURN_MS, inCheck, powerFxMs, powerMomentMs, pieceAt, sideToMove } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt, darkItem } from "../characters/power-art.ts";
import { CANDLE_SHOTS, candleMuzzle } from "../characters/grex.ts";
import { HOLLOW_CAST_FROM } from "../characters/hollow.ts";
import { pickLine } from "../characters/boss-beats.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BoardEffects, BossEffect, BossMoment, SpriteAnim, type BoardItem } from "./BossEffect.tsx";
import { GodKingPortrait, squareXY } from "./GodKing.tsx";

/**
 * Boss powers on screen: what every player sees, from the battle's shared state (NetBoss.powers), so online everyone
 * sees the same ice, the same pie and the same moment at the same time.
 *
 * - The board layer (PowerBoard): ice over a frozen piece (in the blizzard, over every crowd piece but the one still
 *   free to move) and the pie on its square. Drawn over the pieces, never taking a tap.
 * - The moments (momentsOf / PowerMoment): as the turn passes to the crowd, after the boss's move shows, each power
 *   that came with it plays in turn, in the God King's banner style (the boss on the left, the moment in the middle,
 *   the God King on the right), with its board effect. The crowd's clock starts after them.
 * - The rage meter (RageMeter) in the boss bar: it fills over the battle (faster as the boss loses material or the
 *   crowd gets ahead), glows as it nears full, flashes for the one-turn warning, and is gone once the ultimate is spent.
 * - G-REX's fire (the characters' sprites): the tiles in their stages on one canvas (PowerBoard), each with a small
 *   countdown (the crowd moves left before it burns: 3, 2, 1, and 0 as it burns), the sparkler, the Roman candle and
 *   its fireballs (moments), the fireballs' shadows growing on the squares they'll hit (one canvas under the pieces),
 *   a piece burning after the crowd's move (FireBurn), and the column of the candle's shots still up by the board's
 *   right edge (CandlePips).
 */

/** One power's moment on screen: when it starts (ms, wall clock) and how long it takes. */
export interface Moment {
  kind: PowerEventKind;
  key: string;
  at: number;
  ms: number;
  square?: string;
  /** A wave of fireballs: their squares, in the order they land; those that fizzled (the crowd's king stood there). */
  squares?: string[];
  fizzled?: string[];
  /** Hollow's first cover of the dark. */
  first?: true;
}

const ORDER: Record<PowerEventKind, number> = { freeze: 0, pie: 0, spark: 0, fireball: 0, dark: 0, warn: 1, blizzard: 2, candle: 2, funhouse: 3 };

/**
 * The moments a boss screen plays, ending at `until` (the screen's end: the crowd's clock starts then), one after
 * another. The funhouse has a screen of its own (after the move he plays for the crowd); the rest come after the boss's
 * move, as the turn passes to the crowd.
 */
export function momentsOf(boss: BossView, until: number): Moment[] {
  const p = boss.powers;
  if (!p || !until || !p.events.length) return [];
  const funhouse = !!p.funhouse && p.funhouse.turn === boss.crowdMoves && p.events.some((e) => e.kind === "funhouse");
  const list = p.events.filter((e) => (e.kind === "funhouse") === funhouse).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  let t = until - powerMomentMs(list);
  return list.map((e) => {
    const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t, ms: powerFxMs(e), ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}), ...(e.fizzled ? { fizzled: e.fizzled } : {}), ...(e.first ? { first: true as const } : {}) };
    t += m.ms;
    return m;
  });
}

/** The moment playing at `now`, if any. */
export const momentAt = (moments: readonly Moment[], now: number) => moments.find((m) => now >= m.at && now < m.at + m.ms) ?? null;

/** The board as the crowd sees it: from its own side, or (after Boingo's funhouse) flipped for a couple of turns. */
export function crowdOrientation(boss: Pick<BossView, "powers"> | null | undefined, side: "w" | "b"): "white" | "black" {
  const s = boss?.powers?.flipped ? (side === "w" ? "b" : "w") : side;
  return s === "w" ? "white" : "black";
}

// ---------------- The funhouse's beats (ms into its moment) ----------------

/**
 * The banner first; then Boingo drops onto the board (his kit's `funhouse`: he lands, springs into a spin, and the
 * board spins with him at its `flip` cue), his line, the move he plays for the crowd, and he bounces off.
 */
export const FUNHOUSE = { clownAt: 1300, flipMs: 700, lineAt: 2700, moveAt: 3500, exitAt: 4500 } as const;

/** When the board starts its spin (ms into the moment): on the funhouse animation's `flip` cue. */
export function funhouseFlipAt(kit: BossKit | null): number {
  const a = kit?.ch.anims.funhouse;
  return FUNHOUSE.clownAt + ((a && cueAt(a, "flip")) ?? 620);
}

/**
 * In the funhouse's moment: whether the board spins (a half turn in its own plane, pieces upside down for a moment),
 * whether it shows flipped yet (the orientation swaps as the spin ends, with nothing transformed, so the board's
 * squares are measured true), and whether the move has been played.
 */
export function funhouseBeat(m: Moment | null, now: number, flipAt: number = funhouseFlipAt(null)): { flipped: boolean; flipping: boolean; played: boolean } | null {
  if (!m || m.kind !== "funhouse") return null;
  const t = now - m.at;
  const end = flipAt + FUNHOUSE.flipMs;
  return { flipped: t >= end, flipping: t >= flipAt && t < end, played: t >= FUNHOUSE.moveAt };
}

// ---------------- The board layer ----------------

/** When a square's ice, pie or fire appears during a moment (ms, wall clock); 0: it's simply there. */
function appearAt(square: string, moments: readonly Moment[], orientation: "white" | "black"): number {
  for (const m of moments) {
    if (m.kind === "freeze" && m.square === square) return m.at + FREEZE.iceAt;
    if (m.kind === "pie" && m.square === square) return m.at + PIE.landAt;
    if (m.kind === "spark" && m.square === square) return m.at + SPARK.landAt;
    if (m.kind === "dark" && m.square === square) return m.at + DARK.landAt;
    // (A fireball's landing ends on the tile's first stage: the tile carries on from there.)
    if (m.kind === "fireball" && m.squares?.includes(square)) return m.at + fireballLandAt(m.squares.indexOf(square)) + LAND_MS;
    // The blizzard's sweep crosses the board left to right; each piece ices over as it passes.
    if (m.kind === "blizzard") return m.at + BLIZZARD.sweepAt + (squareXY(square, orientation).x / 800) * BLIZZARD.sweepMs;
  }
  return 0;
}

/** A freeze's beats: the banner, then (once it has gone) his cast, the ice bolt to the piece, the ice forming. */
export const FREEZE = { boltAt: 1500, iceAt: 1760 } as const;
/** The pie's beats: the banner, then his throw, the pie's flight from his side, the splat. */
export const PIE = { flyAt: 1450, landAt: 1800 } as const;
/** The blizzard's beats: the banner, then the storm bursts from his cane and sweeps the board, then the God King's line. */
export const BLIZZARD = { sweepAt: 1300, sweepMs: animLength(EFFECTS.blizzardSweep.ch.anims.sweep!), lineAt: 2800 } as const;
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
const ROMAN = bossKit("G-REX")?.ch.anims.romanCandle ?? null;
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
/**
 * Hollow's cover of the dark: the banner, then (as it goes) his cast by the board's corner (`darkCast`, the darkness
 * leaving the void in his chest at its `cast` cue), the darkness pouring onto the square (`darkPour`), and the square
 * going dark (`darkSquare` gather, then dark).
 */
export const DARK = { pourAt: 1300, landAt: 1680 } as const;
/** Where Hollow casts from in a moment by the board's corner (% of the board): a box his frame's shape. */
export const HOLLOW_CASTER = { left: -9, top: -27, width: 30 } as const;
/** The void in his chest as he casts, on the board (%), where the darkness leaves from. */
export function hollowCastFrom(kit: BossKit | null): { x: number; y: number } {
  const w = kit?.ch.w ?? 104;
  const h = kit?.ch.h ?? 102;
  return { x: HOLLOW_CASTER.left + (HOLLOW_CAST_FROM[0] / w) * HOLLOW_CASTER.width, y: HOLLOW_CASTER.top + (HOLLOW_CAST_FROM[1] / h) * HOLLOW_CASTER.width * (h / w) };
}
const CLEAR_MS = animLength(EFFECTS.darkSquare.ch.anims.clear!);
/** A wave of fireballs: each falls from above onto its square (a little after the one before), lands, and is a fire tile. */
export const FIREBALL = { fallMs: 620, stagger: 170 } as const;
export const fireballLandAt = (i: number) => i * FIREBALL.stagger + FIREBALL.fallMs;
/** A piece burning after the crowd's move: the real piece comes off at the burn's `poof`. */
export const BURN = { goneAt: cueAt(EFFECTS.pieceBurn.ch.anims.burn!, "poof") ?? 520, ms: FIRE_BURN_MS } as const;

/**
 * When each fire tile's current stage began on this device (the first time it was seen at it): the step up (spread2,
 * spread3) plays from then. A screen drawn again carries on; it doesn't start over.
 */
const stageSeen = new Map<string, number>();
function stageSince(key: string, now: number): number {
  let t = stageSeen.get(key);
  if (t === undefined) {
    t = now;
    stageSeen.set(key, t);
    if (stageSeen.size > 200) stageSeen.delete(stageSeen.keys().next().value!);
  }
  return t;
}

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

const at = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { left: `${(x - 50) / 8}%`, top: `${(y - 50) / 8}%` };
};
/** A square's column and row on chessground's own board (eighths of --cg-size: exactly on it at any size). */
const onSquare = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { "--sq-x": String((x - 50) / 100), "--sq-y": String((y - 50) / 100) };
};

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
 * Ice over frozen pieces (the characters' iceOverlay: it forms, then shimmers while it lasts) and the pie on its square
 * (pieSplat: the splat, then the pie), over the board, under any banner; never takes a tap.
 */
export function PowerBoard({ boss, orientation, moments = [], now = Date.now(), fen }: { boss: BossView; orientation: "white" | "black"; moments?: readonly Moment[]; now?: number; fen?: string }) {
  const p = boss.powers;
  if (!p) return null;
  const board = fen ?? boss.board.fen;
  const iced = p.iced.filter((sq) => pieceAt(board, sq)?.color === boss.crowdSide);
  const pie = p.pie?.square;
  const blizzard = moments.some((m) => m.kind === "blizzard");
  // G-REX's fire tiles, each in its stage (a singe, more burn, ablaze), drawn as it lands: all on one canvas.
  const fire = p.fire ?? [];
  const tiles = fire.flatMap((t) => {
    const since = appearAt(t.square, moments, orientation);
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
  // Hollow's dark: each covered square hides its piece (forming as his cast lands, thinning on its last turn), and one
  // that has just cleared lifts; check still shows on a king in the dark.
  const darkNow = p.dark ?? [];
  const dark: { square: string; state: "new" | "dark" | "thin" | "clear"; since: number }[] = [
    ...darkNow.flatMap((d) => {
      const since = appearAt(d.square, moments, orientation);
      if (now < since) return [];
      return [{ square: d.square, state: since ? ("new" as const) : d.until <= p.turn ? ("thin" as const) : ("dark" as const), since }];
    }),
    ...(p.cleared ?? []).flatMap((sq) => {
      const since = stageSince(`clear:${boss.id}:${sq}:${p.turn}`, now);
      return now < since + CLEAR_MS ? [{ square: sq, state: "clear" as const, since }] : [];
    }),
  ];
  const checked = darkNow.length && inCheck(board) ? kingOn(board, sideToMove(board)) : null;
  return (
    <>
      {shadows.length > 0 && <BoardEffects items={shadows} orientation={orientation} class="pw-shadow-board" />}
      <div class="power-board" aria-hidden="true">
      {dark.length > 0 && <BoardEffects items={dark.map((d) => darkItem(d.square, d.state, d.since))} orientation={orientation} class="pw-fire-board pw-dark-board" />}
      {dark.map((d) => (
        <span key={`dark-${d.square}`} class={`pw-dark ${d.state}`} style={onSquare(d.square, orientation)} data-square={d.square} data-state={d.state} />
      ))}
      {checked && darkNow.some((d) => d.square === checked) && <span class="pw-dark-check" style={onSquare(checked, orientation)} data-square={checked} />}
      {pips !== null && <CandlePips left={pips} />}
      {fire.length > 0 && <BoardEffects items={tiles} orientation={orientation} class="pw-fire-board" />}
      {/* (One marker a tile: what's on fire, at which stage, and its countdown: the crowd moves left before it burns.) */}
      {fire.map((t) =>
        now >= appearAt(t.square, moments, orientation) ? (
          <span key={`fire-${t.square}-${t.lit}`} class={`pw-fire stage-${Math.min(3, t.stage)}`} style={onSquare(t.square, orientation)} data-square={t.square} data-stage={t.stage}>
            <b class="pw-count">{fireCountdown(t.stage)}</b>
          </span>
        ) : null,
      )}
      {/* (Markers for the shadows too: which squares are coming, how big.) */}
      {shadows.map((sh) => (
        <span key={`shadow-${sh.square}`} class={`pw-shadow size-${sh.anim!.slice(-1)}`} style={onSquare(sh.square, orientation)} data-square={sh.square} data-size={sh.anim!.slice(-1)} />
      ))}
      {pie && now >= appearAt(pie, moments, orientation) && (
        <span key={`pie-${pie}`} class="pw-pie" style={at(pie, orientation)}>
          <BossEffect name="pieSplat" since={appearAt(pie, moments, orientation)} id={pie} />
        </span>
      )}
      {iced.map((sq) => {
        const t = appearAt(sq, moments, orientation);
        if (now < t) return null;
        const fx = EFFECTS.iceOverlay;
        return (
          <span key={`ice-${sq}`} class="pw-ice" style={at(sq, orientation)}>
            {/* (In the blizzard a dozen pieces ice over at once: the sweep's wind is their sound, not a dozen crackles.) */}
            <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={blizzard ? {} : fx.sounds} id={sq} />
          </span>
        );
      })}
      </div>
    </>
  );
}

// ---------------- The moments ----------------

const PIECE_WORD: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const ULT_NAME: Record<string, string> = { blizzard: "the Blizzard", funhouse: "the Funhouse", candle: "the Roman Candle", lightsout: "Lights Out" };

/** The square a side's king stands on. */
function kingOn(fen: string, side: "w" | "b"): string | null {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const pc = pieceAt(fen, `${f}${r}`);
    if (pc?.type === "k" && pc.color === side) return `${f}${r}`;
  }
  return null;
}

/** A small, stable hash, for picking a line the same everywhere. */
const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Which of the kit's moments a power's moment is (its animation and lines: characters/power-art.ts). */
const KIT_MOMENT: Record<PowerEventKind, "power" | "ultimateWarn" | "ultimate" | "ultimateHit"> = {
  freeze: "power",
  pie: "power",
  spark: "power",
  fireball: "ultimateHit",
  warn: "ultimateWarn",
  blizzard: "ultimate",
  funhouse: "ultimate",
  candle: "ultimate",
  dark: "power",
};

/**
 * The boss's line for a power's moment (its kit's), the same on every screen; null without one. Hollow's first cover
 * of the dark always has his first-cover line; later ones a taunt now and then (his kit's chance).
 */
export function powerLine(kit: BossKit | null, m: Pick<Moment, "kind" | "key" | "first">): string | null {
  if (m.kind === "dark") return m.first ? (kit?.lines.darkFirst?.[0] ?? null) : kit ? pickLine(kit, "power", m.key) : null;
  const lines = (kit?.lines as Partial<Record<string, readonly string[]>> | undefined)?.[KIT_MOMENT[m.kind]];
  return lines?.length ? lines[hash(m.key) % lines.length]! : null;
}

/** Boingo's line in his funhouse (his kit's, if it has some; these otherwise). */
export const FUNHOUSE_LINES = ["Let me get that for you!", "Welcome to the funhouse!", "Your move? Mine now!", "Honk! I'll drive."];
export function funhouseLine(kit: BossKit | null, key: string): string {
  return powerLine(kit, { kind: "funhouse", key }) ?? FUNHOUSE_LINES[hash(key) % FUNHOUSE_LINES.length]!;
}

/** The boss's animation for a power's moment, from its kit (e.g. freezeCast, pieThrow, check, blizzard, funhouse). */
const kitAnim = (kit: BossKit | null, kind: PowerEventKind) => {
  const name = kit?.anims[KIT_MOMENT[kind]];
  return name && kit!.ch.anims[name] ? name : null;
};

/**
 * The moment playing now, over the board: its banner (boss left, moment middle, God King right), the boss stepping up
 * to the board's corner to cast (its kit's moment, timed so its hit lands on the effect), and its effect. The ice and
 * the pie themselves are the board layer's (PowerBoard), timed to land with the effect.
 */
export function PowerMoment({ boss, moment, now, orientation, side }: { boss: BossView; moment: Moment | null; now: number; orientation: "white" | "black"; side: "w" | "b" }) {
  if (!moment) return null;
  const t = now - moment.at;
  const kit = bossKit(boss.name);
  const banner = (text: string, sub?: string, tone = "") => <PowerBanner key={moment.key} boss={boss} side={side} text={text} sub={sub} tone={tone} />;
  /** The boss casting by the board's top-left corner, its animation's `hit` cue landing at `hitAt` (ms into the moment). */
  const cast = (hit: string, hitAt: number) => {
    const anim = kitAnim(kit, moment.kind);
    if (!anim) return null;
    const a = kit!.ch.anims[anim]!;
    const since = moment.at + hitAt - (cueAt(a, hit) ?? 0);
    if (now < since) return null;
    return (
      <span class="pm-caster">
        <BossMoment boss={boss.name} anim={anim} since={since} then="idle" />
      </span>
    );
  };
  switch (moment.kind) {
    case "freeze": {
      const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
      return (
        <div class="power-moment pm-freeze">
          {t < 1500 && banner("FREEZE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen` : undefined, "cold")}
          {cast("freeze", FREEZE.boltAt)}
          {moment.square && t >= FREEZE.boltAt && t < FREEZE.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + FREEZE.boltAt} ms={FREEZE.iceAt - FREEZE.boltAt} aim />}
          {moment.square && t >= FREEZE.iceAt - 60 && t < FREEZE.iceAt + 900 && <span class="pw-frost" style={{ ...at(moment.square, orientation), animationDelay: `${FREEZE.iceAt - 60 - t}ms` }} />}
        </div>
      );
    }
    case "pie":
      return (
        <div class="power-moment pm-pie">
          {t < 1500 && banner("PIE!", moment.square ? `Splat on ${moment.square}` : undefined)}
          {cast("throw", PIE.flyAt)}
          {moment.square && t >= PIE.flyAt && t < PIE.landAt && <Flight name="pieFly" square={moment.square} orientation={orientation} since={moment.at + PIE.flyAt} ms={PIE.landAt - PIE.flyAt} />}
        </div>
      );
    case "warn": {
      const ult = boss.powers?.ultimate ?? "";
      return (
        <div class="power-moment pm-warn">
          {t < 1600 && banner("RAGE!", `Next turn: ${ULT_NAME[ult] ?? "its ultimate"}`, "rage")}
          {cast("", 0)}
        </div>
      );
    }
    case "blizzard":
      return (
        <div class="power-moment pm-blizzard">
          {t < 1500 && banner("BLIZZARD!", undefined, "cold")}
          {cast("blizzard", BLIZZARD.sweepAt)}
          {t >= BLIZZARD.sweepAt && t < BLIZZARD.sweepAt + BLIZZARD.sweepMs && (
            <span class="pw-clip">
              <span class="pw-sweep">
                <BossEffect name="blizzardSweep" since={moment.at + BLIZZARD.sweepAt} />
              </span>
            </span>
          )}
        </div>
      );
    case "spark":
      return (
        <div class="power-moment pm-spark">
          {t < 1500 && banner("SPARKLER!", moment.square ? `Fire on ${moment.square}` : undefined, "fire")}
          {cast("throw", SPARK.flyAt)}
          {moment.square && t >= SPARK.flyAt && t < SPARK.landAt && <Flight name="sparkFly" square={moment.square} orientation={orientation} since={moment.at + SPARK.flyAt} ms={SPARK.landAt - SPARK.flyAt} />}
        </div>
      );
    case "candle": {
      const anim = kitAnim(kit, "candle");
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
    case "dark": {
      const cast = kit?.ch.anims.darkCast;
      const castSince = moment.at + DARK.pourAt - ((cast && cueAt(cast, "cast")) ?? 0);
      const fromPt = hollowCastFrom(kit);
      const line = powerLine(kit, moment);
      return (
        <div class="power-moment pm-dark">
          {t < 1250 && banner("DARKNESS!", moment.square ? `Dark on ${moment.square}` : undefined, "dark")}
          {cast && now >= castSince && (
            <span class="pm-caster pm-hollow" style={{ aspectRatio: `${kit!.ch.w} / ${kit!.ch.h}` }}>
              {/* (His bulbs out as he casts: the last went out with his move.) */}
              <BossMoment boss={boss.name} anim="darkCast" since={castSince} then="idle" look="bulbs0" />
            </span>
          )}
          {moment.square && t >= DARK.pourAt && t < DARK.landAt && <Flight name="darkPour" square={moment.square} orientation={orientation} since={moment.at + DARK.pourAt} ms={DARK.landAt - DARK.pourAt} aim from={fromPt} />}
          {/* His words in his pixel text box as the darkness lands: his first cover's always, a taunt now and then. */}
          {line && t >= DARK.pourAt && (
            <div class="pm-line" role="status" aria-label={line}>
              {line.slice(0, Math.min(line.length, Math.floor((t - DARK.pourAt) / 28) + 1))}
            </div>
          )}
        </div>
      );
    }
    case "fireball":
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
    case "funhouse": {
      const line = funhouseLine(kit, moment.key);
      return (
        <div class="power-moment pm-funhouse">
          {t < 1500 && banner("FUNHOUSE!", undefined, "fun")}
          {t >= FUNHOUSE.clownAt && (
            <span class={`pm-pogo${t >= FUNHOUSE.exitAt ? " out" : ""}`}>
              {kitAnim(kit, "funhouse") ? <BossMoment boss={boss.name} anim={kitAnim(kit, "funhouse")!} since={moment.at + FUNHOUSE.clownAt} then="idle" /> : <BossFace boss={boss} />}
            </span>
          )}
          {t >= FUNHOUSE.lineAt && t < FUNHOUSE.exitAt && (
            <div class="pm-line" role="status" aria-label={line}>
              {line.slice(0, Math.min(line.length, Math.floor((t - FUNHOUSE.lineAt) / 28) + 1))}
            </div>
          )}
        </div>
      );
    }
  }
}

/**
 * Something flying from the boss's corner of the board (its top-left) to a square: the ice bolt (pointed at its
 * target) or the pie (tumbling), over `ms`.
 */
function Flight({ name, square, orientation, since, ms, aim = false, from: fromPct }: { name: "iceBolt" | "pieFly" | "sparkFly" | "darkPour"; square: string; orientation: "white" | "black"; since: number; ms: number; aim?: boolean; from?: { x: number; y: number } }) {
  const { x, y } = squareXY(square, orientation);
  // (From the boss's corner of the board; Hollow's darkness from the void in his chest, given in % of the board.)
  const from = fromPct ? { x: fromPct.x * 8, y: fromPct.y * 8 } : { x: 60, y: 30 };
  const angle = (Math.atan2(y - from.y, x - from.x) * 180) / Math.PI;
  const style: Record<string, string> = {
    left: `${(from.x - 50) / 8}%`,
    top: `${(from.y - 50) / 8}%`,
    "--fx": `${(x - 50) / 8}%`,
    "--fy": `${(y - 50) / 8}%`,
    animationDuration: `${ms}ms`,
    animationDelay: `${since - Date.now()}ms`,
    ...(aim ? { rotate: `${angle}deg` } : {}),
  };
  return (
    <span class={`pw-flight ${name}`} style={style}>
      <BossEffect name={name} since={since} />
    </span>
  );
}

// ---------------- G-REX's fire ----------------

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

/** The power's banner: the God King's cut-in style, the boss on the left and the God King on the right. */
export function PowerBanner({ boss, side, text, sub, tone = "" }: { boss: BossView; side: "w" | "b"; text: string; sub?: string; tone?: string }) {
  return (
    <div class={`fight-banner king-cut power-cut ${tone}`} role="alert" aria-label={sub ? `${boss.name}: ${text} ${sub}` : `${boss.name}: ${text}`}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait pc-boss">
          <BossFace boss={boss} />
        </span>
        <span class="fb-words kc-words">
          <span class="kc-label">{boss.name.replace(/^The /, "")}</span>
          <span class="fb-text kc-text">{text}</span>
          {sub && <span class="fb-sub">{sub}</span>}
        </span>
        <span class="kc-target pc-king">
          <GodKingPortrait side={side} />
        </span>
      </div>
    </div>
  );
}

// ---------------- Hollow's dark: a wrong attempt, his bulbs ----------------

/**
 * Your own move attempt into the dark that wasn't legal: the red-violet slash on the square it went for (`darkMiss`) and
 * a small "−5" rising off it. Only you see it.
 */
export function DarkCost({ square, since, now, orientation }: { square: string; since: number; now: number; orientation: "white" | "black" }) {
  if (now < since || now >= since + 1600) return null;
  return (
    <div class="power-board pw-dark-cost" aria-hidden="true">
      <span class="pw-dark-slash" style={at(square, orientation)}>
        <BossEffect name="darkMiss" since={since} id={`miss-${square}-${since}`} />
      </span>
      <span class="pw-cost" style={onSquare(square, orientation)} data-square={square}>
        −{BOSS_POWERS.darkTryCost}
      </span>
    </div>
  );
}

/** The strip relights this long after the last bulb goes out (his move shows, then the cast lands). */
const BULB_RELIGHT_MS = 1800 + DARK.landAt;
/** When this device saw Hollow's bulbs change, and from what (so the strip plays a bulb going out, or the relight). */
const bulbSeen = new Map<string, { n: number; from: number; at: number; relightAt?: number }>();
/**
 * Hollow's bulbs by the boss bar: the strip (`bulbStrand`), one lit for each of his moves until he covers another square
 * (the same count as on his strand). A bulb goes out as he moves; at the last he covers a square and they relight.
 */
export function BulbStrip({ boss, until = 0 }: { boss: BossView; until?: number }) {
  const n = boss.powers?.bulbs;
  if (n === undefined || boss.result) return null;
  // (On the boss screen that brings a cover: the strip relights as the darkness lands.)
  const cover = momentsOf(boss, until).find((m) => m.kind === "dark");
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const now = Date.now();
  let seen = bulbSeen.get(key);
  if (!seen) bulbSeen.set(key, (seen = { n, from: n, at: 0 }));
  else if (seen.n !== n) bulbSeen.set(key, (seen = { n, from: seen.n, at: now }));
  // Fewer: the bulb going out. More (he covered a square): the last going out with his move, then the relight as the
  // darkness lands.
  if (cover && seen.at && n > seen.from) seen.relightAt = cover.at + DARK.landAt;
  const relightAt = seen.relightAt ?? seen.at + BULB_RELIGHT_MS;
  const look = !seen.at
    ? { anim: `lit${Math.min(3, n)}`, since: 0 }
    : n < seen.from
      ? { anim: `out${Math.min(3, seen.from)}`, then: `lit${Math.min(3, n)}`, since: seen.at }
      : now < relightAt
        ? { anim: "out1", then: "lit0", since: seen.at }
        : { anim: "relight", then: "lit3", since: relightAt };
  return (
    <span class="bulb-strip" role="img" aria-label={`${n} ${n === 1 ? "bulb" : "bulbs"} lit`} data-bulbs={n}>
      <BossEffect name="bulbStrand" anim={look.anim} then={look.then} since={look.since} id={`bulbs-${key}-${look.anim}-${look.since}`} />
    </span>
  );
}

// ---------------- The rage meter ----------------

/**
 * The boss bar's rage meter: it fills over the battle (faster as the boss loses material or the crowd gets ahead on
 * the judged eval), glows as it nears full, flashes for the one-turn warning, and is gone once the ultimate is spent.
 */
export function RageMeter({ boss }: { boss: BossView }): ComponentChildren {
  const p = boss.powers;
  if (!p || p.rage === null || boss.result) return null;
  // (Warned or unleashed, it's full: the test switch can bring the ultimate before the meter is.)
  const pct = p.warned || p.ultAt !== null ? 100 : Math.round(p.rage * 100);
  const glow = pct >= BOSS_POWERS.rageGlowFrom * 100;
  return (
    <span class={`rage-meter${glow ? " glow" : ""}${p.warned ? " warned" : ""}${p.ultAt !== null ? " now" : ""}`} role="meter" aria-label={`Rage ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} title="Rage: when it's full, the boss's ultimate is coming">
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}
