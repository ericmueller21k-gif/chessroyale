import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { BOSS_POWERS } from "@chessroyale/core";
import { HOOPS_BEATS, TIGER_ANIM } from "@chessroyale/chess";
import { pickLine } from "../characters/boss-beats.ts";
import { bossKit, type BossKit } from "../characters/kits.ts";
import { EFFECTS } from "../characters/power-art.ts";
import { HOP_AIR_AT, HOP_AIR_MS } from "../characters/tiger-figure.ts";
import { BALLOON_SHAPES, PUMP_FOOT, PUMP_H, PUMP_PALETTE, PUMP_W, RELEASE_KNOT, TIGER_PUMP, balloonDrawing, balloonLooks, balloonPartOf } from "../characters/tiger-bar.ts";
import { LAND_Y } from "../characters/effects/tiger.ts";
import type { Character } from "../characters/sprite.ts";
import { boardSize } from "../board/logic.ts";
import type { SoundName } from "../sound.ts";
import type { BossView } from "../game.ts";
import { gardenNow, realMs } from "../garden-clock.ts";
import { NORMAL, bossVoice } from "../speech.tsx";
import { FLY_MS, LAND_MS, colorLook, flyAnim, landAnim, landBeats, noteTiger, popReactAt, pumpShows, ringShows, type EndShow, type TigerShow } from "../tiger-show.ts";
import { SpriteAnim, prewarm, prewarmSprite } from "./BossEffect.tsx";
import { figureBusy, playInPlace, type FigureMove } from "./BossCharacter.tsx";
import type { BoardLayerProps, BossUi, Moment, MomentProps, MomentUi } from "./PowerParts.tsx";

/**
 * Babur's, the circus tiger's, powers on screen (his rules: packages/chess/src/bosses/tiger.ts; docs/decisions/2026-10-23-tiger-rules.md
 * and 2026-10-24-tiger-wired.md), all from the shared state and the battle's clock (tiger-show.ts), so everyone online sees the same:
 * - **The pump** (BossUi.barProp: a phone's at the right end of the boss bar's free room, 2x; a computer's as big as the board's
 *   balloons, beside his figure by the board, or in a taller bar where there's no room there: `pumpPlace`): the nozzle bare
 *   when none; else the balloon at the stage the battle's clock gives, the pump's `grow` (a plunger stroke and the balloon's puff) as
 *   each stage comes, a gentle bob once ready. It waits for the next stage's time: no timer redraws it every frame. Hidden, nothing
 *   plays; back, it shows the stage it's at.
 * - **place** (the start of his turn): on a phone his `hop` along the bar to the pump (its airborne frame held while he travels),
 *   `place` there (the pump's `put` at its `touch`) and the hop back; on a computer `place` where he stands, a small limp balloon
 *   arcing from his paw to the pump. Busy with another animation, he skips it; the pump still gets its balloon.
 * - **balloonLand** (as your turn begins): the pump's `release`, the balloon flying to its square, `land<Piece>` there, his piece on
 *   at its `poof` (the board leaves it off until then: tiger-show.ts `balloonFen`); then his cheer (a big one for a queen). **pop**:
 *   the pump's `pop`, then his wince. None of these holds a move.
 * - **hoops** (after his move, as your turn after it begins, once his move has shown): the HOOPS! banner, a boss banner's whole
 *   length with nothing under it; then his `hoops` at the board's corner, and at each `throwN` a burning hoop flies from his paw to
 *   its block and its ring lands there. A balloon landing (or popping) the same turn plays after the cast, never under it. The rings burn from the view's `hoops` (`left` 2: `burn`, 1: `dying`) and go
 *   `out` as `hoopsOut` comes (as your second move lands). A reload draws them as they are, never the cast again.
 */

type Orientation = "white" | "black";

/** A square's column and row on screen (0 at the top left). */
const cellOf = (square: string, o: Orientation) => {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};
/** A hoop's block (by its corner, its lowest file and rank) as the top-left cell of its four on screen. */
export const blockCell = (corner: string, o: Orientation) => {
  const a = cellOf(corner, o);
  return { col: o === "white" ? a.col : a.col - 1, row: o === "white" ? a.row - 1 : a.row };
};
const r4 = (n: number) => n.toFixed(4);

// ---------------- The pump's sounds, and the limp balloon a computer's figure tosses to it ----------------

/** The pump's cues: its plunger, the rubber, a pop, the release. */
const PUMP_SOUNDS: Record<string, SoundName> = { pump: "tigerPump", squeak: "tigerSqueak", pop: "tigerPop", whoosh: "tigerWhoosh" };

/** The limp balloon (stage 1, the same for every piece), alone: a computer's Babur tosses it from his paw to the pump. */
const LIMP = (() => {
  const { sil, marks } = balloonDrawing({ piece: "pawn", stage: 1 });
  const w = sil[0]!.length + 2;
  const h = sil.length + 2;
  const ch: Character = { id: "tigerLimp", name: "tigerLimp", w, h, foot: [Math.floor(w / 2), h], palette: PUMP_PALETTE, looks: balloonLooks(), parts: { b: balloonPartOf(sil, marks) }, anims: { fly: { loop: true, frames: [{ ms: 1000, layers: [{ part: "b", x: 1, y: 1 }] }] } } };
  return ch;
})();
/** Its toss from his paw to the nozzle (ms). */
export const LIMP_FLY_MS = 380;
/** Where the limp balloon is in his `place` (frame pixels, as it leaves his paw at `touch`). */
const PAW_LIMP = { x: 13.5, y: 84 } as const;

// ---------------- His trip to the pump (a phone) ----------------

const PLACE_MS = TIGER_ANIM.place;
const TOUCH_AT = TIGER_ANIM.placeTouchAt;
/** His hop along the bar: the airborne frame (120 ms in the art) held for HOP_AIR_MS (characters/tiger-figure.ts). */
export const HOP_TRIP_MS = TIGER_ANIM.hop - 120 + HOP_AIR_MS;
/** How far from his feet (frame pixels, toward the way he faces) the nozzle is as he puts the balloon on. */
export const NOZZLE_REACH = 23;

/**
 * His trip along the bar, `t` ms into it: across by `dx` px while airborne (a small arc), `place` beside the pump, and back. Facing the
 * pump on the way and at it (he's drawn facing our left: mirrored when it's to his right), facing back on the way home.
 */
export function tripMove(dx: number): FigureMove {
  const backAt = HOP_TRIP_MS + PLACE_MS;
  return (t) => {
    const go = (t - HOP_AIR_AT) / HOP_AIR_MS;
    const back = (t - backAt - HOP_AIR_AT) / HOP_AIR_MS;
    const u = t < backAt ? Math.max(0, Math.min(1, go)) : 1 - Math.max(0, Math.min(1, back));
    const air = t < backAt ? go : back;
    const y = air > 0 && air < 1 ? -10 * Math.sin(Math.PI * air) : 0;
    return { x: dx * u, y, flip: t < backAt ? dx > 0 : dx < 0 };
  };
}

/** The figure in a phone's boss bar, if that's where he's drawn now (else a computer's, by the board). */
const barFigure = (): HTMLElement | null => {
  const el = document.querySelector<HTMLElement>(".boss-bar .boss-char.place-bar");
  return el && el.getBoundingClientRect().width > 0 ? el : null;
};
const pumpEl = (): HTMLElement | null => document.querySelector<HTMLElement>(".tg-pump");
/** A point of the pump's frame on screen (px), from its drawn size: the nozzle's knot by default. */
function onPump(pump: HTMLElement, at: readonly [number, number] = [RELEASE_KNOT[0], RELEASE_KNOT[1] + 5]) {
  const r = pump.getBoundingClientRect();
  const s = r.width / PUMP_W;
  return { x: r.left + at[0] * s, y: r.top + at[1] * s };
}

/** The limp balloons in the air on a computer (Date.now() times; screen px). */
const limps = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number }; at: number; look: string; scale: number }>();

/** Each of his moments plays once on this device, from when it first saw it: his trip or place, his reactions, their lines. */
const acted = new Set<string>();
const timers = new Map<string, number>();
function later(key: string, at: number, fn: () => void): void {
  const old = timers.get(key);
  if (old) clearTimeout(old);
  const id = window.setTimeout(() => {
    timers.delete(key);
    fn();
  }, Math.max(0, at - Date.now()));
  timers.set(key, id);
}

function actPlace(kit: BossKit, rec: TigerShow, now: number): void {
  const pl = rec.place!;
  const id = `${rec.key}:${pl.key}`;
  if (acted.has(id)) return;
  acted.add(id);
  // (Hidden, or in the middle of another animation: his body skips it; the pump gets its balloon now.)
  if (document.visibilityState === "hidden" || figureBusy(kit.ch, now)) {
    pl.putAt = now;
    return;
  }
  const bar = barFigure();
  const pump = pumpEl();
  if (bar && pump) {
    const r = bar.getBoundingClientRect();
    const foot = r.left + r.width / 2;
    const nozzle = onPump(pump, [PUMP_FOOT[0], 0]).x;
    const dx = nozzle > foot ? nozzle - NOZZLE_REACH - foot : nozzle + NOZZLE_REACH - foot;
    playInPlace(`tiger:${id}`, ["hopTrip", "place", "hopTrip"], now, tripMove(dx));
    pl.putAt = now + HOP_TRIP_MS + TOUCH_AT;
  } else {
    playInPlace(`tiger:${id}`, ["place"], now);
    const side = document.querySelector<HTMLElement>(".boss-char.place-side .boss-char-sprite");
    const sr = side?.getBoundingClientRect();
    if (sr && sr.width > 0 && pump) {
      // (The limp balloon at the pump's own scale: it lands on the nozzle as the balloon it becomes.)
      limps.set(id, { from: { x: sr.left + (PAW_LIMP.x / kit.ch.w) * sr.width, y: sr.top + (PAW_LIMP.y / kit.ch.h) * sr.height }, to: onPump(pump), at: now + TOUCH_AT, look: colorLook(pl.color), scale: pump.getBoundingClientRect().width / PUMP_W });
      if (limps.size > 4) limps.delete(limps.keys().next().value!);
      pl.putAt = now + TOUCH_AT + LIMP_FLY_MS;
    } else pl.putAt = now + TOUCH_AT;
  }
  // His word for it, now and then (its chance), as the balloon goes on.
  later(`say:${id}`, now + TOUCH_AT, () => bossVoice.say(pickLine(kit, "place", id), id, NORMAL));
}

/** His reaction as a landing or pop ends (a cheer, a big cheer for a queen, a wince), where he stands, and its line. */
function actEnd(kit: BossKit, rec: TigerShow, end: EndShow): void {
  const id = `${rec.key}:${end.key}`;
  if (acted.has(`${id}:${end.at}`)) return;
  acted.add(`${id}:${end.at}`);
  const beat = end.kind === "pop" ? "wince" : end.shape === "q" ? "bigCheer" : "cheer";
  const at = end.kind === "pop" ? popReactAt(end.at) : landBeats(end.at).reactAt;
  playInPlace(`tiger:${id}:${end.at}`, [beat], at);
  later(`say:${id}`, at, () => bossVoice.say(pickLine(kit, beat, id), id, NORMAL));
}

/**
 * A balloon on the board is as tall as a queen piece on its square (Eric, Oct 24: "a full balloon the size of a piece"). The cburnett
 * queen's art fills QUEEN_ART of its square's height (measured on the board; e2e/tiger.spec.ts checks it), and the stage-4 balloon is
 * BALLOON_ROWS art px tall: one art px is PX board units (the board as 1, a square as 1/8). The sprite's frame is 32 art px: FRAME.
 */
const QUEEN_ART = 0.772;
const BALLOON_ROWS = BALLOON_SHAPES.queen[3].sil.length;
const PX = QUEEN_ART / 8 / BALLOON_ROWS;
const FRAME = 32 * PX;

// ---------------- The pump's place and size on a computer ----------------

/**
 * A computer's pump is as big as the board's balloons (Eric, Oct 24, on a computer: "the piece needs to be blown up the same size as it
 * is on the board"; docs/decisions/2026-10-24-babur-desktop-pump.md): a stage-4 queen on it as tall as her piece. Its scale is a whole
 * number where that is within PUMP_FIT of the board balloon's (PX times the board's size, in screen px per art px), otherwise the
 * nearest scale within it (pixelated). PUMP_FIT is 8%, under the 10% asked, for the pixels' rounding.
 */
export const PUMP_FIT = 0.08;
export function pumpScale(board: number): number {
  const ideal = PX * board;
  return Math.min(ideal * (1 + PUMP_FIT), Math.max(ideal * (1 - PUMP_FIT), Math.max(1, Math.round(ideal))));
}
/**
 * The most of the board's size the pump is ever tall (its 36 rows at the largest scale): the room styles.css keeps for a taller bar
 * (`--bd-h`, its 1.1876).
 */
export const PUMP_BAR_SHARE = PUMP_H * PX * (1 + PUMP_FIT);

export type Box = { left: number; top: number; right: number; bottom: number };
/** His drawn left edge in his frame, every pose (his capture's reach; his frame is 76 wide). */
const FIG_LEFT = 4;
/** The pump's drawn right edge in its frame (its barrel's base: columns 1 to 32 of 34 are ever drawn, the pop's swell at 1). */
const PUMP_RIGHT = 33;
/** Between the pump and him, and the least room from the window's edge (px). */
const PUMP_GAP = 6;
const PUMP_EDGE = 4;
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The pump's frame beside his figure by the board's bottom left (a computer): standing on his baseline, its drawn right edge PUMP_GAP
 * px left of his drawn left edge, at scale `s` (screen px). `fig` is his sprite's box at `figScale` screen px per art px. Null where
 * it would leave the window or overlap any of `keepClear` (the leaderboard, the eval bar, the board, the status): the pump then goes
 * in a taller bar.
 */
export function sidePump(fig: Box, figScale: number, baseline: number, s: number, win: { w: number; h: number }, keepClear: readonly Box[]): Box | null {
  const left = fig.left + FIG_LEFT * figScale - PUMP_GAP - PUMP_RIGHT * s;
  const box = { left, top: baseline - PUMP_H * s, right: left + PUMP_W * s, bottom: baseline };
  if (box.left < PUMP_EDGE || box.top < PUMP_EDGE || box.right > win.w - PUMP_EDGE || box.bottom > win.h) return null;
  return keepClear.some((k) => k.right > k.left && k.bottom > k.top && overlaps(k, box)) ? null : box;
}

/**
 * Where the pump is drawn: `phone`, at the bar's right end, 2x (styles.css); `side`, beside his figure by the board (in `.boss-side`,
 * `x` px from its left), at `scale`; `tall`, at the left of a taller bar, at `scale`; `bar`, at the bar's left at 1x (a screen without
 * the boss dock, whose board doesn't leave room for a taller bar).
 */
type PumpPlace = { at: "phone" | "side" | "tall" | "bar"; scale: number; x: number; side: HTMLElement | null };
const PHONE: PumpPlace = { at: "phone", scale: 2, x: 0, side: null };
/** styles.css' computer. */
const COMPUTER = "(min-width: 900px) and (min-height: 600px)";
/** What the pump keeps clear of beside his figure. */
const KEEP_CLEAR = ".tower-side, .eval-bar, .board-wrap, .boss-dock, .boss-bar, .under-board, .mini-tower";
/** The place last worked out, so a screen that hands the bar on starts with the same layout (no jump before it measures). */
let lastPlace: PumpPlace = PHONE;

/**
 * Works out the pump's place on this screen, beside him if there's room with the bar at its usual size, else in the taller bar (whose
 * class it leaves on `slot`). Synchronous: the class comes off and on again in the same task, never painted in between.
 */
function pumpPlace(slot: HTMLElement, figW: number): PumpPlace {
  if (!matchMedia(COMPUTER).matches) return PHONE;
  const screen = slot.closest<HTMLElement>(".screen") ?? document.body;
  const board = screen.querySelector<HTMLElement>(".hb-board");
  slot.classList.remove("tg-tall");
  if (!board || !screen.querySelector(":scope > .boss-dock")) return { at: "bar", scale: 1, x: 0, side: null };
  const side = screen.querySelector<HTMLElement>(".boss-side");
  const sprite = side?.querySelector<HTMLElement>(".boss-char-sprite");
  const b = board.getBoundingClientRect();
  // (Boxes in screen px, the scale and the place in layout px: they differ only while a transform is on the screen.)
  const zoom = b.width / (board.offsetWidth || 1) || 1;
  // (The scale for the board as this layout draws it: its element's size now, a whole multiple of 8 device px, as the board
  // will write it. Not the squares' size, which the board writes a moment later: with the taller bar just taken off, it's still
  // the smaller board's, and a pump measured at that size could fit where the real one doesn't, flipping back and forth.)
  const root = board.closest<HTMLElement>(".hb") ?? board;
  const drawn = boardSize(parseFloat(getComputedStyle(root).width) || board.offsetWidth, window.devicePixelRatio || 1);
  const fig = sprite?.getBoundingClientRect();
  if (side && fig && fig.width > 0) {
    const s = pumpScale(drawn);
    const at = side.getBoundingClientRect();
    const keep = [...document.querySelectorAll(KEEP_CLEAR)].map((e) => e.getBoundingClientRect());
    const box = sidePump(fig, fig.width / figW, at.bottom, s * zoom, { w: document.documentElement.clientWidth, h: innerHeight }, keep);
    if (box) return { at: "side", scale: s, x: (box.left - at.left) / zoom, side };
  }
  slot.classList.add("tg-tall");
  // (The taller bar's board: the scale for it once the class is on, as above.)
  const tall = boardSize(parseFloat(getComputedStyle(root).width) || board.offsetWidth, window.devicePixelRatio || 1);
  return { at: "tall", scale: pumpScale(tall), x: 0, side: null };
}
const samePlace = (a: PumpPlace, b: PumpPlace) => a.at === b.at && Math.abs(a.scale - b.scale) < 1e-3 && Math.abs(a.x - b.x) < 0.5 && a.side === b.side;

// ---------------- The pump ----------------

/** Redraws the component when each of `times` (Date.now() time) comes, and as the page comes back into view. */
function useWake(times: readonly (number | null)[]): void {
  const [tick, bump] = useState(0);
  const key = times.join();
  useEffect(() => {
    const now = Date.now();
    const next = times.filter((t): t is number => t !== null && t > now).sort((a, b) => a - b)[0];
    const visible = () => bump((n) => n + 1);
    document.addEventListener("visibilitychange", visible);
    const id = next === undefined ? 0 : window.setTimeout(() => bump((n) => n + 1), next - now + 5);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, tick]);
}

/**
 * The pump in the boss bar's free room, and what's new in his turn's events (each played once on this device): his trip or place, his
 * reactions. Drawn from the view's `balloon` on the battle's clock; redrawn only when something is due (a stage, the put, a release).
 */
export function TigerPump({ boss, moments }: { boss: BossView; moments: () => Moment[] }) {
  const now = Date.now();
  const rec = noteTiger(boss, now, moments());
  const kit = bossKit(boss.name);
  const [, bump] = useState(0);
  // Its place (a computer's beside him or in a taller bar), worked out before the first paint and again as the window, the board or the
  // leaderboard changes size. (The observer's run waits a frame: changing the board's size inside it would be a resize loop.)
  const slot = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState(lastPlace);
  // (A screen that has just come draws the pump beside him only once its place is measured: his moments wait for it, as they measure it.)
  const drawn = place.at !== "side" || !!place.side?.isConnected;
  useLayoutEffect(() => {
    if (!rec || !kit || boss.result || !drawn) return;
    if (rec.place && rec.place.putAt === undefined) {
      actPlace(kit, rec, Date.now());
      bump((n) => n + 1);
    }
    if (rec.end) actEnd(kit, rec, rec.end);
  }, [rec?.place?.key, rec?.end?.key, rec?.end?.at, drawn]);
  const b = boss.powers?.balloon ?? null;
  const show = pumpShows(rec, b, gardenNow(), now, document.visibilityState !== "hidden", realMs);
  const limp = rec?.place ? limps.get(`${rec.key}:${rec.place.key}`) : undefined;
  useWake([show.wake, rec?.place?.putAt ?? null, limp ? limp.at : null, limp ? limp.at + LIMP_FLY_MS : null]);
  const figW = kit?.ch.w ?? 76;
  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const run = () => {
      if (!el.isConnected) return;
      const p = pumpPlace(el, figW);
      lastPlace = p;
      setPlace((old) => (samePlace(old, p) ? old : p));
    };
    run();
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    });
    for (const t of [el.closest(".screen")?.querySelector(".board-wrap"), document.querySelector(".tower-side")]) if (t) ro.observe(t);
    addEventListener("resize", run);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("resize", run);
    };
  }, []);
  const sized = place.at === "side" || place.at === "tall" ? { "--tg-s": place.scale.toFixed(4) } : undefined;
  const sprite = <SpriteAnim ch={TIGER_PUMP} anim={show.anim} since={show.since} then={show.then} look={show.look} sounds={show.quiet ? {} : PUMP_SOUNDS} id={`pump:${rec?.key ?? ""}`} class="tg-pump" />;
  const side = place.at === "side" && drawn ? place.side : null;
  return (
    <span ref={slot} class={`tg-pump-slot${place.at === "side" ? " tg-side" : place.at === "tall" ? " tg-tall" : ""}`} style={place.at === "tall" ? sized : undefined} data-anim={show.anim} data-balloon={b ? `${b.shape}${b.color}` : ""} data-place={place.at}>
      {place.at !== "side" && sprite}
      {side &&
        createPortal(
          <span class="tg-side-pump" style={{ ...sized, left: `${place.x.toFixed(1)}px` }}>
            {sprite}
          </span>,
          side,
        )}
      {limp && now >= limp.at && now < limp.at + LIMP_FLY_MS && (
        <span class="tg-limp" style={{ "--x0": `${limp.from.x}px`, "--y0": `${limp.from.y}px`, "--x1": `${limp.to.x}px`, "--y1": `${limp.to.y}px`, "--lw": `${LIMP.w * limp.scale}px`, "--lh": `${LIMP.h * limp.scale}px`, animationDuration: `${LIMP_FLY_MS}ms`, animationDelay: `${limp.at - now}ms` }}>
          <SpriteAnim ch={LIMP} anim="fly" since={limp.at} look={limp.look} />
        </span>
      )}
    </span>
  );
}

// ---------------- The board: a balloon's flight and landing, the rings ----------------

/** Where a fly sprite's knot is in its frame (its top left, of 32 px; effects/tiger.ts draws it there). */
const FLY_KNOT = { x: 16, y: 22 } as const;
/** Where the flight starts without a pump on screen (board units: above the board's top right). */
const FLY_FALLBACK = { x: 0.9, y: -0.35 } as const;
/**
 * A balloon's frame on a square (board units, its top left): its knot's bottom center on the square's bottom edge, where the landing
 * brings it to rest (its knot on row LAND_Y, the bottom edge at LAND_Y + 1), so a landed balloon stands where his piece stands.
 */
const balloonBox = (col: number, row: number) => ({ x: (col + 0.5) / 8 - 16 * PX, y: (row + 1) / 8 - (LAND_Y + 1) * PX });

/** The pump's knot in board units (the board's size as 1, its top left 0,0), or null. */
function pumpOnBoard(root: HTMLElement | null): { x: number; y: number } | null {
  const board = root?.closest(".board-wrap")?.querySelector<HTMLElement>(".hb-board");
  const pump = pumpEl();
  if (!board || !pump) return null;
  const b = board.getBoundingClientRect();
  if (!b.width || !pump.getBoundingClientRect().width) return null;
  // (The flight starts where the release's last lifted look ends: its knot at RELEASE_KNOT, not the nozzle's rest.)
  const k = onPump(pump, RELEASE_KNOT);
  return { x: (k.x - b.left) / b.width, y: (k.y - b.top) / b.width };
}

/** The rings' sounds: the flame as each lands (its whoosh and thump are quiet beside it), the smoke as it goes out. */
const RING_SOUNDS: Record<string, SoundName> = { flame: "tigerFlame", puff: "tigerPoof" };

/**
 * His layer over the board: a landing's flight from the pump (an arc, CSS) and its landing on the square; the burning rings. Redraws
 * itself at each beat (the screens around it draw only now and then).
 */
function TigerLayer({ boss, p, orientation, moments, now }: BoardLayerProps) {
  const root = useRef<HTMLDivElement>(null);
  const rec = noteTiger(boss, now, moments);
  const [, bump] = useState(0);
  const end = rec?.end?.kind === "land" && rec.end.square ? rec.end : null;
  const beats = end ? landBeats(end.at) : null;
  // (The flight starts at the pump's knot, measured once it's drawn: a screen that has just come draws a computer's pump a moment later,
  // so it looks again each frame until then, and takes the fallback only if the flight starts without one.)
  const [tries, tryAgain] = useState(0);
  useLayoutEffect(() => {
    if (!end || end.from) return;
    const at = pumpOnBoard(root.current);
    if (at || Date.now() >= landBeats(end.at).flyAt) {
      end.from = at ?? FLY_FALLBACK;
      bump((n) => n + 1);
      return;
    }
    const id = requestAnimationFrame(() => tryAgain((n) => n + 1));
    return () => cancelAnimationFrame(id);
  }, [end?.key, end?.at, tries]);
  const cast = moments.find((m) => m.kind === "hoops") ?? null;
  const rings = ringShows(p.hoops, rec, now, cast?.at ?? null);
  const wake: (number | null)[] = [];
  const out: preact.JSX.Element[] = [];
  if (end && beats && now < beats.reactAt) {
    wake.push(beats.flyAt, beats.landAt, beats.landAt + LAND_MS);
    const look = colorLook(end.color);
    const { col, row } = cellOf(end.square!, orientation);
    const box = balloonBox(col, row);
    if (now >= beats.flyAt && now < beats.landAt) {
      const from = end.from ?? FLY_FALLBACK;
      // (Board units from the balloon's rest: the fly sprite's knot starts at the pump's; the offsets are in its own frame, FRAME.)
      const dx = from.x - (box.x + FLY_KNOT.x * PX);
      const dy = from.y - (box.y + FLY_KNOT.y * PX);
      const timing = { animationDuration: `${FLY_MS}ms`, animationDelay: `${beats.flyAt - now}ms` };
      out.push(
        <span key={`fly-${end.key}`} class="tg-fly" data-square={end.square} style={{ "--x1": r4(box.x), "--y1": r4(box.y), "--bs": r4(FRAME), "--dx": r4(dx / FRAME), "--dy": r4(dy / FRAME), "--dyp": r4((Math.min(dy, 0) - 0.6 / 8) / FRAME), ...timing }}>
          <span class="tg-fly-in" style={timing}>
            <SpriteAnim ch={EFFECTS.balloonFly.ch} anim={flyAnim(end.shape)} since={beats.flyAt} look={look} id={`fly:${end.key}`} />
          </span>
        </span>,
      );
    } else if (now >= beats.landAt && now < beats.landAt + LAND_MS)
      out.push(
        <span key={`land-${end.key}`} class="tg-land" data-square={end.square} style={{ "--x1": r4(box.x), "--y1": r4(box.y), "--bs": r4(FRAME) }}>
          <SpriteAnim ch={EFFECTS.balloonLand.ch} anim={landAnim(end.shape)} since={beats.landAt} look={look} sounds={EFFECTS.balloonLand.sounds} id={`land:${rec!.key}:${end.key}`} />
        </span>,
      );
  }
  for (const r of rings) {
    const { col, row } = blockCell(r.corner, orientation);
    if (r.anim === "land") wake.push(r.since + TIGER_ANIM.ringLand);
    out.push(
      <span key={`ring-${r.corner}-${r.anim === "out" ? "out" : "on"}`} class="tg-ring" data-corner={r.corner} data-state={r.anim} style={{ "--x1": r4((col - 0.5) / 8), "--y1": r4((row - 0.5) / 8) }}>
        <SpriteAnim ch={EFFECTS.hoopRing.ch} anim={r.anim} since={r.since} then={r.then} sounds={RING_SOUNDS} id={`ring:${rec?.key ?? ""}:${r.corner}`} />
      </span>,
    );
  }
  if (cast) for (let i = 0; i < HOOPS_BEATS.throwsAt.length; i++) wake.push(cast.at + HOOPS_BEATS.throwsAt[i]! + HOOPS_BEATS.flyMs);
  if (rec?.out) wake.push(rec.out.at + TIGER_ANIM.ringOut);
  useWake(wake);
  return (
    <div class="tg-layer" ref={root} data-rings={rings.filter((r) => r.anim !== "out").length}>
      {out}
    </div>
  );
}

// ---------------- His moments ----------------

const nothing = () => null;

/** Where a hoop leaves his paw (board units), as he casts at the board's top-left corner (.pm-caster.pm-by-tiger): measured on his frame. */
export const HOOP_PAW = { x: 0.03, y: 0.0 } as const;

/**
 * The hoops: the HOOPS! banner (off the board before the first throw), his cast at the board's corner, and each hoop flying from his
 * paw to its block at its throw (its ring is the board's).
 */
function hoopsMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const blocks = boss.powers?.hoops?.blocks ?? [];
  return (
    <div class="power-moment pm-hoops">
      {banner("HOOPS!", `No crossing the rings for ${BOSS_POWERS.hoopsCrowdMoves} moves`, "fire", HOOPS_BEATS.throwsAt[0])}
      {cast("throw1", HOOPS_BEATS.throwsAt[0])}
      <div class="tg-hoops" aria-hidden="true">
        {blocks.map((corner, i) => {
          const t0 = HOOPS_BEATS.throwsAt[i];
          if (t0 === undefined || t < t0 || t >= t0 + HOOPS_BEATS.flyMs) return null;
          const u = (t - t0) / HOOPS_BEATS.flyMs;
          const { col, row } = blockCell(corner, orientation);
          const x = HOOP_PAW.x + ((col + 1) / 8 - HOOP_PAW.x) * u;
          const y = HOOP_PAW.y + ((row + 1) / 8 - HOOP_PAW.y) * u - 0.12 * Math.sin(Math.PI * u);
          return (
            <span key={`hoop-${corner}`} class="tg-hoop" data-corner={corner} style={{ "--x1": r4(x - 1 / 16), "--y1": r4(y - 1 / 16) }}>
              <SpriteAnim ch={EFFECTS.hoopFly.ch} anim="fly" since={moment.at + t0} id={`hoop:${moment.key}:${i}`} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * His moments. Only the hoops' cast holds the turn (POWER_FX) and plays as a moment; the rest play from his turn's events where they
 * belong (TigerPump: the trip, the pump, the reactions and their lines; TigerLayer: the flight, the landing, the rings).
 */
const MOMENTS: Record<"place" | "balloonLand" | "pop" | "balloonCheer" | "balloonBigCheer" | "wince" | "hoops" | "hoopsOut", MomentUi> = {
  place: { order: 0, kit: "place", line: () => null, view: nothing },
  balloonLand: { order: 1, kit: "cheer", line: () => null, view: nothing },
  pop: { order: 1, kit: "wince", line: () => null, view: nothing },
  balloonCheer: { order: 3, kit: "cheer", line: () => null, view: nothing },
  balloonBigCheer: { order: 3, kit: "bigCheer", line: () => null, view: nothing },
  wince: { order: 3, kit: "wince", line: () => null, view: nothing },
  hoops: { order: 0, kit: "ultimate", view: hoopsMoment },
  hoopsOut: { order: 0, kit: "ultimateHit", line: () => null, view: nothing },
};

let warmed = false;
/** His trip, place, reactions and hoops drawn ahead as his battle starts, and the rings' and hoops' sprites. */
export function prewarmTiger(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("hopTrip"), ...frames("place"), ...frames("cheer"), ...frames("bigCheer"), ...frames("wince"), ...frames("hoops")]);
  for (const fx of ["hoopFly", "hoopRing"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const TIGER_UI = {
  id: "tiger",
  // (His hoops come after your move and his: as your next turn begins, after his move shows.)
  ultimate: { name: "Hoops", when: "After your move" },
  moments: MOMENTS,
  barProp: ({ boss, moments }) => <TigerPump boss={boss} moments={moments} />,
  board: (p) => ({ over: <TigerLayer {...p} /> }),
} satisfies BossUi;
