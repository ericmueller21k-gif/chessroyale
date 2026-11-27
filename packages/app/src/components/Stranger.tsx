import { STORM_SCENE, STRANGER_FX, applyMove, finisherOf, pieceAt, stormOn, type Finisher } from "@chessroyale/chess";
import { useLayoutEffect, useRef } from "preact/hooks";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import { STRANGER, STRANGER_HOP } from "../characters/stranger.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossMoment, SpriteAnim, onEachFrame, prewarm, type BoardItem } from "./BossEffect.tsx";
import { FREEZE } from "./Ginger.tsx";
import { BURN, FireBurn } from "./Grex.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, PIECE_WORD, onComputer, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * The Stranger's powers on screen (his rules: packages/chess/src/bosses/stranger.ts). Reused, not new (Eric, Oct 14: simple beats
 * flashy): his Frostfire strike is Ginger's freeze on the piece (the banner, the ice bolt, the ice forming and shimmering through the
 * frozen turn), and its tile is Grex's fire tile, ablaze with its countdown on the flee turn, then Grex's burn as the crowd's move lands.
 * His own cast and swords are the characters lane's (claude/stranger-art); until they land, the shared cast.
 * His finisher (Eric, Nov 27): his move that takes a piece of yours that isn't a pawn shows first as his hop onto the board beside it and
 * one of four finishers on it (the flame strike, the ice and its shatter, the clean cut, the frostfire); as it kills the piece his own
 * slides onto its square (Eric, Nov 27: "have it capture the moment he kills it"), then his hop back; his move, held till then, shows
 * the board as it already is (strangerTurnMoments, strangerBoard).
 */

function strikeMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  return (
    <div class="power-moment pm-freeze pm-frostfire">
      {banner("FROSTFIRE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen, then its square burns` : undefined, "cold", FREEZE.boltAt)}
      {cast("frostfire", FREEZE.boltAt)}
      {moment.square && t >= FREEZE.boltAt && t < FREEZE.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + FREEZE.boltAt} ms={FREEZE.iceAt - FREEZE.boltAt} aim />}
      {moment.square && t >= FREEZE.iceAt - 60 && t < FREEZE.iceAt + 900 && <span class="pw-frost" style={{ ...onSquare(moment.square, orientation), animationDelay: `${FREEZE.iceAt - 60 - t}ms` }} />}
    </div>
  );
}

function burnMoment({ moment, now, orientation }: MomentProps) {
  if (!moment.square) return null;
  const burnt = [{ square: moment.square, ...(moment.shape && !moment.fizzled?.length ? { piece: moment.shape } : {}), ...(moment.fizzled?.length ? { fizzled: true } : {}) }];
  return (
    <div class="power-moment pm-frostfire-burn">
      {/* (Quiet: Grex's tile and burn art, but his own burn sound plays, from his figure: Grex's poof and fizz are Grex's.) */}
      <FireBurn burnt={burnt} since={moment.at} now={now} orientation={orientation} quiet />
    </div>
  );
}

// ---------------- His finisher (Eric, Nov 27) ----------------

type Pt = { x: number; y: number };
type Orientation = "white" | "black";
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
/** A square's middle, in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
export const arc = (a: Pt, b: Pt, h: number, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - h * 4 * u * (1 - u) });
/** His hop's height (% of the board): HOP_H, lower on a phone where it would rise above his corner (the highest he's proven on screen at). */
const HOP_H = 14;
/**
 * The hop's height between his corner and where he stands (`computer`: his corner at the board's bottom, every stand above it). On a phone
 * the corner is his highest place at rest (the bar above the board), so the arc never rises above it: its rise over the corner is at most
 * 0 when the height is at most a quarter of the drop (arc's y at u minus the corner's = drop u - 4hu(1 - u) >= 0 for every u).
 */
export const hopHeight = (corner: Pt, stand: Pt, computer: boolean): number => (computer ? HOP_H : Math.min(HOP_H, Math.max(0, stand.y - corner.y) / 4));

/** His box on the board (% of its width): 128 frame px, his body about 2.4 squares tall. */
const FIG_W = 38;
const PX = FIG_W / STRANGER.w;
/**
 * His corner of the board, where he hops from and back to (his feet), his box inside the board's left edge: on a phone its top left (his
 * place in the bar above it), on a computer its bottom left (his place beside it; the board's top is near the window's there).
 */
export const cornerOf = (computer: boolean): Pt => ({ x: FIG_W / 2 + 1, y: computer ? 97 : 6 });
/**
 * His drawing's reach above his feet (sprite px, his crown and aura), so his head never rises more than `headRoom` % above the board: a
 * little on a phone (the bar is above it), none on a computer.
 */
export const UP = 110;

/**
 * Where he stands to strike a piece: beside it, a square and a bit toward the board's middle, his feet on its square's bottom edge (lower
 * where the piece is near the top of the board, so his head stays on the screen).
 */
export function finisherStand(square: string, o: Orientation, computer = false): Pt {
  const c = centreOf(square, o);
  return { x: c.x + (c.x < 50 ? 1 : -1) * 14, y: Math.max(c.y + 6.25, UP * PX - (computer ? 0 : 8)) };
}

/**
 * A finisher's beats (ms into the moment, STRANGER_FX.finisher in all): he hops onto the board (`landAt`), plays the finisher's animation
 * from `finAt` (`fin_<kind>`), its board art on the piece from its cue (`hitAt`; the ice's shatter at `shatterAt`, the frostfire's
 * ignition at `igniteAt`), the piece gone from `goneAt` (the board shows it without the piece from then until his move shows), then he
 * hops back to his corner (`backAt`, down by `homeAt`). Pure: from the art's cues.
 */
/**
 * How long before his held move shows he's home at least (ms): online each device starts the finisher as it hears of it, so a late one
 * still sees him land before the move arrives (a unit test checks every finisher; review of #1002).
 */
export const FINISHER_MARGIN_MS = 400;
export interface FinishTimeline {
  kind: Finisher;
  landAt: number;
  finAt: number;
  hitAt: number;
  /** The ice's shatter, the frostfire's ignition (0 for the others). */
  shatterAt: number;
  igniteAt: number;
  goneAt: number;
  backAt: number;
  homeAt: number;
  ms: number;
}
export function finishTimeline(kind: Finisher): FinishTimeline {
  const anim = STRANGER.anims[`fin_${kind}`]!;
  const finAt = STRANGER_HOP.ms;
  const cue = (c: string) => finAt + (cueAt(anim, c) ?? 0);
  const backAt = finAt + animLength(anim);
  const base = { kind, landAt: STRANGER_HOP.landAt, finAt, backAt, homeAt: backAt + STRANGER_HOP.landAt, ms: STRANGER_FX.finisher, shatterAt: 0, igniteAt: 0 };
  if (kind === "flame") return { ...base, hitAt: cue("slash"), goneAt: cue("slash") + BURN.goneAt };
  if (kind === "ice") return { ...base, hitAt: cue("tips"), shatterAt: cue("slash"), goneAt: cue("slash") + 60 };
  if (kind === "cut") return { ...base, hitAt: cue("slash"), goneAt: cue("slash") + 40 };
  const igniteAt = cue("cast") + 700;
  return { ...base, hitAt: cue("cast"), igniteAt, goneAt: igniteAt + (cueAt(EFFECTS.strangerSquare.ch.anims.ignite!, "burn") ?? 0) + BURN.goneAt };
}

/** The finisher's board art on the piece at `t` ms into the moment (`since`: the moment's start), on one canvas. */
function finishItems(tl: FinishTimeline, square: string, piece: string, at: number, t: number): BoardItem[] {
  const sq = (name: BoardItem["name"], anim: string, since: number, then?: string, quiet = false): BoardItem => ({ square, name, anim, since: at + since, ...(then ? { then } : {}), ...(quiet ? { quiet } : {}) });
  const burnFor = (since: number): BoardItem[] => (t >= since && t < since + BURN.ms ? [sq("pieceBurn", piece, since, undefined, true)] : []);
  const fireOut = (from: number) => (t >= from && t < from + 400 ? [sq("strangerSquare", "burnOut", from)] : []);
  if (t < tl.hitAt) return [];
  switch (tl.kind) {
    case "flame": {
      const out = tl.hitAt + 900;
      return [...(t < out ? [sq("strangerSquare", "blaze", tl.hitAt, "burn")] : fireOut(out)), ...burnFor(tl.hitAt)];
    }
    case "ice":
      return t < tl.shatterAt ? [sq("strangerSquare", "strike", tl.hitAt, "frozen")] : t < tl.shatterAt + 500 ? [sq("strangerSquare", "shatter", tl.shatterAt)] : [];
    case "cut":
      return t < tl.hitAt + 400 ? [sq("strangerSquare", "cutLine", tl.hitAt)] : [];
    case "frostfire": {
      const out = tl.igniteAt + 1100;
      const fire = t < tl.igniteAt ? [sq("strangerSquare", "strike", tl.hitAt, "frozen")] : t < out ? [sq("strangerSquare", "ignite", tl.igniteAt, "burn")] : fireOut(out);
      return [...fire, ...burnFor(tl.goneAt - BURN.goneAt)];
    }
  }
}

/** The clean cut's two halves of the piece (drawn as the board draws pieces), sliding apart along the cut and fading. */
function Halves({ code, at, u }: { code: string; at: Pt; u: number }) {
  const d = 3.2 * u;
  const style = (sx: number, sy: number, clip: string) => ({ left: `${r2(at.x - 6.25 + sx * d)}%`, top: `${r2(at.y - 6.25 + sy * d + u * u * 3)}%`, clipPath: clip, opacity: String(r2(1 - clamp01((u - 0.5) * 2))) });
  return (
    <>
      <piece class={`pg-piece sg-half ${code}`} style={style(-1, -1, "polygon(0 0, 100% 0, 0 100%)")} />
      <piece class={`pg-piece sg-half ${code}`} style={style(1, 1, "polygon(100% 0, 100% 100%, 0 100%)")} />
    </>
  );
}
const COLOR = { w: "white", b: "black" } as const;
const HALVES_MS = 650;

/** His finisher's moment: the hop onto the board beside your piece, the finisher on it, the piece gone, the hop back. */
function finisherMoment({ boss, moment, now, t, orientation }: MomentProps) {
  const square = moment.square;
  const piece = moment.shape ?? "n";
  if (!square) return null;
  const kind = finisherOf(moment.pick);
  const tl = finishTimeline(kind);
  const computer = onComputer();
  const CORNER = cornerOf(computer);
  const stand = finisherStand(square, orientation, computer);
  const flight = STRANGER_HOP.landAt - STRANGER_HOP.upAt;
  const rise = hopHeight(CORNER, stand, computer);
  const hop = (a: Pt, b: Pt, from: number): Pt => (t < from + STRANGER_HOP.upAt ? a : arc(a, b, rise, clamp01((t - from - STRANGER_HOP.upAt) / flight)));
  const going = t >= tl.backAt;
  const feet = going ? hop(stand, CORNER, tl.backAt) : hop(CORNER, stand, 0);
  const anim = going ? { anim: "hop", since: tl.backAt } : t < tl.finAt ? { anim: "hop", since: 0 } : { anim: `fin_${kind}`, since: tl.finAt };
  const h = (FIG_W * STRANGER.h) / STRANGER.w;
  const airborne = (t >= STRANGER_HOP.upAt && t < tl.landAt) || (t >= tl.backAt + STRANGER_HOP.upAt && t < tl.homeAt);
  const items = finishItems(tl, square, piece, moment.at, t);
  const c = centreOf(square, orientation);
  const cutU = kind === "cut" ? (t - tl.goneAt) / HALVES_MS : -1;
  return (
    <div class="power-moment pm-finisher" data-finisher={kind} data-square={square} data-stage={t < tl.landAt ? "hop" : t < tl.goneAt ? "strike" : t < tl.backAt ? "gone" : "back"}>
      {items.length > 0 && <BoardEffects items={items} orientation={orientation} class="pw-fire-board" />}
      <div class="hb-pieces pg-layer" aria-hidden="true">
        {airborne && <span class="pg-shadow" style={{ left: `${r2(going ? CORNER.x : stand.x)}%`, top: `${r2(going ? CORNER.y : stand.y)}%`, width: "14%", height: "4%" }} />}
        {cutU >= 0 && cutU < 1 && <Halves code={`${COLOR[boss.crowdSide]} ${PIECE_WORD[piece] ?? "knight"}`} at={c} u={cutU} />}
        <span
          class="pg-pig sg-fig"
          style={{
            left: `${r2(feet.x - FIG_W * (STRANGER.foot[0] / STRANGER.w))}%`,
            top: `${r2(feet.y - h * (STRANGER.foot[1] / STRANGER.h))}%`,
            width: `${FIG_W}%`,
            aspectRatio: `${STRANGER.w} / ${STRANGER.h}`,
          }}
          data-anim={anim.anim}
        >
          <BossMoment key={`${moment.key}:${anim.anim}:${anim.since}`} boss={boss.name} anim={anim.anim} since={moment.at + anim.since} then="idle" />
        </span>
      </div>
    </div>
  );
}

const warmed = { done: false };
/**
 * His finisher's board art drawn ahead, a slice each animation frame (prewarm), from when his battle shows: his square's fire and ice
 * and a piece burning, so none of it stalls a slow phone the first time it shows (.claude/LESSONS.md: "A stall the first time an effect
 * shows"). His own figure's animations, the finishers' too, are drawn ahead with his kit's (BossCharacter).
 */
export function prewarmStranger(): void {
  if (warmed.done) return;
  warmed.done = true;
  const fx = (n: keyof typeof EFFECTS) => Object.entries(EFFECTS[n].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const));
  prewarm("strangerSquare", fx("strangerSquare"));
  prewarm("pieceBurn", fx("pieceBurn"));
  // (His storm's: Grex's fire tile on its marks, Ginger's ice on the pieces it freezes.)
  prewarm("fireTile", fx("fireTile"));
  prewarm("iceOverlay", fx("iceOverlay"));
}

/** When this device first saw each finisher (it plays from then), by battle, turn and square. */
const turnSeen = new Map<string, number>();

/**
 * His finisher while he still thinks (strangerBattle.finisher: his move takes a piece of yours that isn't a pawn, known, about to show):
 * this turn's, from when this device first saw it (his block, where a piece of his was just lost, played in his thinking before it:
 * strangerTurnMs); his move shows after it (the server holds it, solo waits).
 */
export function strangerTurnMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "stranger" || !p) return [];
  return p.events
    .filter((e) => e.kind === "finisher" && e.turn === p.turn && e.square)
    .map((e) => {
      const key = `${boss.id}:${boss.startMove}:${p.turn}:finisher:${e.square}`;
      let at = turnSeen.get(key);
      if (at === undefined) {
        turnSeen.set(key, (at = now));
        if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
      }
      return { kind: "finisher", key, at, ms: STRANGER_FX.finisher, square: e.square!, ...(e.shape ? { shape: e.shape } : {}), ...(e.pick !== undefined ? { pick: e.pick } : {}), ...(e.move ? { move: e.move } : {}) } satisfies Moment;
    });
}

/**
 * The board while his finisher plays (Eric, Nov 27: "have it capture the moment he kills it"): from its `goneAt` (its board art took your
 * piece) his move on it (the moment's `move`), his piece sliding onto the square as any move slides, the move marked; until then the
 * board as it is, held still. When his held move shows, the board already matches it, so nothing moves twice. Null: no finisher now.
 */
export function strangerBoard(boss: Pick<BossView, "id">, moments: readonly Moment[], now: number, fen: string, orientation: Orientation = "white"): { fen: string; still: boolean; lastMove?: string } | null {
  if (boss.id !== "stranger") return null;
  // (His storm's scene: the pieces his landing nudges aside are drawn by the scene from their nudge to their way back; the board draws
  // the rest, held still, so nothing moves twice. As the scene ends they're on their squares, and the board draws them again.)
  const scene = moments.find((x) => x.kind === "storm");
  if (scene && now >= scene.at + STORM_SCENE.nudgeAt && now < scene.at + STORM_SCENE.healAt + STORM_SCENE.healMs) return { fen: withoutSquares(fen, nudged(fen, orientation).map((n) => n.square)), still: true };
  const m = moments.find((x) => x.kind === "finisher");
  if (!m?.square) return null;
  if (now < m.at + finishTimeline(finisherOf(m.pick)).goneAt) return { fen, still: true };
  const after = m.move ? played(fen, m.move) : null;
  return after ? { fen: after, still: false, lastMove: m.move } : { fen, still: true };
}
/** `fen`'s placement with `squares` emptied (a drawing only: never played, nor read by chess.js). */
function withoutSquares(fen: string, squares: readonly string[]): string {
  if (!squares.length) return fen;
  const [place, ...rest] = fen.split(" ");
  const rows = place!.split("/").map((row) => [...row].flatMap((ch) => (/\d/.test(ch) ? Array<string>(Number(ch)).fill("1") : [ch])));
  for (const sq of squares) rows[8 - Number(sq[1])]![sq.charCodeAt(0) - 97] = "1";
  const packed = rows.map((r) => r.join("").replace(/1+/g, (ones) => String(ones.length))).join("/");
  return [packed, ...rest].join(" ");
}

/** `fen` with `move` played, or null when it can't be (a stale event); the last one kept, as the board draws it every frame. */
let last: { fen: string; move: string; after: string | null } | null = null;
function played(fen: string, move: string): string | null {
  if (last?.fen === fen && last.move === move) return last.after;
  let after: string | null = null;
  try {
    after = applyMove(fen, move);
  } catch {
    after = null;
  }
  last = { fen, move, after };
  return after;
}

// ---------------- His storm (Eric, Nov 27: the Storm of Two Worlds) ----------------

/** A number from a particle's index and a salt, in [0, 1) (the same every frame: the ring is drawn from the clock alone). */
const hash = (i: number, k: number): number => {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
const ease = (u: number) => 1 - (1 - clamp01(u)) ** 2;
const lerp = (a: number, b: number, u: number) => a + (b - a) * clamp01(u);

/** The ring's canvas: its pixels (pixel art, scaled up), how far past the board it reaches each side (a share of the board), its particles. */
export const RING = { px: 168, margin: 0.12, swirl: 340, chaos: 180, haze: 70 } as const;
const FIRE = ["#6b1606", "#c2380f", "#ff6a1e", "#ffb040", "#fff0a0"];
const ICE = ["#14305e", "#2a78c8", "#5fd3ff", "#b8f0ff", "#ffffff"];

/**
 * How strong the storm is at `now` (`u`: how many of its particles, how wide its band; `chaos`: the charge's wild layer and wobble): during
 * its opening scene (`scene`: the moment's start, its own clock) it gathers from the fire sword's slam, builds from his grip to the full
 * swirl, and eases back as he leaves; through its turns, steady.
 */
export function stormLevel(scene: number | null, now: number): { u: number; chaos: number } {
  if (scene === null) return { u: 0.75, chaos: 0 };
  const t = now - scene;
  const S = STORM_SCENE;
  const u = t < S.fireAt ? 0 : t < S.gripAt ? lerp(0.1, 0.5, (t - S.fireAt) / (S.gripAt - S.fireAt)) : t < S.fullAt ? lerp(0.5, 1, (t - S.gripAt) / (S.fullAt - S.gripAt)) : t < S.pullAt ? 1 : lerp(1, 0.75, (t - S.pullAt) / (S.homeAt - S.pullAt));
  const chaos = t < S.gripAt ? 0 : t < S.fullAt ? ease((t - S.gripAt) / (S.fullAt - S.gripAt)) : t < S.pullAt ? 1 : 1 - ease((t - S.pullAt) / (S.leapAt - S.pullAt));
  return { u, chaos };
}

/**
 * The ring's particles, made once: each one's side (fire even, ice odd), its color, where it starts round the ring, its speed, its place
 * across the band, its wobble and when it shows (`show`: drawn while the storm's strength is above it). Sorted by color, so a frame sets
 * each color once.
 */
type Grain = { fire: boolean; color: string; th: number; w: number; band: number; wob: number; ph: number; show: number; big: boolean; haze: boolean };
let grains: Grain[] | null = null;
function grainsOf(): Grain[] {
  if (grains) return grains;
  const out: Grain[] = [];
  const add = (i: number, kind: "swirl" | "chaos" | "haze") => {
    const fire = i % 2 === 0;
    const pal = fire ? FIRE : ICE;
    const fast = kind === "chaos";
    const dir = fire ? 1 : -1;
    out.push({
      fire,
      color: kind === "haze" ? pal[1]! : pal[1 + Math.floor(hash(i, 6) * 4)]!,
      th: hash(i, 2) * Math.PI * 2,
      w: (fast ? 1.4 + 0.7 * hash(i, 1) : kind === "haze" ? 0.25 + 0.15 * hash(i, 1) : 0.45 + 0.4 * hash(i, 1)) * dir,
      band: -0.04 + 0.18 * hash(i, 3),
      wob: 3 + 5 * hash(i, 4),
      ph: 6.28 * hash(i, 5),
      show: kind === "chaos" ? hash(i, 8) + 1 : hash(i, 8),
      big: hash(i, 7) > 0.6,
      haze: kind === "haze",
    });
  };
  for (let i = 0; i < RING.swirl; i++) add(i, "swirl");
  for (let i = 0; i < RING.chaos; i++) add(i + 1000, "chaos");
  for (let i = 0; i < RING.haze; i++) add(i + 2000, "haze");
  grains = out.sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  return grains;
}

/**
 * One frame of the ring: fire swirling one way round the board, ice the other, along a rounded square's band from its edge squares
 * outward; a colored haze under it, the charge's fast wild layer over it, each grain with a short trail.
 */
function paintRing(g: CanvasRenderingContext2D, now: number, level: { u: number; chaos: number }): void {
  const W = RING.px;
  g.clearRect(0, 0, W, W);
  if (level.u <= 0) return;
  const S = W / (1 + 2 * RING.margin);
  const c = W / 2;
  const sec = now / 1000;
  const all = grainsOf();
  for (const k of [3, 2, 1, 0]) {
    let color = "";
    for (const q of all) {
      // (Haze: no trail. The charge's grains (show above 1) come in with its chaos.)
      if ((q.haze && k > 0) || (q.show >= 1 ? q.show - 1 >= level.chaos : q.show >= level.u)) continue;
      const th = q.th + q.w * (sec - 0.04 * k);
      const band = q.band * (0.6 + 0.4 * level.u) + level.chaos * 0.04 * Math.sin(sec * q.wob + q.ph);
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const r = 0.5 / (cs ** 4 + sn ** 4) ** 0.25 + band;
      const size = q.haze ? 7 : k === 0 ? (q.big ? 3 : 2) : k === 1 ? 2 : 1;
      const x = Math.round(c + cs * r * S - size / 2);
      const y = Math.round(c + sn * r * S - size / 2);
      if (q.color !== color) g.fillStyle = color = q.color;
      g.globalAlpha = q.haze ? 0.16 : (band < 0 ? 0.55 : 1) * (k === 0 ? 1 : 0.55 / k);
      g.fillRect(x, y, size, size);
    }
  }
  g.globalAlpha = 1;
}

/**
 * The storm's ring round the board (Eric: "he shrouds around the board ... this fire and ice storm around the board, and it even can kind
 * of move onto the board a little bit. It's like a circle kind of formation"): one small canvas, scaled up as pixel art, drawn every frame
 * from the clock alone on the shared frame loop (a screen drawn again carries on where it was; nothing kept). `scene`: its opening
 * scene's start (it gathers through it), or null (steady).
 */
function StormRing({ scene }: { scene: number | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const at = useRef(scene);
  at.current = scene;
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    const draw = () => paintRing(g, Date.now(), stormLevel(at.current, Date.now()));
    draw();
    return onEachFrame(draw);
  }, []);
  return <canvas ref={cv} class="sg-storm" width={RING.px} height={RING.px} aria-hidden="true" data-storm={scene === null ? "on" : "scene"} />;
}

/** Where he stands for the storm's scene (% of the board): his feet a little below its middle, his head on it. */
const STORM_STAND: Pt = { x: 50, y: 56 };
/** His swords' points in the board as they go in (% of the board): either side of his feet, at the ground line. */
const swordPoints = (): { fire: Pt; ice: Pt } => {
  const dx = (FIG_W * 12) / STRANGER.w;
  return { fire: { x: STORM_STAND.x - dx, y: STORM_STAND.y }, ice: { x: STORM_STAND.x + dx, y: STORM_STAND.y } };
};

/** The cracks from one sword's point (% of the board), from the seed of its side: a few jagged branches, each a list of points. */
function cracksFrom(p: Pt, salt: number): Pt[][] {
  const out: Pt[][] = [];
  for (let b = 0; b < 6; b++) {
    let a = (b / 6) * Math.PI * 2 + hash(b, salt) * 0.9;
    let at = { ...p };
    const pts = [at];
    const n = 4 + Math.floor(hash(b, salt + 1) * 3);
    for (let k = 0; k < n; k++) {
      a += (hash(b * 10 + k, salt + 2) - 0.5) * 1.1;
      const len = 2.2 + hash(b * 10 + k, salt + 3) * 2.6;
      at = { x: r2(at.x + Math.cos(a) * len), y: r2(at.y + Math.sin(a) * len * 0.8) };
      pts.push(at);
    }
    out.push(pts);
  }
  return out;
}
const CRACKS = { fire: cracksFrom(swordPoints().fire, 11), ice: cracksFrom(swordPoints().ice, 23) };

/** The board's cracks and the swords' ripples (one SVG in % of the board): each crack opening from its sword's slam, healing at the end. */
function Cracks({ t }: { t: number }) {
  const S = STORM_SCENE;
  const heal = t < S.healAt ? 1 : 1 - clamp01((t - S.healAt) / S.healMs);
  const pts = swordPoints();
  const charge = t >= S.gripAt && t < S.pullAt;
  const period = charge ? lerp(700, 280, (t - S.gripAt) / (S.fullAt - S.gripAt)) : 700;
  const rings = (from: number, at: Pt, cls: string) => {
    if (t < from || t >= S.pullAt + 400) return [];
    return [0, 1, 2].flatMap((k) => {
      const age = (t - from - k * (period / 3)) % period;
      if (age < 0 || t - from < k * (period / 3)) return [];
      const u = age / period;
      return [<circle key={`${cls}${k}`} class={cls} cx={at.x} cy={at.y} r={r2(2 + u * 30)} style={{ opacity: String(r2((1 - u) * 0.8)) }} />];
    });
  };
  const line = (side: "fire" | "ice", from: number) => {
    const open = clamp01((t - from) / 260);
    if (open <= 0 || heal <= 0) return null;
    return CRACKS[side].map((b, i) => {
      const shown = b.slice(0, Math.max(2, Math.ceil(b.length * open)));
      const d = shown.map((q) => `${q.x},${q.y}`).join(" ");
      return (
        <g key={`${side}${i}`} style={{ opacity: String(r2(heal)) }}>
          <polyline class={`sg-glow sg-${side}`} points={d} />
          <polyline class="sg-crack" points={d} />
        </g>
      );
    });
  };
  return (
    <svg class="sg-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {line("fire", S.fireAt)}
      {line("ice", S.iceAt)}
      {rings(S.fireAt, pts.fire, "sg-ripple sg-fire")}
      {rings(S.iceAt, pts.ice, "sg-ripple sg-ice")}
    </svg>
  );
}

/** The pieces his landing nudges aside (drawn only: the position never changes): those near where he lands, and how far each goes. */
export function nudged(fen: string, o: Orientation): { square: string; code: string; dx: number; dy: number }[] {
  const out: { square: string; code: string; dx: number; dy: number }[] = [];
  for (const f of "cdef")
    for (const r of [3, 4, 5, 6]) {
      const square = `${f}${r}`;
      const pc = pieceAt(fen, square);
      if (!pc) continue;
      const c = centreOf(square, o);
      const vx = c.x - STORM_STAND.x;
      const vy = c.y - (STORM_STAND.y - 6);
      const d = Math.max(1, Math.hypot(vx, vy));
      const push = Math.max(0, (24 - d) / 24) * 6.5;
      if (push < 0.5) continue;
      out.push({ square, code: `${COLOR[pc.color as "w" | "b"]} ${PIECE_WORD[pc.type] ?? "pawn"}`, dx: r2((vx / d) * push), dy: r2((vy / d) * push) });
    }
  return out;
}
/** How far the nudged pieces are out at `t` (0 on their squares, 1 all the way): out as he lands, back as the board heals. */
const nudgeAt = (t: number): number => {
  const S = STORM_SCENE;
  if (t < S.nudgeAt) return 0;
  if (t < S.healAt) return ease((t - S.nudgeAt) / S.nudgeMs);
  return 1 - ease((t - S.healAt) / S.healMs);
};

/**
 * The storm's opening scene (STORM_SCENE): his leap from his place to the board's middle, the pieces there nudged aside; his swords out,
 * the fire sword then the ice sword slammed in, the board cracking round each and rippling its color as the storm gathers round the
 * board (the ring, drawn by the board layer); his grip on both hilts, his red and blue aura, the charge building to the full swirl; then
 * the swords pulled out, his leap back, the cracks healing and the pieces sliding back to their squares.
 */
function stormMoment({ boss, moment, t, orientation }: MomentProps) {
  const S = STORM_SCENE;
  const computer = onComputer();
  const CORNER = cornerOf(computer);
  const flight = STRANGER_HOP.landAt - STRANGER_HOP.upAt;
  const rise = hopHeight(CORNER, STORM_STAND, computer);
  const hop = (a: Pt, b: Pt, from: number): Pt => (t < from + STRANGER_HOP.upAt ? a : arc(a, b, rise, clamp01((t - from - STRANGER_HOP.upAt) / flight)));
  const going = t >= S.leapAt;
  const feet = going ? hop(STORM_STAND, CORNER, S.leapAt) : hop(CORNER, STORM_STAND, 0);
  const anim = going ? { anim: "hop", since: S.leapAt } : t < STRANGER_HOP.ms ? { anim: "hop", since: 0 } : t < S.gripAt ? { anim: "stormPlant", since: STRANGER_HOP.ms } : t < S.pullAt ? { anim: "stormCharge", since: S.gripAt } : { anim: "stormPull", since: S.pullAt };
  const h = (FIG_W * STRANGER.h) / STRANGER.w;
  const airborne = (t >= STRANGER_HOP.upAt && t < STRANGER_HOP.landAt) || (t >= S.leapAt + STRANGER_HOP.upAt && t < S.leapAt + STRANGER_HOP.landAt);
  const out = nudgeAt(t);
  const stage = t < S.landAt ? "leap" : t < S.fireAt ? "draw" : t < S.gripAt ? "swords" : t < S.pullAt ? "charge" : t < S.leapAt ? "pull" : t < S.homeAt ? "back" : "heal";
  return (
    <div class="power-moment pm-storm" data-stage={stage}>
      <div class="hb-pieces pg-layer" aria-hidden="true">
        <Cracks t={t} />
        {nudged(boss.board.fen, orientation).map((n) => {
          const c = centreOf(n.square, orientation);
          return <piece key={n.square} class={`pg-piece sg-nudge ${n.code}`} data-square={n.square} style={{ left: `${r2(c.x - 6.25 + n.dx * out)}%`, top: `${r2(c.y - 6.25 + n.dy * out)}%` }} />;
        })}
        {airborne && <span class="pg-shadow" style={{ left: `${r2(going ? CORNER.x : STORM_STAND.x)}%`, top: `${r2(going ? CORNER.y : STORM_STAND.y)}%`, width: "14%", height: "4%" }} />}
        <span
          class={`pg-pig sg-fig${t >= S.gripAt && t < S.pullAt ? " sg-charge" : ""}`}
          style={{
            left: `${r2(feet.x - FIG_W * (STRANGER.foot[0] / STRANGER.w))}%`,
            top: `${r2(feet.y - h * (STRANGER.foot[1] / STRANGER.h))}%`,
            width: `${FIG_W}%`,
            aspectRatio: `${STRANGER.w} / ${STRANGER.h}`,
          }}
          data-anim={anim.anim}
        >
          <BossMoment key={`${moment.key}:${anim.anim}:${anim.since}`} boss={boss.name} anim={anim.anim} since={moment.at + anim.since} then={anim.anim === "stormCharge" ? undefined : "idle"} />
        </span>
      </div>
    </div>
  );
}

/** The storm's scene's banner and figure (its view) come with its moment; this is its whole view. */
function stormView(p: MomentProps) {
  return (
    <>
      {p.banner("STORM OF TWO WORLDS!", "Three turns of ice and fire", "storm long")}
      {stormMoment(p)}
    </>
  );
}

/** An ice turn's start: a cold burst on each piece the storm freezes (the ice itself is the board layer's, Ginger's), one after another. */
const ICE_STEP = 45;
const iceFrom = (m: Moment, square: string): number | undefined => {
  const i = m.squares?.indexOf(square) ?? -1;
  return i < 0 ? undefined : m.at + 200 + i * ICE_STEP;
};
function stormIceMoment({ moment, t, orientation }: MomentProps) {
  return (
    <div class="power-moment pm-stay pm-storm-ice">
      {(moment.squares ?? []).map((sq, i) => {
        const at = 200 + i * ICE_STEP;
        return t >= at - 60 && t < at + 900 ? <span key={sq} class="pw-frost" style={{ ...onSquare(sq, orientation), animationDelay: `${at - 60 - t}ms` }} /> : null;
      })}
    </div>
  );
}
/** A fire turn's start: each marked square bursts alight (its tile is the board layer's, Grex's), one after another. */
const FIRE_STEP = 160;
const fireFrom = (m: Moment, square: string): number | undefined => {
  const i = m.squares?.indexOf(square) ?? -1;
  return i < 0 ? undefined : m.at + 250 + i * FIRE_STEP;
};
function stormFireMoment({ moment, t, orientation }: MomentProps) {
  const items: BoardItem[] = (moment.squares ?? []).flatMap((square, i) => (t >= 250 + i * FIRE_STEP && t < 250 + i * FIRE_STEP + 500 ? [{ square, name: "strangerSquare" as const, anim: "ignite", since: moment.at + 250 + i * FIRE_STEP }] : []));
  return <div class="power-moment pm-stay pm-storm-fire">{items.length > 0 && <BoardEffects items={items} orientation={orientation} class="pw-fire-board" />}</div>;
}
/** A fire turn's burn as your move lands: Grex's burn on each marked square (his own burn sound, quiet: Grex's poof is Grex's). */
function stormBurnMoment({ boss, moment, now, orientation }: MomentProps) {
  const sc = boss.powers?.stranger?.scorch;
  const burnt = (sc?.burnt ?? []).map((b) => ({ square: b.square, ...(b.piece && !b.spared ? { piece: b.piece } : {}), ...(b.spared ? { fizzled: true } : {}) }));
  return (
    <div class="power-moment pm-stay pm-storm-burn">
      <FireBurn burnt={burnt} since={moment.at} now={now} orientation={orientation} quiet />
    </div>
  );
}

/** The storm's opening scene, if it's playing now: its start (its own clock), for the ring and the board (null: none). */
const sceneOf = (moments: readonly Moment[], now: number): number | null => {
  const m = moments.find((x) => x.kind === "storm");
  return m && now >= m.at - (m.lead ?? 0) && now < m.at + m.ms ? m.at : null;
};

export const STRANGER_UI = {
  id: "stranger",
  ultimate: { name: "the Storm of Two Worlds" },
  moments: {
    frostfire: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: strikeMoment },
    frostfireBurn: { order: 0, kit: "power", dock: (m) => (m.fizzled?.length ? "The fire spared the piece there." : m.shape ? "The square burnt." : "The square burnt empty."), view: burnMoment },
    // (His finisher, while he still thinks: strangerTurnMoments. No banner: his move is an ordinary capture.)
    finisher: { order: 2, dock: (m) => `Your ${PIECE_WORD[m.shape ?? "n"] ?? "piece"} falls.`, view: finisherMoment },
    // His storm: its opening scene (his banner, his leap, the swords in the board), then each of its turns as it begins, and a fire
    // turn's burn as your move lands.
    storm: { order: 1, kit: "ultimate", lineAt: STORM_SCENE.fireAt, view: stormView },
    stormIce: { order: 2, appearAt: iceFrom, dock: (m) => (m.squares?.length ? "Ice: only your king and two pieces can move this turn." : "The storm swirls. Nothing froze."), view: stormIceMoment },
    stormFire: { order: 2, appearAt: fireFrom, dock: (m) => (m.squares?.length ? "Fire: whatever stands on a burning square after your move burns." : "The storm swirls. Nothing caught fire."), view: stormFireMoment },
    stormBurn: { order: 0, dock: (m) => (m.fizzled?.length ? "The fire spared a piece." : "The marked squares burnt."), view: stormBurnMoment },
  },
  // The frozen piece's ice (the characters' iceOverlay, as Ginger's freeze), and on the flee turn its tile ablaze, its countdown 1.
  board: ({ boss, p, board, orientation, now, appearAt, moments }) => {
    const crowd = (sq: string) => pieceAt(board, sq)?.color === boss.crowdSide;
    const iced = p.iced.filter(crowd);
    const fx = EFFECTS.iceOverlay;
    const st = p.stranger?.strike ?? null;
    const flee = st && p.turn > st.frozenUntil && p.turn <= st.burnAt ? st.square : null;
    // (His storm: its ring while its turns run (and through its opening scene), and a fire turn's marked squares ablaze.)
    const scene = sceneOf(moments, now);
    const storm = scene !== null || (!!p.stranger?.storm && stormOn(p.stranger, p.turn));
    const pick = p.stranger?.pick;
    const marks = pick?.kind === "fire" && pick.turn === p.turn ? pick.squares.filter((sq) => now >= appearAt(sq)) : [];
    return {
      over: (
        <>
          {storm && <StormRing scene={scene} />}
          {marks.length > 0 && <BoardEffects items={marks.map((square) => ({ square, name: "fireTile" as const, anim: "stage3", since: 0 }))} orientation={orientation} class="pw-fire-board" />}
          {marks.map((sq) => (
            <span key={`storm-${sq}`} class="pw-fire stage-3 pw-storm-fire" style={onSquare(sq, orientation)} data-square={sq} data-stage={3}>
              <b class="pw-count">1</b>
            </span>
          ))}
          {flee && <BoardEffects items={[{ square: flee, name: "fireTile", anim: "stage3", since: 0 }]} orientation={orientation} class="pw-fire-board" />}
          {flee && (
            <span key={`frostfire-${flee}`} class="pw-fire stage-3 pw-frostfire" style={onSquare(flee, orientation)} data-square={flee} data-stage={3}>
              <b class="pw-count">1</b>
            </span>
          )}
          {iced.map((sq) => {
            const t = appearAt(sq);
            if (now < t) return null;
            return (
              <span key={`ice-${sq}`} class="pw-ice" style={onSquare(sq, orientation)} data-square={sq}>
                <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={fx.sounds} id={sq} />
              </span>
            );
          })}
        </>
      ),
    };
  },
} satisfies BossUi;
