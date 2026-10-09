import type { ComponentChildren } from "preact";
import { BOSS_POWERS, type PowerEventKind } from "@chessroyale/core";
import { FIRE_BURN_MS, POWER_FX, powerMomentMs, pieceAt } from "@chessroyale/chess";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt, type Effect, type EffectName } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BossEffect, BossMoment, SpriteAnim } from "./BossEffect.tsx";
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
 * - G-REX's fire: the tiles in their stages (PowerBoard), the sparkler, the Roman candle and its fireballs (moments),
 *   a piece burning after the crowd's move (FireBurn), and the candle's 12 pips by the board (CandlePips).
 */

/** One power's moment on screen: when it starts (ms, wall clock) and how long it takes. */
export interface Moment {
  kind: PowerEventKind;
  key: string;
  at: number;
  ms: number;
  square?: string;
  /** A wave of fireballs: their squares, in the order they land. */
  squares?: string[];
}

const ORDER: Record<PowerEventKind, number> = { freeze: 0, pie: 0, spark: 0, fireball: 0, warn: 1, blizzard: 2, candle: 2, funhouse: 3 };

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
    const m: Moment = { kind: e.kind, key: `${boss.id}:${e.kind}:${e.turn}`, at: t, ms: POWER_FX[e.kind], ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}) };
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
    if (m.kind === "fireball" && m.squares?.includes(square)) return m.at + fireballLandAt(m.squares.indexOf(square));
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
/** G-REX's sparkler: the banner, then his throw from the board's corner, the sparkler's flight, the tile catching. */
export const SPARK = { flyAt: 1450, landAt: 1850 } as const;
/**
 * The Roman candle: the banner, then he jumps onto the middle of the board and fires his 12 shots up, one every
 * `shotEvery` (each a pip by the board), then jumps off.
 */
export const CANDLE = { rexAt: 1300, shotsAt: 1950, shotEvery: 190, shotMs: 520, exitAt: 4350 } as const;
/** A wave of fireballs: each falls from above onto its square (a little after the one before) and lands as a fire tile. */
export const FIREBALL = { fallMs: 620, stagger: 170 } as const;
export const fireballLandAt = (i: number) => i * FIREBALL.stagger + FIREBALL.fallMs;
/** A piece burning after the crowd's move: the flare (the piece still showing until `goneAt`), then smoke. */
export const BURN = { goneAt: 520, ms: FIRE_BURN_MS } as const;

/** An effect sprite from the characters' art, once they've drawn it (until then the placeholders below show). */
const fx = (name: string): Effect | undefined => (EFFECTS as Record<string, Effect | undefined>)[name];

const at = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { left: `${(x - 50) / 8}%`, top: `${(y - 50) / 8}%` };
};

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
  // G-REX's fire tiles, each in its stage (a singe, more burn, ablaze), drawn as it lands.
  const fire = p.fire ?? [];
  // The candle's pips: shots still to fall (during the candle's own moment, it shows them filling).
  const candleM = moments.find((m) => m.kind === "candle");
  const wave = moments.find((m) => m.kind === "fireball");
  const inAir = wave ? (wave.squares ?? []).filter((_, i) => now < wave.at + fireballLandAt(i)).length : 0;
  const pips = p.candle && !(candleM && now < candleM.at + candleM.ms) && (p.candle.left > 0 || inAir > 0) ? p.candle.left + inAir : null;
  return (
    <div class="power-board" aria-hidden="true">
      {pips !== null && <CandlePips left={pips} />}
      {fire.map((t) => {
        const since = appearAt(t.square, moments, orientation);
        if (now < since) return null;
        return (
          <span key={`fire-${t.square}-${t.lit}`} class={`pw-fire stage-${Math.min(3, t.stage)}`} style={at(t.square, orientation)} data-stage={t.stage}>
            <FireTile stage={Math.min(3, t.stage)} since={since || t.lit} id={t.square} />
          </span>
        );
      })}
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
  );
}

// ---------------- The moments ----------------

const PIECE_WORD: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const ULT_NAME: Record<string, string> = { blizzard: "the Blizzard", funhouse: "the Funhouse", candle: "the Roman Candle" };

/** A small, stable hash, for picking a line the same everywhere. */
const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Which of the kit's moments a power's moment is (its animation and lines: characters/power-art.ts). */
const KIT_MOMENT: Record<PowerEventKind, "power" | "ultimateWarn" | "ultimate"> = {
  freeze: "power",
  pie: "power",
  spark: "power",
  fireball: "ultimate",
  warn: "ultimateWarn",
  blizzard: "ultimate",
  funhouse: "ultimate",
  candle: "ultimate",
};

/** The boss's line for a power's moment (its kit's), the same on every screen; null without one. */
export function powerLine(kit: BossKit | null, m: Pick<Moment, "kind" | "key">): string | null {
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
  const cast = (hit: string, hitAt: number, placeholder = false) => {
    const anim = kitAnim(kit, moment.kind);
    if (!anim) {
      // (No art for this moment yet: the boss's face steps up to the corner, a placeholder.)
      return placeholder && t >= hitAt - 500 ? (
        <span class="pm-caster pm-placeholder">
          <BossFace boss={boss} />
        </span>
      ) : null;
    }
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
          {cast("throw", SPARK.flyAt, true)}
          {moment.square && t >= SPARK.flyAt && t < SPARK.landAt && <Flight name="sparkFly" square={moment.square} orientation={orientation} since={moment.at + SPARK.flyAt} ms={SPARK.landAt - SPARK.flyAt} />}
          {moment.square && t >= SPARK.landAt - 40 && t < SPARK.landAt + 700 && <span class="pw-flare" style={{ ...at(moment.square, orientation), animationDelay: `${SPARK.landAt - 40 - t}ms` }} />}
        </div>
      );
    case "candle": {
      const anim = kitAnim(kit, "candle");
      const shots = Math.max(0, Math.min(12, Math.floor((t - CANDLE.shotsAt) / CANDLE.shotEvery) + 1));
      return (
        <div class="power-moment pm-candle">
          {t < 1500 && banner("ROMAN CANDLE!", "12 shots up…", "fire long")}
          {t >= CANDLE.rexAt && (
            <span class={`pm-pogo pm-rex${t >= CANDLE.exitAt ? " out" : ""}${anim ? "" : " pm-placeholder"}`}>
              {anim ? <BossMoment boss={boss.name} anim={anim} since={moment.at + CANDLE.rexAt} then="idle" /> : <BossFace boss={boss} />}
            </span>
          )}
          {Array.from({ length: shots }, (_, i) => {
            const since = moment.at + CANDLE.shotsAt + i * CANDLE.shotEvery;
            return now < since + CANDLE.shotMs ? <CandleShot key={i} i={i} since={since} /> : null;
          })}
          {t >= CANDLE.shotsAt && <CandlePips left={shots} lit={shots} />}
        </div>
      );
    }
    case "fireball":
      return (
        <div class="power-moment pm-fireball">
          {(moment.squares ?? []).flatMap((sq, i) => {
            const since = moment.at + i * FIREBALL.stagger;
            const land = moment.at + fireballLandAt(i);
            return [
              now >= since && now < land ? <Fireball key={`fb-${sq}`} square={sq} orientation={orientation} since={since} /> : null,
              now >= land - 40 && now < land + 650 ? <span key={`fl-${sq}`} class="pw-flare" style={{ ...at(sq, orientation), animationDelay: `${land - 40 - now}ms` }} /> : null,
            ];
          })}
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
function Flight({ name, square, orientation, since, ms, aim = false }: { name: "iceBolt" | "pieFly" | "sparkFly"; square: string; orientation: "white" | "black"; since: number; ms: number; aim?: boolean }) {
  const { x, y } = squareXY(square, orientation);
  const from = { x: 60, y: 30 };
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
      {fx(name) ? <BossEffect name={name as EffectName} since={since} /> : <span class={`pw-ph-${name}`} />}
    </span>
  );
}

// ---------------- G-REX's fire ----------------

/**
 * A fire tile in its stage: the characters' `fireTile` once drawn (its stage animations), else a placeholder: a singe,
 * then flames along the square, then the whole square ablaze. See-through: the piece on it shows.
 */
function FireTile({ stage, since, id }: { stage: number; since: number; id: string }) {
  const art = fx("fireTile");
  const anim = `stage${stage}`;
  if (art?.ch.anims[anim]) return <SpriteAnim ch={art.ch} anim={anim} since={since} sounds={art.sounds} id={id} />;
  return (
    <span class={`pw-ph-fire s${stage}`}>
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * After the crowd's move: a piece left on a tile ablaze burns (a flare, flames, smoke), or the tile fizzles out under
 * the king (a puff of smoke). Over the board, for BURN.ms from `since`.
 */
export function FireBurn({ burnt, since, now, orientation }: { burnt: readonly { square: string; piece?: string; fizzled?: boolean }[]; since: number; now: number; orientation: "white" | "black" }) {
  if (!burnt.length || now < since || now >= since + BURN.ms) return null;
  return (
    <div class="power-board pw-burns" aria-hidden="true">
      {burnt.map((b) => {
        const art = fx(b.fizzled ? "fireTile" : "pieceBurn");
        const anim = b.fizzled ? "fizzle" : "burn";
        return (
          <span key={`burn-${b.square}`} class={`pw-burn${b.fizzled ? " fizzled" : ""}`} style={at(b.square, orientation)}>
            {art?.ch.anims[anim] ? <SpriteAnim ch={art.ch} anim={anim} since={since} sounds={art.sounds} id={b.square} /> : <span class={b.fizzled ? "pw-ph-fizzle" : "pw-ph-burn"} style={{ animationDelay: `${since - now}ms` }} />}
          </span>
        );
      })}
    </div>
  );
}

/** One of the Roman candle's shots, streaking up from the middle of the board and off its top. */
function CandleShot({ i, since }: { i: number; since: number }) {
  const art = fx("candleShot");
  const style: Record<string, string> = { "--sx": `${(i % 2 ? 1 : -1) * (4 + ((i * 37) % 22))}%`, animationDuration: `${CANDLE.shotMs}ms`, animationDelay: `${since - Date.now()}ms` };
  return <span class="pw-shot" style={style}>{art ? <SpriteAnim ch={art.ch} anim={art.loop ?? art.start!} since={since} sounds={art.sounds} id={`shot-${i}`} /> : <span class="pw-ph-shot" />}</span>;
}

/** A fireball falling from above the board onto its square. */
function Fireball({ square, orientation, since }: { square: string; orientation: "white" | "black"; since: number }) {
  const art = fx("fireballFall");
  const { x, y } = squareXY(square, orientation);
  const style: Record<string, string> = {
    left: `${(x - 50) / 8}%`,
    top: `${(y - 50) / 8}%`,
    "--fy": `${-(y + 120) / 8}%`,
    animationDuration: `${FIREBALL.fallMs}ms`,
    animationDelay: `${since - Date.now()}ms`,
  };
  return <span class="pw-fireball" style={style}>{art ? <SpriteAnim ch={art.ch} anim={art.start ?? art.loop!} since={since} sounds={art.sounds} id={`fb-${square}`} /> : <span class="pw-ph-fireball" />}</span>;
}

/**
 * The Roman candle's shots still to fall: 12 pips by the board, one lit for each shot in the air, from the moment he
 * fires until the last fireball lands.
 */
export function CandlePips({ left, lit = left }: { left: number; lit?: number }) {
  return (
    <div class="pw-pips" role="img" aria-label={`${left} fireballs to fall`}>
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} class={i < lit ? "on" : ""} />
      ))}
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
