import { useLayoutEffect } from "preact/hooks";
import { MOO_BEATS, POWER_FX } from "@chessroyale/chess";
import { MOO_LINES } from "../characters/moo.ts";
import type { Character, Frame } from "../characters/sprite.ts";
import { noteCalm, noteSwap } from "../characters/moo-state.ts";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, type SquareItem } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { NORMAL, CRITICAL, bossVoice } from "../speech.tsx";
import { BoardEffects, SpriteAnim, prewarm, prewarmSprite } from "./BossEffect.tsx";
import { hash, onSquare, ragePct, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Moo & Moon's powers on screen (his rules: packages/chess/src/bosses/moo.ts; the beats: MOO_BEATS, timed by his animations'
 * cues; docs/decisions/2026-10-20-moo-wired.md), all from the shared state and each moment's start, so everyone online sees
 * the same thing. No banners: the Moon talks (its lines are his moments' words) and the board shows it:
 * - **Moonbeam** (as the crowd's turn after his move begins): he lifts his snout and moos; at the `beam` cue a moonbeam falls
 *   from the sky onto the piece, hits it, and holds as its glow with a crescent moon burned into its square (under the piece:
 *   the stunned mark) until the crowd's move lands; then both fade. That piece can't be picked up: a tap of its moves says
 *   "Moonlight holds that piece." (refused.ts), as Ginger's frozen piece says its own.
 * - **The flurry** (the same, on the Full Moon's first turn): the moon rises over his head and fires five beams, `beam1` to
 *   `beam5`, 120 ms apart; each falls on its square in the order the rules give (the moment's `squares`), all hold together.
 * - **The Full Moon** (as the crowd's move lands, while he thinks): the moon swells to full and he takes in its power; at the
 *   `swap` cue his colors go gold and the aura flares on. From then on every animation of his is drawn powered up (characters/
 *   moo-state.ts) until he is dazed.
 * - **Dazed** (as the crowd's turn after his last powered move begins): the aura fizzles, and at `calm` his colors go back.
 * - **The Moon on his meter** (`bar`): his rage meter's number as a moon from new to full, and the Moon says a line as it passes
 *   a quarter, a half and three quarters (`wax`).
 */

const B = MOO_BEATS;
type Orientation = "white" | "black";

/** How long the held beams and the burned crescents take to fade once the crowd's move lands (ms): the longer of the two fades. */
export const FADE_MS = Math.max(animLength(EFFECTS.moonbeam.ch.anims.fade!), animLength(EFFECTS.moonScorch.ch.anims.fade!)) + 20;

// ---------------- The beams on the board ----------------

/** Where one beam is: not yet fallen, falling, hitting, holding as the stunned mark, or fading away. */
export type BeamPhase = "wait" | "fall" | "hit" | "hold" | "fade";

/** A beam that started falling at `fallAt` (ms, wall clock; 0: long ago), at `now`, fading from `fadeAt` (0: not yet). */
export function beamPhase(now: number, fallAt: number, fadeAt = 0): BeamPhase {
  if (fadeAt && now >= fadeAt) return "fade";
  if (now < fallAt) return "wait";
  if (now < fallAt + B.moonbeam.fallMs) return "fall";
  if (now < fallAt + B.moonbeam.fallMs + B.moonbeam.hitMs) return "hit";
  return "hold";
}

/** When the beam on the i-th held square starts falling: from its moment on this screen (the flurry's 120 ms apart), else it has long since. */
export function fallAtOf(moment: Pick<Moment, "kind" | "at"> | null, i: number): number {
  if (!moment) return 0;
  return moment.kind === "flurry" ? moment.at + B.flurry.beamAt + i * B.flurry.stagger : moment.at + B.moonbeam.beamAt;
}

/**
 * The squares that carry a beam now and when they began to fade: those the view holds (`stunned`: they can't move this crowd
 * turn), and, for FADE_MS after the crowd's move lands (the view empties them), the squares just released, fading. Remembered
 * across screens (the crowd's turn has its own), a battle at a time.
 */
const held = { key: "", squares: [] as string[], fadeAt: 0 };
export function heldMarks(boss: Pick<BossView, "id" | "startMove">, stunned: readonly string[], now: number): { squares: string[]; fadeAt: number } {
  const key = `${boss.id}:${boss.startMove}`;
  if (held.key !== key) Object.assign(held, { key, squares: [], fadeAt: 0 });
  if (stunned.length) Object.assign(held, { squares: [...stunned], fadeAt: 0 });
  else if (held.squares.length) {
    if (!held.fadeAt) held.fadeAt = now;
    if (now >= held.fadeAt + FADE_MS) Object.assign(held, { squares: [], fadeAt: 0 });
  }
  return { squares: held.squares, fadeAt: held.fadeAt };
}

/** The burned-in crescents, one canvas under the pieces: each burns in as its beam hits, holds, and fades with it. */
export function scorchItems(squares: readonly string[], moment: Pick<Moment, "kind" | "at"> | null, fadeAt: number, now: number): SquareItem[] {
  const out: SquareItem[] = [];
  squares.forEach((square, i) => {
    const phase = beamPhase(now, fallAtOf(moment, i), fadeAt);
    if (phase === "fade") out.push({ square, name: "moonScorch", anim: "fade", since: fadeAt, quiet: true });
    else if (phase === "hold" || phase === "hit") {
      // (From the beam's hit; its `burn` ends on the cold char's first look and the loop carries on.)
      out.push({ square, name: "moonScorch", anim: "burn", since: fallAtOf(moment, i) + B.moonbeam.fallMs, quiet: true });
    }
  });
  return out;
}

/** The beams over the board: each a column eight squares tall whose bottom square is the target, clipped at the board's top. */
function Beams({ squares, moment, fadeAt, orientation, now, boss }: { squares: readonly string[]; moment: Pick<Moment, "kind" | "at"> | null; fadeAt: number; orientation: Orientation; now: number; boss: Pick<BossView, "id" | "startMove"> }) {
  const fx = EFFECTS.moonbeam;
  const flurry = moment?.kind === "flurry";
  return (
    <div class="mo-sky" data-marks={squares.join(",")} data-fade={fadeAt ? "1" : "0"}>
      {squares.map((square, i) => {
        const fallAt = fallAtOf(moment, i);
        const phase = beamPhase(now, fallAt, fadeAt);
        if (phase === "wait") return null;
        const hitAt = fallAt + B.moonbeam.fallMs;
        const holdAt = hitAt + B.moonbeam.hitMs;
        const [anim, since] = phase === "fade" ? ["fade", fadeAt] : phase === "fall" ? ["fall", fallAt] : phase === "hit" ? ["hit", hitAt] : ["hold", holdAt];
        // (The flurry's five are quiet: the moon's own `beam1` to `beam5` are their sound. A single beam's shimmer is as it hits.)
        return (
          <span key={square} class="mo-beam" data-square={square} data-phase={phase} style={onSquare(square, orientation)}>
            <SpriteAnim ch={fx.ch} anim={anim!} since={since!} sounds={flurry ? {} : { hit: fx.sounds.hit! }} id={`${boss.id}:${boss.startMove}:${square}`} />
          </span>
        );
      })}
    </div>
  );
}

// ---------------- His moments ----------------

const find = (moments: readonly Moment[], ...kinds: Moment["kind"][]) => moments.find((m) => kinds.includes(m.kind)) ?? null;

/** A line of his kit's for one of his own moments (the same for everyone: by the moment's key). */
const ownLine = (beat: "flurry" | "dazed", kit: ReturnType<typeof bossKit>, key: string): string | null => {
  const lines = kit?.lines[beat];
  return lines?.length ? lines[hash(key) % lines.length]! : null;
};

/** The Moonbeam: his animation at the board's corner; the beam itself and what it leaves are the board layer's (`MOO_UI.board`). */
function moonbeamMoment({ cast }: MomentProps) {
  return <div class="power-moment pm-moonbeam">{cast("beam", B.moonbeam.beamAt)}</div>;
}

/** The flurry: the moon rises over his head and fires five beams, `beam1` first (the board layer drops them in turn). */
function flurryMoment({ cast }: MomentProps) {
  return <div class="power-moment pm-flurry">{cast("beam1", B.flurry.beamAt)}</div>;
}

/** The Full Moon: the moon swells and he takes in its power; his colors go gold at the `swap` cue. */
function fullMoonView({ cast }: MomentProps) {
  return <div class="power-moment pm-fullmoon">{cast("swap", B.fullMoon.swapAt)}</div>;
}

/** The daze: the aura fizzles, his colors go back at the `calm` cue. */
function dazedMoment({ cast }: MomentProps) {
  return <div class="power-moment pm-dazed">{cast("calm", B.dazed.calmAt)}</div>;
}

/**
 * The Moonbeam and the flurry play as the crowd's turn begins (after his move), the daze too, after them; the Full Moon as the
 * crowd's move lands, while he thinks (`fullMoonMoment`). No banners.
 */
const MOMENTS: Record<"moonbeam" | "flurry" | "fullMoon" | "dazed", MomentUi> = {
  // (The Moon's line as the beam leaves.)
  moonbeam: { order: 0, kit: "power", lineAt: B.moonbeam.beamAt, view: moonbeamMoment },
  // (The flurry takes the place of that turn's Moonbeam; it is part of his ultimate, so its line cuts in.)
  flurry: { order: 2, kit: "ultimateHit", line: (kit, m) => ownLine("flurry", kit, m.key), lineAt: B.flurry.beamAt, priority: () => CRITICAL, view: flurryMoment },
  fullMoon: { order: 2, kit: "ultimate", view: fullMoonView },
  // (The daze is the end of his ultimate, and comes straight after the Moonbeam his last move may bring: its line cuts in on that one,
  // or the Moon would wait and be dropped as stale.)
  dazed: { order: 3, kit: "powerHit", line: (kit, m) => ownLine("dazed", kit, m.key), priority: () => CRITICAL, view: dazedMoment },
};

/** When this device first saw each Full Moon (a screen drawn again carries on; it doesn't start over). */
const fullMoonSeen = new Map<string, number>();

/**
 * The Full Moon's transformation, as a moment of his thinking screen (it comes as the crowd's move lands, at the start of his
 * turn, and his move waits for it): from when this device first saw it. Its `swap` is noted for `mooPowered`. None when the
 * Full Moon isn't coming now.
 */
export function fullMoonMoment(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "moo" || !p) return [];
  return p.events
    .filter((e) => e.kind === "fullMoon" && e.turn === p.turn)
    .map((e): Moment => {
      const key = `${boss.id}:fullMoon:${e.turn}`;
      const seenKey = `${boss.startMove}:${key}`;
      let at = fullMoonSeen.get(seenKey);
      if (at === undefined) {
        fullMoonSeen.set(seenKey, (at = now));
        if (fullMoonSeen.size > 20) fullMoonSeen.delete(fullMoonSeen.keys().next().value!);
      }
      noteSwap(boss, at + B.fullMoon.swapAt);
      return { kind: "fullMoon", key, at, ms: POWER_FX.fullMoon };
    });
}

/**
 * His daze among the moments of the screen that plays it: his last powered move and the start of the daze draw powered until its
 * `calm`, so that time is noted from the moment's own start (known from the screen's start: moments end where the screen does).
 */
export function noteMooMoments(boss: BossView, moments: readonly Moment[]): void {
  const dazed = find(moments, "dazed");
  if (boss.id === "moo" && dazed) noteCalm(boss, dazed.at + B.dazed.calmAt);
}

// ---------------- The Moon on his meter ----------------

/** Which phase of the moon the meter shows: 0 (new) to 8 (full), a step every eighth. */
export const moonStep = (pct: number): number => Math.max(0, Math.min(8, Math.round(pct / 12.5)));

/** Which of the Moon's lines the meter has reached: 1 at a quarter, 2 at a half, 3 at three quarters, 0 before (and once it's full: the warning's words). */
export const waxLevel = (pct: number): 0 | 1 | 2 | 3 => (pct >= 100 ? 0 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0);

/**
 * The pixels of the moon at a step (0 new to 8 full), 12 x 12: the disc, and the lit side (the right, as it waxes) up to a
 * terminator curving from the lit tip's side across to the other. `true`: lit, `false`: the dark disc, `null`: outside.
 */
export function moonPixels(step: number, size = 12): (boolean | null)[][] {
  const f = step / 8;
  const r = size / 2 - 0.4;
  const c = size / 2;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      if (dx * dx + dy * dy > r * r) return null;
      const w = Math.sqrt(Math.max(0, r * r - dy * dy));
      return step > 0 && dx >= (1 - 2 * f) * w;
    }),
  );
}

/** His ultimate's meter as the moon, new to full, and the Moon talking as it fills. */
function MoonPhase({ boss }: { boss: BossView }) {
  const pct = ragePct(boss);
  const p = boss.powers;
  const step = moonStep(pct ?? 0);
  const level = pct === null || p?.warned ? 0 : waxLevel(pct);
  const key = `${boss.id}:${boss.startMove}:wax:${p?.ults ?? 0}`;
  // As the meter passes a quarter, a half, three quarters: one line a cycle each (the highest it has reached), into his voice.
  useLayoutEffect(() => {
    if (level > 0) bossVoice.say(MOO_LINES.wax?.[level - 1], `${key}:${level}`, NORMAL);
  }, [level, key]);
  if (pct === null) return null;
  const grid = moonPixels(step);
  return (
    <span class={`mo-moon${p?.paused ? " paused" : ""}`} role="img" aria-label={`Moon ${Math.round((step / 8) * 100)}% full`} data-step={step} data-pct={pct}>
      <svg viewBox="0 0 12 12" width="12" height="12" shape-rendering="crispEdges" aria-hidden="true">
        {grid.flatMap((row, y) => row.map((v, x) => (v === null ? null : <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" class={v ? "lit" : "dark"} />)))}
      </svg>
    </span>
  );
}

// ---------------- Drawn ahead ----------------

let warmed = false;
/** A frame with an aura or a moon glow of its own: made the first time any frame uses it, 5 to 20 ms of work each. */
const heavy = (f: Frame) => f.layers.some((l) => l.part.startsWith("aura") || l.part.startsWith("mglow"));
/** How long between one such frame and the next, drawn ahead (a hundred and fifty of them together would stall a phone for seconds). */
const DRIP_MS = 200;
function drip(ch: Character, frames: readonly Frame[], i = 0): void {
  if (i < frames.length) prewarmSprite(ch, [frames[i]!], undefined, () => void setTimeout(() => drip(ch, frames, i + 1), DRIP_MS));
}
/**
 * His moonbeam, flurry, daze, his hug and sit, the Full Moon and every animation of his powered up, and the beams and scorch on
 * the board, drawn ahead as his battle starts. What takes no aura goes a slice a frame; the frames that each paint one (a hundred
 * and fifty, most of them his powered-up twins) one every DRIP_MS, in the order they'll be needed, and what's not yet drawn when
 * it's wanted is drawn then.
 */
export function prewarmMoo(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  const twins = Object.keys(kit.ch.anims).filter((a) => a.startsWith("p_"));
  const all = [...frames("moonbeam"), ...frames("toSit"), ...frames("sit"), ...frames("toHug"), ...frames("dazed"), ...frames("fullMoon"), ...frames("powerIdle"), ...frames("flurry"), ...twins.flatMap(frames)];
  prewarmSprite(kit.ch, all.filter((f) => !heavy(f)), undefined, () => {
    drip(kit.ch, all.filter(heavy));
    // (His attack on a king, powered up: the Last Stand mid-Full Moon.)
    const ka = kit.kingAttack;
    if (ka?.poweredAnim) drip(ka.ch, (ka.ch.anims[ka.poweredAnim]?.frames ?? []).filter(heavy));
  });
  for (const fx of ["moonbeam", "moonScorch"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const MOO_UI = {
  id: "moo",
  // (The Full Moon comes at the start of his turn, after your move, as Alfil's Slam.)
  ultimate: { name: "Full Moon", when: "After your move" },
  moments: MOMENTS,
  // His meter's moon, beside it in the boss bar.
  ultBar: ({ boss }) => <MoonPhase boss={boss} />,
  // The stunned mark: the burned-in crescent under the piece, and the beam's glow over it, for as long as the piece is held.
  board: ({ boss, p, moments, now, orientation }) => {
    const marks = heldMarks(boss, p.stunned ?? [], now);
    if (!marks.squares.length) return { over: null };
    const moment = find(moments, "moonbeam", "flurry");
    const scorch = scorchItems(marks.squares, moment, marks.fadeAt, now);
    return {
      under: scorch.length > 0 && <BoardEffects items={scorch} orientation={orientation} class="pw-shadow-board mo-scorch" />,
      over: <Beams squares={marks.squares} moment={moment} fadeAt={marks.fadeAt} orientation={orientation} now={now} boss={boss} />,
    };
  },
} satisfies BossUi;
