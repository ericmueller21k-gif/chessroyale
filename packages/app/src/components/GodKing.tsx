import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { GOD_KING, GOD_KING_BOX, GOD_KING_PORTRAIT, KING_TIP, commandMoment, kingFrameAt, summonMoment, type GodKingAnim } from "../characters/god-king.ts";
import { renderFrame, type Frame } from "../characters/sprite.ts";
import { useFrameNow } from "./Countdown.tsx";
import { KING_COMMAND, KING_SUMMON, pieceAt } from "@chessroyale/chess";
import { play, type SoundName } from "../sound.ts";
import { equippedLook } from "@chessroyale/core";
import { account } from "../account.ts";

/** Your equipped God King effect (from the shop) as CSS colours for his bolts, beam and glow. */
export function kingEffectStyle(): Record<string, string> {
  const look = equippedLook(account().profile?.shop, "king");
  return { "--ks-bolt": look.bolt!, "--ks-glow": look.glow!, "--ks-beam": look.beam! };
}

/** Each frame of his drawn once per look (white or black armour). */
const images = { w: new WeakMap<Frame, ImageData>(), b: new WeakMap<Frame, ImageData>() };
function frameImage(side: "w" | "b", frame: Frame): ImageData {
  let img = images[side].get(frame);
  if (!img) {
    const r = renderFrame(GOD_KING, frame, { look: side === "b" ? "black" : undefined });
    img = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    images[side].set(frame, img);
  }
  return img;
}

/** Placing his frame: his drawing space (one board square) fills the box's height, his feet at its bottom centre. */
const BOX_STYLE = {
  "--gk-w": GOD_KING.w,
  "--gk-h": GOD_KING.h,
  "--gk-ox": GOD_KING_BOX.x,
  "--gk-oy": GOD_KING_BOX.y,
  "--gk-s": GOD_KING_BOX.size,
} as Record<string, number>;

/**
 * The God King: a holy knight in white plate (dark steel for Black) with gold trim, a winged crown-helmet, a flaming
 * gold sword, a blue tabard and a torn white cape, drawn as pixel art from parts (characters/god-king.ts). `anim`
 * plays once from `since` (then `then` loops) or, for a loop, runs by the clock. The box sized by CSS is his
 * drawing space, one board square; his sword and cape reach outside it without ever taking a tap.
 */
export function GodKingSprite({ side, anim = "idle", since = 0, then, class: cls = "" }: { side: "w" | "b"; anim?: GodKingAnim; since?: number; then?: GodKingAnim; class?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  // Drawn before the paint (no empty first frame), then whenever the picture changes.
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    let raf = 0;
    let last = "";
    const draw = () => {
      const s = kingFrameAt(anim, Date.now(), since, then);
      const id = `${s.anim}:${s.frame}`;
      if (id !== last) {
        last = id;
        g.putImageData(frameImage(side, GOD_KING.anims[s.anim]!.frames[s.frame]!), 0, 0);
        box.current?.setAttribute("data-anim", s.anim);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [side, anim, since, then]);
  return (
    <span ref={box} class={`god-king ${cls}`} data-anim={anim} style={BOX_STYLE} aria-hidden="true">
      <canvas ref={cv} class="gk-canvas" width={GOD_KING.w} height={GOD_KING.h} />
    </span>
  );
}

/**
 * The God King fallen (after his Last Stand): on his side, his armour cracked, his eyes dark, his crown rolled off
 * and his sword's flame down to embers. Greyed in the dock for the rest of the battle.
 */
export function GodKingFallen({ side, class: cls = "" }: { side: "w" | "b"; class?: string }) {
  return <GodKingSprite side={side} anim="fallen" class={`fallen ${cls}`} />;
}

/** Centre of a square on the board in a 0-800 coordinate space, from the given side. */
export function squareXY(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

/** A thin jagged bolt from (x1, y1) to (x2, y2); `amp`: how far it zigzags (in the board's 0-800 units by default). */
function boltPath(x1: number, y1: number, x2: number, y2: number, seed: number, amp = 46) {
  const steps = 6;
  let d = `M${x1} ${y1}`;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const jitter = (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * amp * (1 - t * 0.6);
    d += ` L${x1 + (x2 - x1) * t + (nx / len) * jitter} ${y1 + (y2 - y1) * t + (ny / len) * jitter}`;
  }
  return `${d} L${x2} ${y2}`;
}

/** The square a side's king stands on. */
export function kingSquare(fen: string, side: "w" | "b"): string | null {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const p = pieceAt(fen, `${f}${r}`);
    if (p?.type === "k" && p.color === side) return `${f}${r}`;
  }
  return null;
}

/** Summoned onto the board (settings.kingOnBoard): his cut-in banner from when he raises his sword, for this long. */
const KING_CUT_AT = KING_SUMMON.cutAt;
const KING_CUT_MS = KING_SUMMON.cutMs;
/** The strike's three slashes: when each lands (ms after the summon starts). */
const SLASH_AT = KING_SUMMON.slashAt;
/** His bolt to the piece he moves (ms after the summon starts). */
const BOLT_AT = KING_SUMMON.boltAt;

/** `hp` in three slashes (10: 3, 3, 4). */
export function slashes(hp: number): number[] {
  const each = Math.floor(hp / 3);
  return [each, each, hp - 2 * each];
}

/** Where the converging bolts start: points around the board's edge. */
const EDGE = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.3;
  return { x: 400 + Math.cos(a) * 560, y: 400 + Math.sin(a) * 560 };
});

/**
 * The old way, kept for later behind settings.kingOnBoard (unused since Eric's Oct 9 polish: see KingCommand).
 * Summoning the God King on your king's square. A dozen thin bolts converge on
 * the square, a beam of light, a flash, and the God King lands there in your
 * king's place (the real king is hidden while he's on the board).
 * He raises his flaming sword, then either points it and a thin bolt leaves its
 * tip for the piece he moves ("move", which then plays at `moveAt`), or he cuts
 * once for each of three slashes on the boss's king, a bolt from his raised
 * blade before each ("strike", each with its own sound and a yellow "−N" adding
 * up to `hp`). At `exitAt` holy light takes him away on whatever square he's
 * on, and the plain king drops back there. All times are Date.now() values.
 */
export function KingSummon({
  side,
  orientation,
  kingBefore,
  kingAfter,
  target,
  mode,
  hp,
  startAt,
  moveAt,
  exitAt,
  san,
  piece,
  bossIcon,
}: {
  side: "w" | "b";
  orientation: "white" | "black";
  /** Your king's square when he arrives, and after the move (the same unless the king itself moves). */
  kingBefore: string;
  kingAfter: string;
  target: string | null;
  mode: "move" | "strike";
  hp?: number;
  startAt: number;
  moveAt: number;
  exitAt: number;
  /** For the cut-in: the move in SAN and the piece he moves, or the boss's face for a strike. */
  san?: string;
  piece?: "p" | "n" | "b" | "r" | "q" | "k";
  bossIcon?: ComponentChildren;
}) {
  const now = useFrameNow();
  const t = now - startAt;
  const out = now - exitAt;
  const square = now >= moveAt ? kingAfter : kingBefore;
  const k = squareXY(square, orientation);
  const k0 = squareXY(kingBefore, orientation);
  const tg = target ? squareXY(target, orientation) : null;
  const present = t >= 1300 && out < 700;
  // His own moves on the board: appear, raise the sword, then point it for his bolt or cut once per slash.
  const moment = summonMoment({ appearAt: 1300, raiseAt: KING_CUT_AT, boltAt: mode === "move" && target ? BOLT_AT : undefined, slashAt: mode === "strike" && target ? SLASH_AT : undefined }, t);
  // His bolts leave from his sword's tip: pointed for the move, held up for the strike.
  const tip = (at: readonly [number, number]) => ({ x: k0.x - 50 + at[0] * 100, y: k0.y - 50 + at[1] * 100 });
  const boltFrom = tip(KING_TIP.point);
  const strikeFrom = tip(KING_TIP.raised);
  const strike = mode === "strike";
  const hits = slashes(hp ?? 10);
  // His sounds, in time with the animation.
  useEffect(() => {
    const cues: [SoundName, number][] = [
      ["gkSummon", startAt],
      ["gkAppear", startAt + 1250],
      ["gkHyuah", startAt + 1550],
      ["gkCutIn", startAt + KING_CUT_AT + 60],
      ...(strike
        ? SLASH_AT.map((at, i) => [i === 2 ? "gkHit" : "gkSlash", startAt + at - 20] as [SoundName, number])
        : tg
          ? ([["gkBolt", startAt + BOLT_AT + 10]] as [SoundName, number][])
          : []),
      ...(strike ? ([["gkSlash", startAt + SLASH_AT[2]! - 40]] as [SoundName, number][]) : []),
      ["gkLeave", exitAt],
    ];
    // Cues already past (a screen shown partway through) stay silent.
    const timers = cues.filter(([, at]) => at > Date.now() - 300).map(([name, at]) => setTimeout(() => play(name), Math.max(0, at - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (out > 900) return null;
  const pct = (v: number) => `${v / 8}%`;
  const hideClass = present ? ` hide-king-${side}` : "";
  return (
    <div class={`king-summon ${mode}${hideClass}`} style={kingEffectStyle()} aria-label={mode === "move" ? "The God King plays the move" : "The God King strikes the boss"}>
      <svg class="ks-fx" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="ks-glow">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="1" />
            <stop offset="1" style={{ stopColor: "var(--ks-glow, #ffe08a)" }} stop-opacity="0" />
          </radialGradient>
          <linearGradient id="ks-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffbe6" stop-opacity="0" />
            <stop offset="1" style={{ stopColor: "var(--ks-beam, #fff3c4)" }} stop-opacity="0.95" />
          </linearGradient>
        </defs>
        {/* A dozen thin bolts converging on your king, faster and faster. */}
        {t < 1250 &&
          EDGE.map((e, i) => {
            const at = 950 * (1 - Math.pow(1 - i / EDGE.length, 1.6));
            const age = t - at;
            if (age < 0 || age > 170) return null;
            return <path key={i} class="ks-bolt" d={boltPath(e.x, e.y, k0.x, k0.y, i + 7)} style={{ opacity: 1 - age / 170 }} />;
          })}
        {/* The beam down onto the square, then the flash. */}
        {t >= 900 && t < 1300 && <rect x={k0.x - 26} y={0} width={52} height={k0.y + 40} fill="url(#ks-beam)" style={{ opacity: Math.min(1, (t - 900) / 150) * (t > 1200 ? (1300 - t) / 100 : 1) }} />}
        {t >= 1200 && t < 1550 && <circle cx={k0.x} cy={k0.y} r={70 + (t - 1200) / 4} fill="url(#ks-glow)" style={{ opacity: 1 - (t - 1200) / 350 }} />}
        {/* His bolt to the piece he moves. */}
        {!strike && tg && t >= BOLT_AT && t < BOLT_AT + 300 && <path class="ks-bolt strike" d={boltPath(boltFrom.x, boltFrom.y, tg.x, tg.y, 13)} style={{ opacity: t < BOLT_AT + 150 ? 1 : (BOLT_AT + 300 - t) / 150 }} />}
        {!strike && tg && t >= BOLT_AT + 50 && t < BOLT_AT + 450 && <circle class="ks-hit" cx={tg.x} cy={tg.y} r={20 + (t - BOLT_AT - 50) / 8} style={{ opacity: 1 - (t - BOLT_AT - 50) / 400 }} />}
        {/* The strike: three quick slashes on the boss's king, each a flash of his bolt and a cut across the square. */}
        {strike &&
          tg &&
          SLASH_AT.map((at, i) => {
            const age = t - at;
            if (age < -60 || age > 380) return null;
            // Alternate the cut's direction: \, /, then straight across.
            const dir = [
              [-1, -1, 1, 1],
              [1, -1, -1, 1],
              [-1, 0, 1, 0],
            ][i]!;
            const r = 46;
            const sweep = Math.min(1, Math.max(0, (age + 60) / 110));
            const x1 = tg.x + dir[0]! * r;
            const y1 = tg.y + dir[1]! * r;
            const x2 = x1 + (tg.x + dir[2]! * r - x1) * sweep;
            const y2 = y1 + (tg.y + dir[3]! * r - y1) * sweep;
            const fade = age < 160 ? 1 : Math.max(0, 1 - (age - 160) / 220);
            return (
              <g key={i}>
                {age < 120 && <path class="ks-bolt strike" d={boltPath(strikeFrom.x, strikeFrom.y, tg.x, tg.y, 21 + i)} style={{ opacity: age < 0 ? 0.6 : 1 - age / 120 }} />}
                <line class="ks-slash" x1={x1} y1={y1} x2={x2} y2={y2} style={{ opacity: fade }} />
                {age >= 0 && <circle class="ks-hit" cx={tg.x} cy={tg.y} r={18 + age / 7} style={{ opacity: Math.max(0, 1 - age / 380) }} />}
              </g>
            );
          })}
        {/* Leaving: a column of holy light on his square. */}
        {out >= 0 && out < 500 && <rect x={k.x - 40} y={0} width={80} height={k.y + 50} fill="url(#ks-beam)" style={{ opacity: out < 150 ? out / 150 : (500 - out) / 350 }} />}
      </svg>
      {present && (
        <div
          class={`ks-god${out >= 0 ? " leaving" : ""}`}
          style={{ left: pct(k.x - 50), top: pct(k.y - 50), opacity: out >= 0 ? Math.max(0, 1 - out / 400) : Math.min(1, (t - 1300) / 150) }}
        >
          <GodKingSprite side={side} anim={moment.anim} since={startAt + moment.at} then={moment.then} />
        </div>
      )}
      {out >= 350 && out < 900 && (
        <span class="ks-plain cg-wrap" style={{ left: pct(k.x - 50), top: pct(k.y - 50) }} aria-hidden="true">
          <piece class={`${side === "w" ? "white" : "black"} king`} />
        </span>
      )}
      {t >= KING_CUT_AT && t < KING_CUT_AT + KING_CUT_MS && <KingCutIn mode={mode} side={side} san={san} piece={piece} bossIcon={bossIcon} />}
      {strike &&
        tg &&
        SLASH_AT.map((at, i) =>
          t >= at && t < at + 1000 ? (
            <span key={i} class="ks-hp" style={{ left: pct(tg.x + (i - 1) * 34), top: pct(tg.y - 10 + i * 6) }}>
              −{hits[i]}
            </span>
          ) : null,
        )}
    </div>
  );
}

/**
 * The God King acting from his spot by the board (Eric, Oct 9, 2026; KING_COMMAND): he stays in the dock, raises his
 * sword there (`kingCommandAct` drives his figure), his cut-in sweeps over the board, then a bolt leaves his blade for
 * the piece he moves ("move": the screen plays it at KING_COMMAND.moveAt), or three bolts and slashes land on the
 * boss's king ("strike", each with a yellow "−N" adding up to `hp`). The bolts cross from the dock to the board, so
 * they're drawn over the whole page (in its coordinates, measured from his figure and the board); the cut-in stays on
 * the board. `startAt` is a Date.now() value.
 */
export function KingCommand({
  side,
  orientation,
  target,
  mode,
  hp,
  startAt,
  san,
  piece,
  bossIcon,
}: {
  side: "w" | "b";
  orientation: "white" | "black";
  /** The piece he moves (its square), or the boss's king for a strike. */
  target: string;
  mode: "move" | "strike";
  hp?: number;
  startAt: number;
  san?: string;
  piece?: "p" | "n" | "b" | "r" | "q" | "k";
  bossIcon?: ComponentChildren;
}) {
  const now = useFrameNow();
  const t = now - startAt;
  const strike = mode === "strike";
  const C = KING_COMMAND;
  const endAt = strike ? C.strikeLowerAt + 700 : C.lowerAt + 300;
  const ref = useRef<HTMLDivElement>(null);
  // Where his sword's tip is (pointed and raised) and the target square, in the page's pixels. Measured as he starts
  // and when the page changes size or scrolls (his figure and the board don't move otherwise).
  const [geo, setGeo] = useState<{ point: Xy; raised: Xy; at: Xy; u: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const board = ref.current?.closest(".board-wrap")?.querySelector("cg-board")?.getBoundingClientRect();
      const him = document.querySelector(".gk-unit .gk-unit-btn .god-king")?.getBoundingClientRect();
      if (!board || !him || !board.width) return setGeo(null);
      const tip = ([x, y]: readonly [number, number]): Xy => ({ x: him.left + x * him.width, y: him.top + y * him.height });
      const sq = squareXY(target, orientation);
      setGeo({ point: tip(KING_TIP.point), raised: tip(KING_TIP.raised), at: { x: board.left + (sq.x / 800) * board.width, y: board.top + (sq.y / 800) * board.height }, u: board.width / 800 });
    };
    measure();
    addEventListener("resize", measure);
    addEventListener("scroll", measure, true);
    return () => {
      removeEventListener("resize", measure);
      removeEventListener("scroll", measure, true);
    };
  }, [target, orientation]);
  const hits = slashes(hp ?? 10);
  // His sounds, in time with his figure: the sword raised, the cut-in, the bolt or the slashes.
  useEffect(() => {
    const cues: [SoundName, number][] = [
      ["gkHyuah", startAt + C.raiseAt],
      ["gkCutIn", startAt + C.cutAt + 60],
      ...(strike
        ? [...C.slashAt.map((at, i) => [i === 2 ? "gkHit" : "gkSlash", startAt + at - 20] as [SoundName, number]), ["gkSlash", startAt + C.slashAt[2]! - 40] as [SoundName, number]]
        : ([["gkBolt", startAt + C.boltAt + 10]] as [SoundName, number][])),
    ];
    // Cues already past (a screen shown partway through) stay silent.
    const timers = cues.filter(([, at]) => at > Date.now() - 300).map(([name, at]) => setTimeout(() => play(name), Math.max(0, at - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (t > endAt) return null;
  const g = geo;
  const fx = g ? (
    <div class="king-command-fx" style={kingEffectStyle()} aria-hidden="true">
      <svg class="kc-fx">
        {/* His bolt to the piece he moves. */}
        {!strike && t >= C.boltAt && t < C.boltAt + 300 && (
          <path class="ks-bolt" d={boltPath(g.point.x, g.point.y, g.at.x, g.at.y, 13, 46 * g.u)} style={{ strokeWidth: Math.max(2, 3.5 * g.u * 1.6), opacity: t < C.boltAt + 150 ? 1 : (C.boltAt + 300 - t) / 150 }} />
        )}
        {!strike && t >= C.boltAt + 50 && t < C.boltAt + 450 && (
          <circle class="ks-hit" cx={g.at.x} cy={g.at.y} r={(20 + (t - C.boltAt - 50) / 8) * g.u} style={{ strokeWidth: 3 * g.u, opacity: 1 - (t - C.boltAt - 50) / 400 }} />
        )}
        {/* The strike: three quick slashes on the boss's king, each a bolt from his raised blade and a cut across the square. */}
        {strike &&
          C.slashAt.map((at, i) => {
            const age = t - at;
            if (age < -60 || age > 380) return null;
            // Alternate the cut's direction: \, /, then straight across.
            const dir = [
              [-1, -1, 1, 1],
              [1, -1, -1, 1],
              [-1, 0, 1, 0],
            ][i]!;
            const r = 46 * g.u;
            const sweep = Math.min(1, Math.max(0, (age + 60) / 110));
            const x1 = g.at.x + dir[0]! * r;
            const y1 = g.at.y + dir[1]! * r;
            const x2 = x1 + (g.at.x + dir[2]! * r - x1) * sweep;
            const y2 = y1 + (g.at.y + dir[3]! * r - y1) * sweep;
            const fade = age < 160 ? 1 : Math.max(0, 1 - (age - 160) / 220);
            return (
              <g key={i}>
                {age < 120 && <path class="ks-bolt strike" d={boltPath(g.raised.x, g.raised.y, g.at.x, g.at.y, 21 + i, 46 * g.u)} style={{ strokeWidth: Math.max(2, 3 * g.u * 1.6), opacity: age < 0 ? 0.6 : 1 - age / 120 }} />}
                <line class="ks-slash" x1={x1} y1={y1} x2={x2} y2={y2} style={{ strokeWidth: 7 * g.u, opacity: fade }} />
                {age >= 0 && <circle class="ks-hit" cx={g.at.x} cy={g.at.y} r={(18 + age / 7) * g.u} style={{ strokeWidth: 3 * g.u, opacity: Math.max(0, 1 - age / 380) }} />}
              </g>
            );
          })}
      </svg>
      {strike &&
        C.slashAt.map((at, i) =>
          t >= at && t < at + 1000 ? (
            <span key={i} class="ks-hp" style={{ left: `${g.at.x + (i - 1) * 34 * g.u}px`, top: `${g.at.y + (-10 + i * 6) * g.u}px` }}>
              −{hits[i]}
            </span>
          ) : null,
        )}
    </div>
  ) : null;
  return (
    <div ref={ref} class={`king-command ${mode}`} aria-label={mode === "move" ? "The God King plays the move" : "The God King strikes the boss"}>
      {t >= C.cutAt && t < C.cutAt + C.cutMs && <KingCutIn mode={mode} side={side} san={san} piece={piece} bossIcon={bossIcon} />}
      {fx && createPortal(fx, document.body)}
    </div>
  );
}
type Xy = { x: number; y: number };

/** His figure in the dock while he commands from his spot (KingCommand): the animation, from when, and what loops after. */
export function kingCommandAct(mode: "move" | "strike", startAt: number, now: number): { anim: GodKingAnim; since: number; then: GodKingAnim } | undefined {
  const C = KING_COMMAND;
  const t = now - startAt;
  if (t < 0 || t > (mode === "strike" ? C.strikeLowerAt : C.lowerAt) + 1000) return undefined;
  const m = commandMoment({ raiseAt: C.raiseAt, lowerAt: mode === "strike" ? C.strikeLowerAt : C.lowerAt, ...(mode === "strike" ? { slashAt: C.slashAt } : { boltAt: C.boltAt }) }, t);
  return m.anim === "idle" ? undefined : { anim: m.anim, since: startAt + m.at, then: m.then };
}

/**
 * The God King's portrait for his banners, from his drawing: crown and helm, eyes blazing and the
 * flaming sword raised beside him; `hurt`, battle-worn for his Last Stand (cracked, eyes dimmed, the flame low).
 * Scaled up with crisp pixels; his armour in the crowd's colour.
 */
export function GodKingPortrait({ side, hurt = false }: { side: "w" | "b"; hurt?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const p = GOD_KING_PORTRAIT;
  useLayoutEffect(() => {
    const frame = GOD_KING.anims[hurt ? "portraitHurt" : "portrait"]!.frames[0]!;
    cv.current?.getContext("2d")?.putImageData(frameImage(side, frame), -p.x, -p.y, p.x, p.y, p.w, p.h);
  }, [side, hurt]);
  return <canvas ref={cv} class="gk-portrait" width={p.w} height={p.h} aria-hidden="true" />;
}

const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;

/**
 * The God King's cut-in, like a Fire Emblem critical: as he raises his sword a
 * band sweeps across the board with his portrait on the left, what he's doing
 * in the middle (the move, or STRIKE!) and its target on the right (the piece
 * he moves, or the boss's face).
 */
export function KingCutIn({
  mode,
  side,
  san,
  piece,
  bossIcon,
}: {
  mode: "move" | "strike";
  side: "w" | "b";
  san?: string;
  piece?: keyof typeof PIECE_NAMES;
  bossIcon?: ComponentChildren;
}) {
  return (
    <div class="fight-banner king-cut" role="alert" aria-label={mode === "move" ? `The God King plays ${san}` : "The God King strikes"}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        <span class="kc-portrait">
          <GodKingPortrait side={side} />
        </span>
        <span class="fb-words kc-words">
          <span class="kc-label">God King</span>
          <span class="fb-text kc-text">{mode === "move" ? san : "STRIKE!"}</span>
        </span>
        {mode === "move" && piece ? (
          <span class="kc-target cg-wrap">
            <piece class={`${side === "w" ? "white" : "black"} ${PIECE_NAMES[piece]}`} />
          </span>
        ) : (
          <span class="kc-target kc-boss">{bossIcon}</span>
        )}
      </div>
    </div>
  );
}
