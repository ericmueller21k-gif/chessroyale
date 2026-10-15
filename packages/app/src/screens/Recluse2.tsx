import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { moveLeft } from "@chessroyale/chess";
import { RECLUSE, RECLUSE_BUST, RECLUSE_JUMP, palmOf } from "../characters/recluse.ts";
import type { Frame } from "../characters/sprite.ts";
import { EngineOverlay, placeEngine } from "../components/Recluse.tsx";
import { kingSay } from "../godKing.ts";
import { play } from "../sound.ts";
import { BOSS_KITS } from "../characters/kits.ts";
import { RECLUSE_LINES } from "../characters/recluse-lines.ts";
import { EFFECTS } from "../characters/power-art.ts";
import { Board } from "../components/Board.tsx";
import { SpriteAnim } from "../components/BossEffect.tsx";
import { BossSide } from "../components/BossCharacter.tsx";
import { BossDock } from "../components/BossDock.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { COMPUTER_LAYOUT } from "../components/MatchMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import type { GameView, SimulBoardView, SimulView } from "../game.ts";
import type { ComponentChildren } from "preact";
import { ARC_LIFE, ARC_REDRAW, ARC_STRIKES, PHASE2_ULT_BANNER_MS, PHASE_CHANGE, absorbKing, arcPoints, smoothPath, type ArcStrike } from "../recluse-phase2.ts";
import { CRITICAL, NORMAL, bossVoice } from "../speech.tsx";
import { Hud } from "./Hud.tsx";
import { BossHeading } from "./Play.tsx";

/**
 * The Hidden Boss's phase change and his phase 2 (rules: packages/chess/src/bosses/recluse-phase2.ts; the driver:
 * recluse-phase2.ts). Both keep the boss screen's frame (the header and his bust on a phone, his figure by the board on a
 * computer, the God King's dock below), so nothing jumps from phase 1's board.
 *
 * The four boards sit in the board's own square as a 2x2, each at its corner (a computer plays them there, as the phase
 * change leaves them). On a phone your board is big and the other three are small above it; tap one to watch it big.
 */

/** Which board each quarter of the square holds (top left, top right, bottom left, bottom right): yours at bottom left. */
const QUARTER_BOARD = [1, 2, 0, 3] as const;
/** Each board's share of the square once split (the rest is the cross between them). */
const CELL = 0.48;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A quarter's look at `t` (ms into the phase change): its quarter of the whole board, parting from the middle, then
 * growing into a whole board at its corner (its clip opening to the full board as it shrinks toward its corner; the board
 * itself keeps its size: only a transform, which it measures without).
 */
function quarterStyle(q: number, t: number): Record<string, string> {
  const C = PHASE_CHANGE;
  const right = q % 2 === 1;
  const bottom = q >= 2;
  const part = ease((t - C.partAt) / (C.growAt - C.partAt));
  const grow = ease((t - C.growAt) / C.growMs);
  const gap = (1 - grow) * part * 3;
  const scale = 1 - (1 - CELL) * grow;
  const half = 50 * (1 - grow);
  const clip = `inset(${bottom ? half : 0}% ${right ? 0 : half}% ${bottom ? 0 : half}% ${right ? half : 0}%)`;
  return {
    clipPath: clip,
    transformOrigin: `${right ? "100%" : "0"} ${bottom ? "100%" : "0"}`,
    transform: `translate(${right ? gap : -gap}%, ${bottom ? gap : -gap}%) scale(${scale})`,
  };
}

type Pt = { x: number; y: number };
/** His whole figure on the board: its width (% of the board; about his own 2x by a computer's board, larger than his bust on a phone). */
const FIG_W = 24;
const FIG_H = (FIG_W * RECLUSE.h) / RECLUSE.w;
/** Where his feet land, in the middle of the board (% of it); the book lies open just in front of them. */
const MIDDLE: Pt = { x: 50, y: 60 };
/** His raised hands as he chants in the middle of the board (% of it, our left first): where the arcs strike from. */
const CHANT_HANDS = (() => {
  const f = RECLUSE.anims.chant!.frames[0]!;
  const left = MIDDLE.x - (FIG_W * RECLUSE.foot[0]) / RECLUSE.w;
  const top = MIDDLE.y - (FIG_H * RECLUSE.foot[1]) / RECLUSE.h;
  return f.layers
    .filter((l) => l.part === "hand:palm")
    .map((l) => [left + ((l.x + 3.5) / RECLUSE.w) * FIG_W, top + ((l.y + 2) / RECLUSE.h) * FIG_H] as const)
    .sort((a, b) => a[0] - b[0]);
})();
/** Where he leaps from and back to (his feet), by his place: a phone's boss bar above the board's top left; a computer's figure by its bottom left. */
const PLACE = { phone: { x: 10, y: 38 }, computer: { x: -12, y: 100 } } as const;
const FLIGHT = RECLUSE_JUMP.landAt - RECLUSE_JUMP.upAt;
/** A leap from `a` to `b`, off the ground at `upAt` (ms into the phase change): where his feet are. */
function leapAt(t: number, a: Pt, b: Pt, upAt: number): Pt {
  const u = clamp01((t - upAt) / FLIGHT);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - 22 * 4 * u * (1 - u) };
}
/** The light's strength at `t`: rising out of the book as he begins to chant, dying as the boards settle. */
function lightAt(t: number): number {
  const C = PHASE_CHANGE;
  return Math.min(clamp01((t - C.chantAt) / C.lightMs), 1 - clamp01((t - (C.growAt + C.growMs - 300)) / 500));
}

/** Sounds and lines of the phase change already started (by its start time and name): each once, as its beat comes. */
const cued = new Set<string>();
/** Runs `fn` once, as `on` turns true (a layout effect: as the beat shows, whatever the screen does next). */
function useCue(on: boolean, key: string, fn: () => void) {
  useLayoutEffect(() => {
    if (!on || cued.has(key)) return;
    cued.add(key);
    if (cued.size > 200) cued.delete(cued.values().next().value!);
    fn();
  }, [on]);
}

type Xy = { x: number; y: number };
/** His raised hand in the frame he holds it up in while the power streams in (`seizeLoop`), on either drawing. */
const SEIZE_PALM = { [RECLUSE.id]: palmOf(RECLUSE.anims.seizeLoop!.frames[0]!)!, [RECLUSE_BUST.id]: palmOf(RECLUSE_BUST.anims.seizeLoop!.frames[0]!)! };
/** Golden motes in the stream, and how long one takes from the God King to the boss (ms). */
const MOTES = 16;
const MOTE_MS = 650;
const easeIn = (x: number) => x * x * (1.6 - 0.6 * x);
/** A point along the stream (a cubic from him to the boss: low along the board's bottom first, then up into the hand). */
function along(p: number, g: Xy, c1: Xy, c2: Xy, b: Xy): Xy {
  const q = 1 - p;
  const w = [q * q * q, 3 * q * q * p, 3 * q * p * p, p * p * p];
  return { x: w[0]! * g.x + w[1]! * c1.x + w[2]! * c2.x + w[3]! * b.x, y: w[0]! * g.y + w[1]! * c1.y + w[2]! * c2.y + w[3]! * b.y };
}

/**
 * The God King's power drained into the boss (PHASE_CHANGE's `drainAt` to `igniteAt`): a soft golden beam from him to
 * the boss's raised hand, golden motes flowing along it, a glow gathering in the hand, a cold flash as it lands. They
 * stand in different parts of the screen (his dock, the boss's bar or the board's corner), so it's drawn over the whole
 * page, in its pixels, measured from their drawings as it starts (and again if the page changes size). Only the motes'
 * transforms and the layers' opacity change from frame to frame.
 */
function AbsorbStream({ t }: { t: number }) {
  const C = PHASE_CHANGE;
  const [geo, setGeo] = useState<{ g: Xy; b: Xy; c1: Xy; c2: Xy; u: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const him = document.querySelector(".gk-unit .god-king")?.getBoundingClientRect();
      // (His figure where he stands on this screen: the bust in a phone's bar, the whole figure by a computer's board.)
      const box = [...document.querySelectorAll<HTMLElement>(".boss-char.ch-recluse, .boss-char.ch-recluse-bust")].find((e) => e.getBoundingClientRect().width > 0);
      const cv = box?.querySelector(".boss-char-sprite")?.getBoundingClientRect();
      if (!him || !box || !cv?.width) return setGeo(null);
      const ch = box.classList.contains(`ch-${RECLUSE_BUST.id}`) ? RECLUSE_BUST : RECLUSE;
      const palm = SEIZE_PALM[ch.id]!;
      const b = { x: cv.left + (palm[0] / ch.w) * cv.width, y: cv.top + (palm[1] / ch.h) * cv.height };
      const g = { x: him.left + him.width * 0.5, y: him.top + him.height * 0.55 };
      // (Out of him sideways, low, then up into the hand from below: clear of both their words above them.)
      const low = Math.max(g.y, b.y) + him.height * 0.15;
      setGeo({ g, b, c1: { x: (g.x + b.x) / 2, y: low }, c2: { x: b.x, y: low }, u: Math.max(0.8, him.width / 50), w: innerWidth, h: innerHeight });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, []);
  if (!geo) return null;
  const { g, b, c1, c2, u } = geo;
  const d = t - C.drainAt;
  // The beam: in over a quarter second, a slow shimmer, out as the power lands.
  const beam = Math.max(0, Math.min(1, d / 250, (C.igniteAt + 120 - t) / 200)) * (0.85 + 0.15 * Math.sin(t / 70));
  const path = `M${g.x} ${g.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
  const motes: { x: number; y: number; s: number; o: number }[] = [];
  for (let i = 0; i < MOTES; i++) {
    const start = C.drainAt + (i * MOTE_MS) / MOTES;
    if (t < start) continue;
    const cycle = Math.floor((t - start) / MOTE_MS);
    // (None sets off that couldn't arrive by the time the power lands: the stream empties into his hand.)
    if (start + (cycle + 1) * MOTE_MS > C.igniteAt + 40) continue;
    const p = easeIn(((t - start) % MOTE_MS) / MOTE_MS);
    const at = along(p, g, c1, c2, b);
    const wob = Math.sin(p * Math.PI) * Math.sin(i * 1.7 + t / 110) * 7 * u;
    motes.push({ x: at.x + wob * 0.6, y: at.y + wob, s: 1 - 0.45 * p, o: Math.min(1, p * 6) });
  }
  // The glow gathering in his hand, and the cold flash as it lands.
  const gather = Math.max(0, Math.min(1, d / C.drainMs));
  const flash = t >= C.igniteAt ? Math.max(0, 1 - (t - C.igniteAt) / 450) : 0;
  return createPortal(
    <div class="rc-absorb" aria-hidden="true">
      <svg class="rc-absorb-beam" width={geo.w} height={geo.h} style={{ opacity: String(beam) }}>
        <path d={path} class="rc-beam-glow" style={{ strokeWidth: 12 * u }} />
        <path d={path} class="rc-beam-core" style={{ strokeWidth: 2.4 * u }} />
      </svg>
      {motes.map((m, i) => (
        <i key={i} class="rc-mote" style={{ transform: `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px) scale(${(m.s * u).toFixed(2)})`, opacity: String(m.o) }} />
      ))}
      {t < C.igniteAt && <i class="rc-gather" style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${((0.4 + 0.9 * gather) * u).toFixed(2)})`, opacity: String(Math.min(1, d / 300)) }} />}
      {flash > 0 && <i class="rc-landflash" style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${((0.6 + 2.2 * (1 - flash)) * u).toFixed(2)})`, opacity: String(flash) }} />}
    </div>,
    document.body,
  );
}

/** One arc's path: its main stroke from his hand to the cracks, and now and then a short branch off it. */
function arcShape(s: ArcStrike, from: readonly [number, number], redraw: number) {
  const pts = arcPoints(from, s.to, s.seed * 31 + redraw, 4, s.big ? 0.13 : 0.16);
  const main = smoothPath(pts);
  if (s.seed % 3 === 0) return { main, branch: null };
  // (A branch from about the middle, off at an angle, a third as long.)
  const k = 6 + (s.seed % 5);
  const p = pts[k]!;
  const dx = s.to[0] - from[0];
  const dy = s.to[1] - from[1];
  const turn = (s.seed % 2 ? 1 : -1) * 0.6;
  const end: [number, number] = [p[0] + (dx * Math.cos(turn) - dy * Math.sin(turn)) * 0.3, p[1] + (dx * Math.sin(turn) + dy * Math.cos(turn)) * 0.3];
  return { main, branch: smoothPath(arcPoints(p, end, s.seed + redraw * 7, 3, 0.18)) };
}

/**
 * Blue arcs striking the board as it cracks and splits (Eric, Oct 14: the engine's power splits it; "smoother looking"
 * than the game's earlier bolts): from his raised hands to points along the cracks, each a thin bright core in two soft
 * glows (wide strokes, no filter), its shape drawn again every ARC_REDRAW ms, gone in ARC_LIFE ms; where it lands, a blue
 * flash, and the board pulses blue a little with each. One SVG over the board (its own 0-100 square).
 */
function Arcs({ t, hands }: { t: number; hands: readonly (readonly [number, number])[] }) {
  const live = ARC_STRIKES.filter((s) => t >= s.at && t < s.at + ARC_LIFE);
  let pulse = 0;
  for (const s of live) pulse = Math.max(pulse, (s.big ? 1 : 0.55) * (1 - (t - s.at) / ARC_LIFE));
  return (
    <>
      <span class="rc-zap" style={{ opacity: String(pulse.toFixed(3)) }} />
      <svg class="rc-arcs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {live.map((s) => {
          const age = t - s.at;
          const o = age < 40 ? 1 : Math.pow(1 - (age - 40) / (ARC_LIFE - 40), 1.6);
          const { main, branch } = arcShape(s, hands[s.hand]!, Math.floor(age / ARC_REDRAW));
          const w = s.big ? 1.3 : 1;
          return (
            <g key={`${s.at}:${s.hand}`} opacity={o.toFixed(3)}>
              <circle class="rc-arc-hit" cx={s.to[0]} cy={s.to[1]} r={(2.4 + 3.6 * (age / ARC_LIFE)) * w} />
              <path class="rc-arc-glow2" d={main} stroke-width={3.2 * w} />
              <path class="rc-arc-glow" d={main} stroke-width={1.3 * w} />
              <path class="rc-arc-core" d={main} stroke-width={0.45 * w} />
              {branch && <path class="rc-arc-glow" d={branch} stroke-width={0.7 * w} />}
              {branch && <path class="rc-arc-core" d={branch} stroke-width={0.25 * w} />}
            </g>
          );
        })}
      </svg>
    </>
  );
}

/**
 * The phase change on one square stage (PHASE_CHANGE has its beats). Not skippable, like a boss's intro. It opens with the
 * God King's absorption: in his place in the dock (BossDock's `king`: absorbKing) he stands triumphant, is drained and
 * fades, the stream between them drawn over the page (AbsorbStream). The boss's place (BossCharacter, from the figure run
 * solo.ts sets) plays his seizing and his rage, his half-engine look igniting as the power lands (its time set by solo.ts:
 * setEngineAt); from the leap to his return the board draws his whole figure instead (RECLUSE's on-board animations, the
 * look over it too) and his place stands empty (`rc-away`), his words still beside it. Blue arcs strike the board as it
 * splits (Arcs).
 */
export function PhaseChangeScreen({ match, at }: { match: GameView; at: number }) {
  const v = match.simul;
  const now = useFrameNow();
  const computer = useMedia(COMPUTER_LAYOUT);
  const t = now - at;
  const C = PHASE_CHANGE;
  // The absorption: the God King's triumph (his shout as he raises his sword, his line), his cry as he's drained (and
  // the drain's whoosh), the boss's line as the power lands (its spark is his frames' cue), the God King gone in light.
  const cue = (on: boolean, name: string, fn: () => void) => useCue(on, `${at}:${name}`, fn);
  cue(t >= C.kingAt + 80, "hyuah", () => play("gkHyuah"));
  cue(t >= C.kingAt + 150, "triumph", () => kingSay("foeTriumph", `recluse:absorb:${at}`));
  cue(t >= C.drainAt, "drain", () => {
    play("recluseDrain");
    play("gkLastGrunt2");
    kingSay("foeDrained", `recluse:drained:${at}`);
  });
  cue(t >= C.igniteAt + 80, "leave", () => play("gkLeave"));
  // (NORMAL: his chant, three and a half seconds on, cuts in on it, so the chant's words come as he chants.)
  cue(t >= C.absorbLineAt, "absorb", () => bossVoice.say(RECLUSE_LINES.absorb[at % RECLUSE_LINES.absorb.length]!, `recluse:absorb:${at}`, NORMAL));
  cue(t >= C.arcAt, "arcs", () => play("recluseArc"));
  // His look over his figure on the board, placed on his head frame by frame.
  const figEngine = useRef<HTMLSpanElement>(null);
  const onFigFrame = useCallback((f: Frame) => placeEngine(figEngine.current, f), []);
  // His chant over the book as the light comes (one line, picked by the phase change), and his word as the book is back
  // in his hands.
  const chanting = t >= C.chantAt;
  useLayoutEffect(() => {
    if (chanting) bossVoice.say(RECLUSE_LINES.chant[at % RECLUSE_LINES.chant.length]!, `recluse:chant:${at}`, CRITICAL);
  }, [chanting]);
  const revived = t >= C.catchAt;
  useLayoutEffect(() => {
    if (revived) bossVoice.say(RECLUSE_LINES.revive[at % RECLUSE_LINES.revive.length]!, `recluse:revive:${at}`, CRITICAL);
  }, [revived]);
  if (!v) return null;
  const split = t >= C.partAt;
  const shuffled = t >= C.shuffleAt;
  const away = t >= C.leapAt && t < C.homeAt;
  // (The board jolts as he lands.)
  const jolt = t >= C.landAt && t < C.landAt + 320;
  const place = computer ? PLACE.computer : PLACE.phone;
  // His figure on the board: the leap in, the book thrown down, the chant, the book back in his hands, the leap back.
  const fig =
    t < C.leapAt || t >= C.homeAt
      ? null
      : t < C.dropAt
        ? { anim: "leap", since: at + C.leapAt, feet: leapAt(t, place, MIDDLE, C.upAt) }
        : t < C.chantAt
          ? { anim: "drop", since: at + C.dropAt, feet: MIDDLE }
          : t < C.pickupAt
            ? { anim: "chantRaise", then: "chant", since: at + C.chantAt, feet: MIDDLE }
            : t < C.backAt
              ? { anim: "pickup", since: at + C.pickupAt, feet: MIDDLE }
              : { anim: "leap2", since: at + C.backAt, feet: leapAt(t, MIDDLE, place, C.backAt + RECLUSE_JUMP.upAt) };
  // (His shadow where he'll come down: on the way in only, since on the way back he's gone before he lands.)
  const flying = fig?.anim === "leap" && t >= C.upAt && t < C.landAt;
  const light = lightAt(t);
  const cracking = t >= C.crackAt && t < C.growAt;
  return (
    <div class={`screen game boss-screen rc-change${away ? " rc-away" : ""}`}>
      <Hud match={match} />
      <div class={`board-area${jolt ? " pw-crash" : ""}`}>
        <div class="opening-name">
          <BossHeading side="w" note={split ? "phase 2: Chess960" : "the boss is beaten"} />
        </div>
        <div class="board-row">
          <BossSide match={match} />
          <div class="eval-bar rc-evalgap" aria-hidden="true" />
          <div
            class="board-wrap rc-stage"
            data-step={shuffled ? "shuffle" : split ? "split" : cracking ? "crack" : t >= C.chantAt ? "chant" : t >= C.dropAt ? "drop" : t >= C.leapAt ? "leap" : t >= C.riseAt ? "rage" : t >= C.drainAt ? "drain" : "king"}
          >
            {/* (The four boards from the start, each clipped to its quarter: together they are the whole board until they
                part, so the split mounts nothing new on a slow phone.) */}
            {QUARTER_BOARD.map((id, q) => (
              <div key={q} class={`rc-cell rc-split rc-q${q}`} style={quarterStyle(q, t)}>
                <Board fen={shuffled ? v.boards[id]!.fen : v.from} orientation="white" silent />
              </div>
            ))}
            {cracking && (
              <>
                <span class="rc-crack">
                  <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < C.partAt ? "run" : "part"} then="gap" since={at + (t < C.partAt ? C.crackAt : C.partAt)} sounds={EFFECTS.boardGap.sounds} id="rc-v" />
                </span>
                <span class="rc-crack rc-crack-h">
                  <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < C.partAt ? "run" : "part"} then="gap" since={at + (t < C.partAt ? C.crackAt : C.partAt)} id="rc-h" />
                </span>
              </>
            )}
            {light > 0 && (
              <>
                {/* The light pouring up out of the book: behind him a pulsing cone of it, in front a glow on the pages. */}
                <span class="rc-light" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y - 1}%`, opacity: String(light), transform: `scaleY(${0.3 + 0.7 * light})` }} />
                <span class="rc-glow" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y - 1}%`, opacity: String(light) }} />
              </>
            )}
            {flying && <span class="rc-shadow" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y}%` }} />}
            {fig && (
              <span
                class="rc-fig"
                data-anim={fig.anim}
                style={{ width: `${FIG_W}%`, transform: `translate(${(fig.feet.x - (FIG_W * RECLUSE.foot[0]) / RECLUSE.w).toFixed(2)}cqw, ${(fig.feet.y - (FIG_H * RECLUSE.foot[1]) / RECLUSE.h).toFixed(2)}cqw)` }}
              >
                <SpriteAnim ch={RECLUSE} anim={fig.anim} then={fig.then} since={fig.since} sounds={BOSS_KITS["Hidden Boss"]!.sounds} id="rc-fig" onFrame={onFigFrame} />
                <EngineOverlay ch={RECLUSE} elRef={figEngine} on />
              </span>
            )}
            {t >= C.arcAt && t < C.arcEnd + ARC_LIFE && <Arcs t={t} hands={CHANT_HANDS} />}
            {t >= C.bannerAt && <FightBanner text="PHASE 2" sub="Chess960 · win all four boards" tone="boss" sound="bannerStart" />}
          </div>
        </div>
      </div>
      {t >= C.drainAt - 50 && t < C.igniteAt + 500 && <AbsorbStream t={t} />}
      <BossDock
        match={match}
        side="w"
        king={absorbKing(t, at)}
        // (No move is anyone's during the phase change: no clock.)
        clock={null}
        status={
          <>
            <span class="dock-line">
              <strong>
                {t < C.drainAt ? "The God King triumphs!" : t < C.goneAt ? "He's draining the God King!" : t < C.chantAt ? "The boss rises!" : t < C.bannerAt ? "One board becomes four…" : "Phase 2!"}
              </strong>
            </span>
            <span class="dock-line muted">{t >= C.igniteAt && t < C.chantAt ? "Mind and engine, one." : t < C.bannerAt ? "" : "Every board must be won."}</span>
          </>
        }
      />
    </div>
  );
}

/** m:ss. */
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const RESULT_WORD = (b: SimulBoardView) => {
  const r = b.result!;
  if (r.winner === "draw") return "Draw";
  const how = r.how === "time" ? " on time" : r.how === "resign" ? ": resigned" : "";
  return r.winner === "crowd" ? "Won" : `Lost${how}`;
};

/** A board's tag over its corner: who plays it and their clock (or its result). */
function Tag({ b, v, now, small }: { b: SimulBoardView; v: SimulView; now: number; small?: boolean }) {
  // (His ultimate: the move's own few seconds, not the bank.)
  const left = moveLeft(v, b, now);
  const running = v.playing && b.toMove === "crowd";
  const low = running && left < (v.ultAt !== null ? 2_000 : 15_000);
  return (
    <span class={`rc-tag${b.you ? " you" : ""}${running ? " running" : ""}${low ? " low" : ""}`}>
      {/* (A phone's small boards: the clock only; the board's button says whose it is.) */}
      {!small && <span class="rc-tag-name">{b.name} </span>}
      <span class="rc-tag-clock">{clock(left)}</span>
    </span>
  );
}

function Outcome({ b }: { b: SimulBoardView }) {
  if (!b.result) return null;
  return <span class={`rc-result ${b.result.winner === "crowd" ? "won" : b.result.winner === "boss" ? "lost" : "draw"}`}>{RESULT_WORD(b)}</span>;
}

/** How long a slow move's board flashes its marks and shows its note (ms). */
const SLOW_NOTE_MS = 1800;
/** A pixel X (5 x 5) in a 7 x 7 cell. */
const X_PIXELS = [[1, 1], [5, 1], [2, 2], [4, 2], [3, 3], [2, 4], [4, 4], [1, 5], [5, 5]] as const;

/**
 * The team's slow moves (Eric, Oct 14): a slot each up to his ultimate (RECLUSE_PHASE2.slowMovesForUlt), a red pixel X
 * for each slow move so far, the rest dim; in a column by the right edge of your board only (Eric, Oct 14: the count is the
 * team's, the same on every board, so once is enough), as Jefferson's candle shots stand beside his. On a phone, by the
 * big board (yours, or the one you're watching). They flash at every slow move, whoever's.
 */
function SlowMarks({ n, flash }: { n: number; flash: boolean }) {
  const of = RECLUSE_PHASE2.slowMovesForUlt;
  const cells = Array.from({ length: of }, (_, i) => {
    return (
      <g key={i} transform={`translate(0 ${i * 8})`}>
        <rect width="7" height="7" class="rc-slow-cell" />
        {i < n ? X_PIXELS.map(([px, py]) => <rect key={`${px}${py}`} x={px} y={py} width="1" height="1" class="rc-slow-x" />) : <rect x="2" y="2" width="3" height="3" class="rc-slow-empty" />}
      </g>
    );
  });
  return (
    <span class={`rc-slow col${flash ? " flash" : ""}`} role="img" aria-label={`Slow moves: ${n} of ${of}`} data-slow={n}>
      <span class="rc-slow-label" aria-hidden="true">
        slow
      </span>
      <svg viewBox={`0 0 7 ${of * 8 - 1}`} shape-rendering="crispEdges" aria-hidden="true">
        {cells}
      </svg>
    </span>
  );
}

/** One phase 2 board: yours takes moves on your turn. `marks`: the team's slow moves beside it (one board shows them). */
function SimulBoard({ match, v, b, now, small, marks: withMarks, children }: { match: GameView; v: SimulView; b: SimulBoardView; now: number; small?: boolean; marks?: boolean; children?: ComponentChildren }) {
  const mine = b.you && v.playing && b.toMove === "crowd";
  const recent = !!v.lastSlow && now - v.lastSlow.at < SLOW_NOTE_MS;
  // (The note marks the board the slow move was on; the marks flash at any slow move.)
  const flash = recent && v.lastSlow!.board === b.id;
  const n = Math.min(v.slow, RECLUSE_PHASE2.slowMovesForUlt);
  // (The same element while its count and flash stand: the screen draws every frame, the marks only when they change.)
  const marks = useMemo(() => <SlowMarks n={n} flash={recent} />, [n, recent]);
  return (
    <Board fen={b.fen} orientation="white" lastMove={b.lastMove} interactive={mine} onMove={(m) => match.simulMove?.(b.id, m)} small={small} silent={!b.you}>
      <Tag b={b} v={v} now={now} small={small} />
      <Outcome b={b} />
      {v.playing && withMarks && marks}
      {/* (Which board the last slow move was on: a small note over its top-right corner, for a moment.) */}
      {flash && <span class="rc-slow-note">slow move</span>}
      {children}
    </Board>
  );
}

/** His phase 2: four boards at once. */
export function SimulScreen({ match }: { match: GameView }) {
  const v = match.simul;
  const now = useFrameNow();
  const computer = useMedia(COMPUTER_LAYOUT);
  const [watch, setWatch] = useState(0);
  if (!v) return null;
  const mine = v.boards[0]!;
  const big = v.boards.find((b) => b.id === watch) ?? mine;
  const others = v.boards.filter((b) => b.id !== big.id);
  const yourTurn = v.playing && mine.toMove === "crowd";
  // His ultimate as it comes: "5 SECONDS!" over the boards.
  // (On every board at once, held a second longer than a banner usually is; nobody waits for it: the 5 s start now.)
  const ultOn = v.ultAt !== null && now - v.ultAt < PHASE2_ULT_BANNER_MS;
  const ultBanner = ultOn && <FightBanner text={`${RECLUSE_PHASE2.ultMoveSeconds} SECONDS!`} sub="A move every 5 s, or a random one" tone="boss" sound="bannerStart" long />;

  const status = v.decided
    ? v.beaten
      ? "All four boards won!"
      : `${v.won} of ${v.of} won: the boss wins`
    : mine.result
      ? `Your board: ${RESULT_WORD(mine).toLowerCase()}. The others play on.`
      : yourTurn
        ? "Your move"
        : "The boss is thinking…";
  return (
    <div class={`screen game boss-screen rc-simul ${computer ? "rc-desk" : "rc-phone"}${ultOn ? " rc-ult" : ""}`}>
      <Hud match={match} />
      {!computer && (
        <div class="rc-minis" role="list" aria-label="The other boards">
          {others.map((b) => (
            <button type="button" key={b.id} role="listitem" class={`rc-mini${b.you ? " you" : ""}`} aria-label={b.you ? "Back to your board" : `Watch ${b.name}'s board`} onClick={() => setWatch(b.id)}>
              <SimulBoard match={match} v={v} b={b} now={now} small />
            </button>
          ))}
        </div>
      )}
      <div class="board-area">
        <div class="opening-name">
          <BossHeading side="w" note={`Chess960 · ${v.won} of ${v.of} won`} />
        </div>
        <div class="board-row">
          <BossSide match={match} />
          <div class="eval-bar rc-evalgap" aria-hidden="true" />
          {computer ? (
            <div class="board-wrap rc-stage">
              {QUARTER_BOARD.map((id, q) => (
                <div key={q} class={`rc-cell rc-q${q} rc-played`}>
                  <SimulBoard match={match} v={v} b={v.boards[id]!} now={now} marks={v.boards[id]!.you} />
                </div>
              ))}
              {ultBanner}
            </div>
          ) : (
            <SimulBoard key={big.id} match={match} v={v} b={big} now={now} marks>
              {ultBanner}
            </SimulBoard>
          )}
        </div>
      </div>
      <BossDock
        match={match}
        side="w"
        king="gone"
        // Your board's clock at the box's right: its bank (from his ultimate, the few seconds a move) running on your move,
        // holding while he answers; none once your board is decided or before the clocks start.
        clock={mine.result || !v.playing ? null : yourTurn && mine.turnAt !== null ? { startsAt: mine.turnAt, deadline: mine.turnAt + (v.ultAt !== null ? RECLUSE_PHASE2.ultMoveSeconds * 1000 : mine.bankMs) } : undefined}
        status={
          <>
            <span class="dock-line">
              <strong>{status}</strong>
            </span>
            <span class="dock-line muted">
              {!computer && big.id !== mine.id ? (
                <button type="button" class="rc-back" onClick={() => setWatch(mine.id)}>
                  Back to my board
                </button>
              ) : mine.result ? (
                ""
              ) : v.ultAt !== null ? (
                // (His ultimate: a few seconds a move, then a random one is played for you; the seconds are your clock.)
                `${RECLUSE_PHASE2.ultMoveSeconds} s a move, or a random one`
              ) : (
                // (The slow moves themselves: the marks beside every board; your time: the clock at the box's right.)
                ""
              )}
            </span>
          </>
        }
      />
    </div>
  );
}
