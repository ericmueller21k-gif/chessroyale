import { STORM_SCENE, STRANGER_FX, applyMove, finisherOf, pieceAt, stormOn, type Finisher } from "@chessroyale/chess";
import { useLayoutEffect, useRef } from "preact/hooks";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import { STRANGER, STRANGER_HOP } from "../characters/stranger.ts";
import riftUrl from "../characters/stranger-rift.webp?url";
import stormUrl from "../characters/stranger-storm.webp?url";
import type { BossView } from "../game.ts";
import { figureRestBox } from "./BossCharacter.tsx";
import { BoardEffects, BossMoment, SpriteAnim, onEachFrame, prewarm, type BoardItem } from "./BossEffect.tsx";
import { FREEZE } from "./Ginger.tsx";
import { BURN, FireBurn } from "./Grex.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, PIECE_WORD, onComputer, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";
import { STORM_SHORT } from "../refused.ts";

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
 * His place at rest, measured (Eric, Nov 27: "he kind of hops down, and it almost looked like his size shrunk a bit"): his feet (% of the
 * board) and his box's width (% of it) where his own figure stands, in a phone's bar above the board or beside a computer's. His hop
 * starts and ends exactly there, at that size, and he grows to his size on the board (FIG_W) through the jump and back, so the hand-off
 * between his figure and the moment's is never seen. Measured once a moment, from his figure at rest (.claude/LESSONS.md: a layout is
 * measured from settled state); where there's none to measure (a test), his corner of the board at his board size.
 */
export type Stand = Pt & { w: number };
const homes = new Map<string, Stand>();
export function homeOf(computer: boolean, key = ""): Stand {
  const fallback: Stand = { ...cornerOf(computer), w: FIG_W };
  if (typeof document === "undefined") return fallback;
  const id = `${key}:${window.innerWidth}x${window.innerHeight}`;
  const had = homes.get(id);
  if (had) return had;
  // (The board's own box: what the moment's figure is placed in.)
  const board = (document.querySelector(".board-wrap .hb-board") ?? document.querySelector(".board-wrap .power-board"))?.getBoundingClientRect();
  const sprite = [...document.querySelectorAll(".boss-char.ch-stranger .boss-char-sprite")].find((el) => el.getBoundingClientRect().width > 0);
  if (!board?.width || !sprite) return fallback;
  const b = figureRestBox(sprite, STRANGER, false);
  const k = b.width / STRANGER.w;
  // (His frame's box whole on the screen: his own figure's may hang half a pixel off a phone's edge, its clear margin; the moment's
  // box never does, moved in by that much. Eric, Nov 4: sprites always on screen.)
  const left = Math.max(0.1, b.left);
  const top = Math.max(0.1, b.top);
  const home: Stand = { x: r2(((left + STRANGER.foot[0] * k - board.left) / board.width) * 100), y: r2(((top + STRANGER.foot[1] * k - board.top) / board.width) * 100), w: r2((b.width / board.width) * 100) };
  homes.set(id, home);
  if (homes.size > 8) homes.delete(homes.keys().next().value!);
  return home;
}
/** His feet and size `u` of the way through a hop from `a` to `b` (its arc `h` high): his size eases between the two as he flies. */
export const fly = (a: Stand, b: Stand, h: number, u: number): Stand => ({ ...arc(a, b, h, u), w: a.w + (b.w - a.w) * u * u * (3 - 2 * u) });
/**
 * His figure's box for his feet and size there (% of the board): his board-size box with his feet on the spot, scaled about his feet
 * (a transform: no layout as he flies, and his box's own size never changes).
 */
const FOOT = { x: STRANGER.foot[0] / STRANGER.w, y: STRANGER.foot[1] / STRANGER.h };
const figBox = (at: Stand) => {
  const h = (FIG_W * STRANGER.h) / STRANGER.w;
  return { left: `${r2(at.x - FIG_W * FOOT.x)}%`, top: `${r2(at.y - h * FOOT.y)}%`, width: `${FIG_W}%`, aspectRatio: `${STRANGER.w} / ${STRANGER.h}`, transformOrigin: `${r2(FOOT.x * 100)}% ${r2(FOOT.y * 100)}%`, scale: String(Math.round((at.w / FIG_W) * 10000) / 10000) };
};
/**
 * His figure's light on the board while the storm's shade is on (`shaded`): his own figure in his place is under the shade, so the
 * moment's dims to match as it comes home (`away`: 0 in his place, 1 on the board), and the hand-off isn't a flash.
 */
const figLight = (shaded: boolean, away: number): Record<string, string> => (shaded && away < 1 ? { filter: `drop-shadow(0 0.8cqw 0 rgba(0, 0, 0, 0.3)) brightness(${r2(1 - STORM_ART.dim * (1 - clamp01(away)))})` } : {});

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
  const CORNER = homeOf(computer, moment.key);
  const stand: Stand = { ...finisherStand(square, orientation, computer), w: FIG_W };
  const flight = STRANGER_HOP.landAt - STRANGER_HOP.upAt;
  const rise = hopHeight(CORNER, stand, computer);
  const flown = (from: number) => clamp01((t - from - STRANGER_HOP.upAt) / flight);
  const going = t >= tl.backAt;
  const feet = going ? fly(stand, CORNER, rise, flown(tl.backAt)) : fly(CORNER, stand, rise, flown(0));
  const anim = going ? { anim: "hop", since: tl.backAt } : t < tl.finAt ? { anim: "hop", since: 0 } : { anim: `fin_${kind}`, since: tl.finAt };
  // (Through his storm's turns the page round the board is shaded, his own figure with it.)
  const light = figLight(!!boss.powers && stormOn(boss.powers.stranger, boss.powers.turn), going ? 1 - flown(tl.backAt) : flown(0));
  const airborne = (t >= STRANGER_HOP.upAt && t < tl.landAt) || (t >= tl.backAt + STRANGER_HOP.upAt && t < tl.homeAt);
  const items = finishItems(tl, square, piece, moment.at, t);
  const c = centreOf(square, orientation);
  const cutU = kind === "cut" ? (t - tl.goneAt) / HALVES_MS : -1;
  return (
    <div class="power-moment pm-finisher" data-finisher={kind} data-square={square} data-stage={t < tl.landAt ? "hop" : t < tl.goneAt ? "strike" : t < tl.backAt ? "gone" : "back"}>
      {items.length > 0 && <BoardEffects items={items} orientation={orientation} class="pw-fire-board" />}
      <div class="hb-pieces pg-layer" aria-hidden="true">
        {airborne && !going && <span class="pg-shadow" style={{ left: `${r2(stand.x)}%`, top: `${r2(stand.y)}%`, width: "14%", height: "4%" }} />}
        {cutU >= 0 && cutU < 1 && <Halves code={`${COLOR[boss.crowdSide]} ${PIECE_WORD[piece] ?? "knight"}`} at={c} u={cutU} />}
        <span class="pg-pig sg-fig" style={{ ...figBox(feet), ...light }} data-anim={anim.anim}>
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
  // (His storm's ring and rift: their sheets fetched and decoded now, not at boot and not as the storm begins.)
  sheetOf("storm");
  sheetOf("rift");
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
  const seen = (key: string) => {
    let at = turnSeen.get(key);
    if (at === undefined) {
      turnSeen.set(key, (at = now));
      if (turnSeen.size > 20) turnSeen.delete(turnSeen.keys().next().value!);
    }
    return at;
  };
  // (The burns as your move landed, his Frostfire's tile or his storm's marks: at once, as his thinking begins; strangerTurnMs gives
  // them their time in it.)
  const burns = p.events
    .filter((e) => (e.kind === "frostfireBurn" || e.kind === "stormBurn") && e.turn === p.turn)
    .map((e) => {
      const key = `${boss.id}:${boss.startMove}:${p.turn}:${e.kind}`;
      return { kind: e.kind, key, at: seen(key), ms: STRANGER_FX[e.kind as "frostfireBurn" | "stormBurn"], ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: e.squares } : {}), ...(e.fizzled ? { fizzled: e.fizzled } : {}), ...(e.shape ? { shape: e.shape } : {}) } satisfies Moment;
    });
  const finishers = p.events
    .filter((e) => e.kind === "finisher" && e.turn === p.turn && e.square)
    .map((e) => {
      const key = `${boss.id}:${boss.startMove}:${p.turn}:finisher:${e.square}`;
      return { kind: "finisher", key, at: seen(key), ms: STRANGER_FX.finisher, square: e.square!, ...(e.shape ? { shape: e.shape } : {}), ...(e.pick !== undefined ? { pick: e.pick } : {}), ...(e.move ? { move: e.move } : {}) } satisfies Moment;
    });
  return [...burns, ...finishers];
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

const ease = (u: number) => 1 - (1 - clamp01(u)) ** 2;
const lerp = (a: number, b: number, u: number) => a + (b - a) * clamp01(u);

/**
 * The storm's art (Eric, Nov 27: "a realistic blend of shards of fire and ice tornado ... it should be a fairly quick loop ... like a GIF
 * basically"; then "a bit more Game Boy Advance style, but still keep the details"): drawn once, offline (scripts/storm-art: render.py,
 * rift.py, pack.py), and only played back here. Nothing is drawn per particle: a frame is a few image draws on one small canvas.
 *
 * The ring's sheet (`stranger-storm.webp`): `frames` frames, `cols` a row, each a fire cell then an ice cell (`cell` x `px`); the fire cell
 * is the frame's left `cell` pixels, the ice cell its right `cell`; the still frost is the ice cell of one more frame after the last.
 * `margin`: how far past the board the ring's frame reaches each side (a share of the board; the CSS's 12%). `see`: the storm's own
 * opacity over what it overlaps; `dim`: how much darker everything but the board is through the storm (the page's shade: Eric, Nov 27,
 * "everything should get a little dulled, so it's more of a focus on the board"), eased in over `dimIn` ms and out over `dimOut` (all
 * three in the CSS too, here for the record and his figure's match); `steps`: the build's steps (the ring gathers in that many).
 */
export const STORM_ART = { px: 250, cell: 170, frames: 36, cols: 6, fps: 12, margin: 0.12, see: 0.88, dim: 0.5, dimIn: 1200, dimOut: 800, steps: 48 } as const;
/**
 * The rift's sheet (`stranger-rift.webp`, `cols` frames a row of `px` x `px`): each heal stage's loop (`loop` frames at `loopFps`), then
 * the opening's frames (`openA` from the fire sword's slam, `openB` from the ice sword's, at `openFps`), ending on stage 1. `see`: its
 * opacity on the board (the CSS's; Eric, Nov 27: "the crack is too distracting, so make it 50% opacity").
 */
export const RIFT_ART = { px: 202, cols: 8, stages: 3, loop: 4, loopFps: 6, openA: 9, openB: 10, openFps: 12, see: 0.5 } as const;

/** A sheet, fetched and decoded ahead as his battle shows (prewarmStranger): `src` once it can be drawn; `dead` once released. */
type Sheet = { src: CanvasImageSource | null; dead?: boolean };
const sheets: { storm?: Sheet; rift?: Sheet } = {};
function sheetOf(which: "storm" | "rift"): Sheet {
  const had = sheets[which];
  if (had) return had;
  const sheet: Sheet = { src: null };
  sheets[which] = sheet;
  if (typeof Image === "undefined") return sheet;
  const img = new Image();
  const ready = () => {
    if (sheet.dead) return;
    sheet.src = img;
    // (Kept decoded, so no frame's draw waits on a decode.)
    if (typeof createImageBitmap === "function")
      createImageBitmap(img).then(
        (b) => (sheet.dead ? b.close() : (sheet.src = b)),
        () => undefined,
      );
  };
  img.onload = ready;
  img.src = which === "storm" ? stormUrl : riftUrl;
  return sheet;
}

/**
 * The sheets let go once his battle's screen has closed (BossCharacter): about 19.5 MB decoded, so they don't stay for the rest of the
 * session (review of #1023). A later battle of his fetches them again. Not at once: the match's screens are drawn again every phase,
 * his figure with them, and letting go then dropped the ring and the rift for a frame at every turn of the storm and decoded both
 * sheets again (Nov 27). `keepStranger` (his figure drawn again) calls it off; `RELEASE_MS` with no figure of his, and they go.
 */
export const RELEASE_MS = 3000;
let letGo: ReturnType<typeof setTimeout> | undefined;
export function keepStranger(): void {
  clearTimeout(letGo);
}
export function releaseStranger(now = false): void {
  clearTimeout(letGo);
  const go = () => {
    dropShade(true);
    for (const k of ["storm", "rift"] as const) {
      const s = sheets[k];
      if (!s) continue;
      s.dead = true;
      if (typeof ImageBitmap !== "undefined" && s.src instanceof ImageBitmap) s.src.close();
      s.src = null;
      delete sheets[k];
    }
  };
  if (now) go();
  else letGo = setTimeout(go, RELEASE_MS);
}

/**
 * How strong the storm is at `now`: `fire` and `ice`, how much of each element's ring has gathered (0 none, 1 whole); `chaos`, the
 * charge's wild layer. During its opening scene (`scene`: the moment's start, its own clock) the fire gathers from the fire sword's slam
 * and the ice from the ice sword's, from nothing, both whole by his grip (Eric, Nov 27: "It should have a startup animation where it
 * builds more and more"); the charge builds to the full swirl and eases back as he leaves; through its turns, steady.
 */
export function stormLevel(scene: number | null, now: number): { fire: number; ice: number; chaos: number } {
  if (scene === null) return { fire: 1, ice: 1, chaos: 0 };
  const t = now - scene;
  const S = STORM_SCENE;
  const rise = (from: number) => clamp01((t - from) / (S.gripAt - from));
  const chaos = t < S.gripAt ? 0 : t < S.fullAt ? ease((t - S.gripAt) / (S.fullAt - S.gripAt)) : t < S.pullAt ? 1 : 1 - ease((t - S.pullAt) / (S.leapAt - S.pullAt));
  return { fire: rise(S.fireAt), ice: rise(S.iceAt), chaos };
}

/**
 * How the ring gathers (Eric, Nov 27: "the tornado around the board kind of just appeared at once ... It should have a startup animation
 * where it builds more and more"): when each pixel of the ring's canvas joins it, as a share of its element's build (0-254 of 255).
 * Each element runs round the board the way the storm turns, from where its fissure points: the fire from the bottom-left corner up the
 * left side and across the top, the ice from the top-right corner down the right side and along the bottom. A pixel joins sooner the
 * nearer it is to its element's start (`along`) and to the board's edge (`off`: the ring is a thin line there first, then thickens),
 * and by a little noise (`rough`: soft blobs and an ordered dither, so its front is a few wisps, never a clean line). `ice`: which
 * element a pixel is (by the corner-to-corner diagonal). Made once (62,500 pixels), pure.
 */
export const RING_BUILD = { along: 0.5, off: 0.3, rough: 0.2 } as const;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
let ringArrival: { at: Uint8Array; ice: Uint8Array } | null = null;
export function ringArrivals(): { at: Uint8Array; ice: Uint8Array } {
  if (ringArrival) return ringArrival;
  const n = STORM_ART.px;
  const at = new Uint8Array(n * n);
  const ice = new Uint8Array(n * n);
  // (The board's edge in the canvas: `margin` of the board past it each side.)
  const lo = (n * STORM_ART.margin) / (1 + 2 * STORM_ART.margin);
  const hi = n - lo;
  // (Soft blobs: a small lattice of fixed pseudo-random values, smoothed between.)
  const cell = 14;
  const lattice = (ix: number, iy: number) => {
    const v = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const blob = (x: number, y: number) => {
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const ux = fx - ix;
    const uy = fy - iy;
    const sx = ux * ux * (3 - 2 * ux);
    const sy = uy * uy * (3 - 2 * uy);
    return lerp(lerp(lattice(ix, iy), lattice(ix + 1, iy), sx), lerp(lattice(ix, iy + 1), lattice(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // (Clockwise from the bottom-left corner, in half turns: 0-1 the fire's side, 1-2 the ice's.)
      const deg = (Math.atan2(n / 2 - (y + 0.5), x + 0.5 - n / 2) * 180) / Math.PI;
      const turn = (((225 - deg) % 360) + 360) % 360;
      const icy = turn >= 180;
      const along = (icy ? turn - 180 : turn) / 180;
      // (How far from the board's edge line, inside or out, as a share of the margin.)
      const dx = Math.max(lo - x, 0, x - hi);
      const dy = Math.max(lo - y, 0, y - hi);
      const out = Math.hypot(dx, dy);
      const inside = out > 0 ? 0 : Math.min(x - lo, hi - x, y - lo, hi - y);
      const off = clamp01((out > 0 ? out : inside) / lo);
      const rough = 0.6 * blob(x, y) + 0.4 * (BAYER[(y % 4) * 4 + (x % 4)]! / 15);
      const i = y * n + x;
      ice[i] = icy ? 1 : 0;
      at[i] = Math.min(254, Math.round(254 * (RING_BUILD.along * along + RING_BUILD.off * off + RING_BUILD.rough * rough)));
    }
  ringArrival = { at, ice };
  return ringArrival;
}
/** The build's step for how much of an element has gathered (0 to STORM_ART.steps): the ring changes only as a step does. */
export const buildStep = (gathered: number): number => Math.round(clamp01(gathered) * STORM_ART.steps);
/** The build's mask for the two elements' steps, on its own small canvas (made on first use): a pixel shows once its element has gathered past its arrival. */
let maskCv: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData; key: string } | null = null;
function ringMask(fire: number, ice: number): HTMLCanvasElement | null {
  const n = STORM_ART.px;
  if (!maskCv) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const g = cv.getContext("2d");
    if (!g) return null;
    maskCv = { cv, g, img: g.createImageData(n, n), key: "" };
  }
  const key = `${fire}:${ice}`;
  if (maskCv.key !== key) {
    maskCv.key = key;
    const { at, ice: icy } = ringArrivals();
    const f = (fire / STORM_ART.steps) * 255;
    const c = (ice / STORM_ART.steps) * 255;
    const d = maskCv.img.data;
    for (let i = 0; i < at.length; i++) d[i * 4 + 3] = at[i]! < (icy[i] ? c : f) ? 255 : 0;
    maskCv.g.putImageData(maskCv.img, 0, 0);
  }
  return maskCv.cv;
}

/** The ring's frame at `now` (the clock alone; twice as fast through the thick of the charge). */
export const ringFrame = (now: number, chaos: number): number => Math.floor((now / 1000) * STORM_ART.fps * (chaos > 0.5 ? 2 : 1)) % STORM_ART.frames;

/**
 * One frame of the ring: the frost, then each element's cell in its place, the turn's own element (`lead`) whole and doubled (a second
 * copy half a loop on) with the other fainter behind it; through the charge both doubled.
 */
function paintRing(g: CanvasRenderingContext2D, img: CanvasImageSource, now: number, level: { fire: number; ice: number; chaos: number }, lead: "fire" | "ice" | null): void {
  const A = STORM_ART;
  g.clearRect(0, 0, A.px, A.px);
  const f = ringFrame(now, level.chaos);
  const far = (f + A.frames / 2) % A.frames;
  const cell = (i: number, ice: boolean, alpha: number) => {
    if (alpha <= 0.01) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(img, (i % A.cols) * 2 * A.cell + (ice ? A.cell : 0), Math.floor(i / A.cols) * A.px, A.cell, A.px, ice ? A.px - A.cell : 0, 0, A.cell, A.px);
  };
  // (What has gathered shows nearly whole from the start, a little fainter while it's young: the build is the mask's, below.)
  const shown = (el: "fire" | "ice") => (level[el] <= 0 ? 0 : lerp(0.6, 1, level[el]));
  const own = (el: "fire" | "ice") => (lead === null ? 0.9 : lead === el ? 1 : 0.8) * shown(el);
  const twice = (el: "fire" | "ice") => Math.max(lead === el ? 0.6 : 0, 0.6 * level.chaos) * shown(el);
  cell(A.frames, true, shown("ice") * (lead === "fire" ? 0.75 : 1));
  for (const el of lead === "fire" ? (["ice", "fire"] as const) : (["fire", "ice"] as const)) {
    cell(far, el === "ice", twice(el));
    cell(f, el === "ice", own(el));
  }
  g.globalAlpha = 1;
  // (While it gathers: only the pixels that have joined it.)
  if (level.fire < 1 || level.ice < 1) {
    const mask = ringMask(buildStep(level.fire), buildStep(level.ice));
    if (mask) {
      g.globalCompositeOperation = "destination-in";
      g.drawImage(mask, 0, 0);
      g.globalCompositeOperation = "source-over";
    }
  }
}

/**
 * What the storm's canvases last drew (the tests' read: the ring's frame, the rift's sheet frame, -1 nothing yet; `strength`, how much
 * of the ring has gathered, 0 to 1). `by`: which canvas wrote each, so one taken away as its screen is drawn again never clears what
 * the new one drew.
 */
const drawn = { ring: -1, rift: -1, strength: 0, by: { ring: null as object | null, rift: null as object | null } };
if (typeof window !== "undefined") (window as unknown as { __stormArt?: typeof drawn }).__stormArt = drawn;

/**
 * The storm's shade (Eric, Nov 27: "I had said dimming everything, and it still isn't dark. Even the scoreboard underneath ...
 * everything should get a little dulled, so it's more of a focus on the board during those 3 turns"): one see-through layer over the
 * whole page (STORM_ART.dim), the board and everything drawn on it raised above it (styles.css `.sg-shade`, `.sg-shading`), never
 * taking a tap. One element on the page, not the screen's: the match's screens are drawn again every phase, and it must neither blink
 * nor fade in again. It follows the ring: on while the ring draws (`keepShade`, each frame), eased out once the ring has been gone a
 * moment (the storm over, or its screen closed).
 */
const shade = { el: null as HTMLElement | null, on: false, at: 0, watch: 0 as unknown as ReturnType<typeof setInterval>, out: 0 as unknown as ReturnType<typeof setTimeout> };
const SHADE_GONE_MS = 400;
function keepShade(now: number): void {
  shade.at = now;
  if (shade.on || typeof document === "undefined") return;
  shade.on = true;
  clearTimeout(shade.out);
  if (!shade.el) {
    shade.el = document.createElement("div");
    shade.el.className = "sg-shade";
    shade.el.setAttribute("aria-hidden", "true");
    document.body.appendChild(shade.el);
    // (Its first style read, so it eases in from clear.)
    void shade.el.offsetWidth;
  }
  document.documentElement.classList.add("sg-shading");
  shade.el.classList.add("on");
  shade.watch = setInterval(() => Date.now() - shade.at > SHADE_GONE_MS && dropShade(false), 200);
}
/** The shade off: eased out, then taken away (`now`: at once, as his battle's screen closes). */
function dropShade(now: boolean): void {
  clearInterval(shade.watch);
  clearTimeout(shade.out);
  shade.on = false;
  const el = shade.el;
  if (!el) return;
  el.classList.remove("on");
  const gone = () => {
    if (shade.on) return;
    el.remove();
    if (shade.el === el) shade.el = null;
    document.documentElement.classList.remove("sg-shading");
  };
  if (now) gone();
  else shade.out = setTimeout(gone, STORM_ART.dimOut + 50);
}

/**
 * The storm's ring round the board (Eric: "he shrouds around the board ... this fire and ice storm around the board, and it even can kind
 * of move onto the board a little bit"): fire up the left and across the top, frost wind, shards and icicles down the right and along the
 * bottom. One small canvas, scaled up as pixels, a frame of its sheet blitted from the clock alone on the shared frame loop (a screen
 * drawn again carries on where it was; nothing kept). `scene`: its opening scene's start (it gathers through it), or null (steady);
 * `lead`: the turn's element.
 */
function StormRing({ scene, lead }: { scene: number | null; lead: "fire" | "ice" | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const at = useRef({ scene, lead });
  at.current = { scene, lead };
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    // (The sheet read each draw, not kept: released, it's fetched again rather than left blank.)
    // (Through the storm's turns the picture changes only with its frame (12 a second) or the turn's element: drawn then alone, not every
    // frame. In the opening scene its strength changes every frame, so it's drawn every frame there. Review of #1023.)
    // In its opening scene its strength changes, so it's drawn as its frame, its build's step or the charge's strength does.
    let last = "";
    const me = {};
    const draw = () => {
      const now = Date.now();
      const { scene, lead } = at.current;
      // (The page's shade with it: from the first sword in its opening scene, and through its turns.)
      if (scene === null || now >= scene + STORM_SCENE.fireAt) keepShade(now);
      const sheet = sheetOf("storm");
      if (!sheet.src) return;
      const level = stormLevel(scene, now);
      const f = ringFrame(now, level.chaos);
      const key = scene === null ? `${f}:${lead}` : `${f}:${buildStep(level.fire)}:${buildStep(level.ice)}:${Math.round(level.chaos * 20)}`;
      if (key === last) return;
      last = key;
      paintRing(g, sheet.src, now, level, lead);
      drawn.by.ring = me;
      drawn.ring = level.fire > 0 ? f : -1;
      drawn.strength = r2((level.fire + level.ice) / 2);
    };
    draw();
    const stop = onEachFrame(draw);
    return () => {
      stop();
      if (drawn.by.ring !== me) return;
      drawn.ring = -1;
      drawn.strength = 0;
    };
  }, []);
  return <canvas ref={cv} class="sg-storm" width={STORM_ART.px} height={STORM_ART.px} aria-hidden="true" data-storm={scene === null ? "on" : "scene"} />;
}

/**
 * The rift's frame in its sheet at `now`, or -1 (nothing). In the opening scene (`scene`: its start): nothing until the fire sword's
 * slam, then the opening's frames (the lava fissure tearing out, held; from the ice sword's slam, the ice fissure), then stage 1's
 * loop on the scene's clock. Through the storm's turns: `stage`'s loop (0 whole, then closing each turn), by the clock.
 */
export function riftFrame(scene: number | null, stage: number, now: number): number {
  const R = RIFT_ART;
  const S = STORM_SCENE;
  if (scene !== null) {
    const t = now - scene;
    if (t < S.fireAt) return -1;
    const open = R.stages * R.loop;
    if (t < S.iceAt) return open + Math.min(R.openA - 1, Math.floor(((t - S.fireAt) * R.openFps) / 1000));
    const b = Math.floor(((t - S.iceAt) * R.openFps) / 1000);
    return b < R.openB ? open + R.openA + b : Math.floor(((t - S.fireAt) * R.loopFps) / 1000) % R.loop;
  }
  return stage < 0 || stage >= R.stages ? -1 : stage * R.loop + (Math.floor((now * R.loopFps) / 1000) % R.loop);
}

/**
 * The rift his storm tears in the board (Eric, Nov 27: "like somebody ripped open the board"): one impact between his swords, a lava
 * fissure to the lower left, an ice fissure to the upper right, under the pieces. It opens with the swords in the opening scene, stays
 * through the storm's turns and heals a little each turn (`stage`), gone with the storm. One small canvas, drawn only when its frame
 * changes.
 */
function StormRift({ scene, stage }: { scene: number | null; stage: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const at = useRef({ scene, stage });
  at.current = { scene, stage };
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    const R = RIFT_ART;
    let shown = -2;
    const me = {};
    const draw = () => {
      const sheet = sheetOf("rift");
      if (!sheet.src) return;
      const f = riftFrame(at.current.scene, at.current.stage, Date.now());
      if (f === shown) return;
      shown = f;
      drawn.by.rift = me;
      drawn.rift = f;
      g.clearRect(0, 0, R.px, R.px);
      if (f >= 0) g.drawImage(sheet.src, (f % R.cols) * R.px, Math.floor(f / R.cols) * R.px, R.px, R.px, 0, 0, R.px, R.px);
    };
    draw();
    const stop = onEachFrame(draw);
    return () => {
      stop();
      if (drawn.by.rift === me) drawn.rift = -1;
    };
  }, []);
  return <canvas ref={cv} class="sg-rift" width={RIFT_ART.px} height={RIFT_ART.px} aria-hidden="true" data-stage={stage} />;
}

/** Where he stands for the storm's scene (% of the board): his feet a little below its middle, his head on it. */
const STORM_STAND: Stand = { x: 50, y: 56, w: FIG_W };
/** His swords' points in the board as they go in (% of the board): either side of his feet, at the ground line. */
const swordPoints = (): { fire: Pt; ice: Pt } => {
  const dx = (FIG_W * 12) / STRANGER.w;
  return { fire: { x: STORM_STAND.x - dx, y: STORM_STAND.y }, ice: { x: STORM_STAND.x + dx, y: STORM_STAND.y } };
};

/** The swords' ripples in the board (one SVG in % of the board): rings out from each sword's point from its slam, faster through the charge. */
function Ripples({ t }: { t: number }) {
  const S = STORM_SCENE;
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
  // (Each stab's own two big ripples, Eric, Nov 28: out from the sword's point to the board's edge, cut there, one a beat behind the other.)
  const big = (from: number, at: Pt, cls: string) =>
    [0, 1].flatMap((k) => {
      const u = (t - from - k * THROW.rippleGap) / THROW.rippleMs;
      if (u < 0 || u >= 1) return [];
      const reach = Math.max(Math.hypot(at.x, at.y), Math.hypot(100 - at.x, at.y), Math.hypot(at.x, 100 - at.y), Math.hypot(100 - at.x, 100 - at.y));
      return [<circle key={`big-${cls}${k}`} class={`${cls} sg-big`} cx={at.x} cy={at.y} r={r2(3 + ease(u) * (reach - 3))} style={{ opacity: String(r2((1 - u) * 0.9)), strokeWidth: String(r2(2.2 - 1.4 * u)) }} />];
    });
  return (
    <svg class="sg-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <clipPath id="sg-board-clip">
        <rect x="0" y="0" width="100" height="100" />
      </clipPath>
      {rings(S.fireAt, pts.fire, "sg-ripple sg-fire")}
      {rings(S.iceAt, pts.ice, "sg-ripple sg-ice")}
      <g clip-path="url(#sg-board-clip)">
        {big(S.fireAt, pts.fire, "sg-ripple sg-fire")}
        {big(S.iceAt, pts.ice, "sg-ripple sg-ice")}
      </g>
    </svg>
  );
}

/**
 * The pieces his storm throws (Eric, Nov 28: "the pieces in the center 5x5 fly back hard a little on the first stab, are blasted to the
 * board's edge on the second, reset when he jumps away"; drawn only: the position never changes): every piece within `reach` of the
 * point between his swords (% of the board: about two and a half squares, the middle five by five). As he lands, those nearest are
 * shoved aside a little (`land`); the first stab knocks each back `knock` (less the further out it stands) with a small bounce and a
 * tilt; the second blasts it along its line from him to the board's edge (`edge`: an edge square's middle; pieces on one line land one
 * behind another, `queue` apart), tumbling `turns` on the way, a hop high `hop`, a bounce off the edge; as he leaps away each flies home.
 * A thrown piece trails two ghosts while it moves (`trailMs` apart). `rippleMs`, `rippleGap`: each stab's two big ripples.
 */
export const THROW = { reach: 36, land: 6.5, knock: 10, knockMs: 320, blastMs: 560, edge: 6.25, queue: 8, turns: 1.5, hop: 7, trailMs: 45, rippleMs: 950, rippleGap: 170 } as const;
export interface Thrown {
  square: string;
  code: string;
  /** Its way out from him (a unit), and how far it goes at each beat (% of the board): the landing's shove, the knock, the edge. */
  ux: number;
  uy: number;
  shove: number;
  knock: number;
  far: number;
  /** Which way it tumbles (1 or -1). */
  spin: number;
}
let thrownMemo: { key: string; list: Thrown[] } | null = null;
export function nudged(fen: string, o: Orientation): Thrown[] {
  const key = `${fen.split(" ")[0]}:${o}`;
  if (thrownMemo?.key === key) return thrownMemo.list;
  const from: Pt = { x: STORM_STAND.x, y: STORM_STAND.y - 3 };
  const out: (Thrown & { d: number })[] = [];
  for (const f of "abcdefgh")
    for (let r = 1; r <= 8; r++) {
      const square = `${f}${r}`;
      const pc = pieceAt(fen, square);
      if (!pc) continue;
      const c = centreOf(square, o);
      let vx = c.x - from.x;
      let vy = c.y - from.y;
      const d = Math.hypot(vx, vy);
      if (d > THROW.reach) continue;
      // (Right on the spot: out to one side.)
      if (d < 1) [vx, vy] = [f.charCodeAt(0) % 2 ? 1 : -1, 0];
      const n = Math.max(1, Math.hypot(vx, vy));
      const ux = vx / n;
      const uy = vy / n;
      // (Along its line to the box of the edge squares' middles.)
      const E = THROW.edge;
      const tx = ux > 0 ? (100 - E - from.x) / ux : ux < 0 ? (E - from.x) / ux : Infinity;
      const ty = uy > 0 ? (100 - E - from.y) / uy : uy < 0 ? (E - from.y) / uy : Infinity;
      out.push({ square, code: `${COLOR[pc.color as "w" | "b"]} ${PIECE_WORD[pc.type] ?? "pawn"}`, ux, uy, shove: Math.max(0, (24 - d) / 24) * THROW.land, knock: THROW.knock * (1 - (0.5 * d) / THROW.reach), far: Math.max(0, Math.min(tx, ty) - d), spin: (f.charCodeAt(0) + r) % 2 ? 1 : -1, d });
    }
  // (Those on one line from him: the furthest out reaches the edge, each nearer one stops a little short of the one before.)
  for (const a of out) {
    const ahead = out.filter((b) => b !== a && b.d > a.d && a.ux * b.ux + a.uy * b.uy > 0.985).length;
    a.far = Math.max(a.knock, a.far - ahead * THROW.queue);
  }
  thrownMemo = { key, list: out.map(({ d: _d, ...n }) => n) };
  return thrownMemo.list;
}
const backOut = (u: number) => 1 + 2.2 * (clamp01(u) - 1) ** 3 + 1.2 * (clamp01(u) - 1) ** 2;
/**
 * Where a thrown piece is at `t` (the scene's clock): how far out along its line (% of the board), how high its hop lifts it, and its
 * turn (degrees). On its square until his landing; shoved as he lands; knocked back at the fire sword's slam; blasted to the edge at the
 * ice sword's; home again from his leap away (STORM_SCENE.healAt, healMs). Pure.
 */
export function thrownAt(n: Thrown, t: number): { out: number; up: number; turn: number; moving: boolean } {
  const S = STORM_SCENE;
  const T = THROW;
  const tilt = 14 * n.spin;
  const edgeTurn = n.spin * (360 * Math.floor(T.turns) + 22);
  if (t < S.nudgeAt) return { out: 0, up: 0, turn: 0, moving: false };
  if (t < S.fireAt) return { out: n.shove * ease((t - S.nudgeAt) / S.nudgeMs), up: 0, turn: 0, moving: false };
  if (t < S.iceAt) {
    const u = (t - S.fireAt) / T.knockMs;
    return { out: n.shove + n.knock * backOut(u), up: u < 1 ? Math.sin(Math.PI * clamp01(u)) * 2.5 : 0, turn: tilt * backOut(u), moving: u < 1 };
  }
  const start = n.shove + n.knock;
  if (t < S.healAt) {
    const u = clamp01((t - S.iceAt) / T.blastMs);
    // (Out fast, off the edge a little and back: a bounce.)
    const fly = 1 - (1 - Math.min(1, u / 0.72)) ** 2.4;
    const bounce = u > 0.72 ? Math.sin(((u - 0.72) / 0.28) * Math.PI) * 3 : 0;
    return { out: start + (n.far - start) * fly - bounce, up: Math.sin(Math.PI * Math.min(1, u / 0.72)) * T.hop * (u < 0.72 ? 1 : 0), turn: tilt + (edgeTurn - tilt) * (1 - (1 - u) ** 2), moving: u < 1 };
  }
  const u = clamp01((t - S.healAt) / S.healMs);
  const back = u * u * (3 - 2 * u);
  if (u >= 1) return { out: 0, up: 0, turn: 0, moving: false };
  return { out: n.far * (1 - back), up: Math.sin(Math.PI * u) * T.hop * 0.6, turn: n.spin * 22 * (1 - back), moving: true };
}
/** A thrown piece's style there: its square's place, moved out along its line and lifted, turned about its middle. */
const thrownStyle = (n: Thrown, o: Orientation, t: number) => {
  const c = centreOf(n.square, o);
  const at = thrownAt(n, t);
  return { left: `${r2(c.x - 6.25 + n.ux * at.out)}%`, top: `${r2(c.y - 6.25 + n.uy * at.out - at.up)}%`, ...(at.turn ? { rotate: `${r2(at.turn)}deg` } : {}) };
};

/**
 * The storm's opening scene (STORM_SCENE): his leap from his place to the board's middle, the pieces there nudged aside; his swords out,
 * the fire sword then the ice sword slammed in, the board torn open from each (the rift, drawn by the board layer under the pieces) and
 * rippling its color as the storm gathers round the board (the ring, the board layer's too); his grip on both hilts, his red and blue
 * aura, the charge building to the full swirl; then the swords pulled out, his leap back and the pieces sliding back to their squares.
 * The rift stays for the storm's turns.
 */
function stormMoment({ boss, moment, t, orientation }: MomentProps) {
  const S = STORM_SCENE;
  const computer = onComputer();
  const CORNER = homeOf(computer, moment.key);
  const flight = STRANGER_HOP.landAt - STRANGER_HOP.upAt;
  const rise = hopHeight(CORNER, STORM_STAND, computer);
  const flown = (from: number) => clamp01((t - from - STRANGER_HOP.upAt) / flight);
  const going = t >= S.leapAt;
  const feet = going ? fly(STORM_STAND, CORNER, rise, flown(S.leapAt)) : fly(CORNER, STORM_STAND, rise, flown(0));
  // (Through its banner, before its own clock: he stands in his place, breathing, never held in his hop's first frame.)
  const waiting = Date.now() < moment.at;
  const anim = waiting
    ? { anim: "idle", since: 0 }
    : going
      ? { anim: "hop", since: S.leapAt }
      : t < STRANGER_HOP.ms
        ? { anim: "hop", since: 0 }
        : t < S.gripAt
          ? { anim: "stormPlant", since: STRANGER_HOP.ms }
          : t < S.pullAt
            ? { anim: "stormCharge", since: S.gripAt }
            : { anim: "stormPull", since: S.pullAt };
  // (The page's shade is on from the first sword: his figure dims into it as he comes home, where his own stands under it.)
  const light = figLight(t >= S.fireAt, going ? 1 - flown(S.leapAt) : 1);
  const airborne = (t >= STRANGER_HOP.upAt && t < STRANGER_HOP.landAt) || (t >= S.leapAt + STRANGER_HOP.upAt && t < S.leapAt + STRANGER_HOP.landAt);
  const stage = t < S.landAt ? "leap" : t < S.fireAt ? "draw" : t < S.gripAt ? "swords" : t < S.pullAt ? "charge" : t < S.leapAt ? "pull" : t < S.homeAt ? "back" : "heal";
  return (
    <div class="power-moment pm-storm" data-stage={stage}>
      <div class="hb-pieces pg-layer" aria-hidden="true">
        <Ripples t={t} />
        {/* (The thrown pieces, off the board's own drawing until they're home: strangerBoard. Each one's trail while it flies: two
            fainter copies, where it was a moment ago.) */}
        {t >= S.nudgeAt &&
          t < S.healAt + S.healMs &&
          nudged(boss.board.fen, orientation).flatMap((n) => [
            ...(t >= S.fireAt && thrownAt(n, t).moving ? [2, 1].map((k) => <piece key={`${n.square}-trail${k}`} class={`pg-piece sg-nudge sg-trail ${n.code}`} style={{ ...thrownStyle(n, orientation, t - k * THROW.trailMs), opacity: String(0.14 * (3 - k)) }} />) : []),
            <piece key={n.square} class={`pg-piece sg-nudge ${n.code}`} data-square={n.square} style={thrownStyle(n, orientation, t)} />,
          ])}
        {airborne && !going && <span class="pg-shadow" style={{ left: `${r2(STORM_STAND.x)}%`, top: `${r2(STORM_STAND.y)}%`, width: "14%", height: "4%" }} />}
        <span class={`pg-pig sg-fig${t >= S.gripAt && t < S.pullAt ? " sg-charge" : ""}`} style={{ ...figBox(feet), ...light }} data-anim={anim.anim}>
          <BossMoment key={`${moment.key}:${anim.anim}:${anim.since}`} boss={boss.name} anim={anim.anim} since={waiting ? 0 : moment.at + anim.since} then={anim.anim === "stormCharge" || waiting ? undefined : "idle"} />
        </span>
      </div>
    </div>
  );
}

/** The storm's scene's banner and figure (its view) come with its moment; this is its whole view. */
function stormView(p: MomentProps) {
  return (
    <>
      {/* (Up through the moment's lead alone, its whole length: gone as his leap begins, never over his landing.) */}
      {p.banner("STORM OF TWO WORLDS!", "Three turns of ice and fire", "storm long", 1)}
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

/**
 * The storm's opening scene on this screen: `at`, its start (its own clock) while it plays, for the ring and the board (null: not
 * playing); `ahead`: it's still to come (its moment is this screen's, its banner not yet up). Nothing of the storm shows then: the
 * storm's turn has begun in the rules as his move shows, a moment before its scene (Eric, Nov 27: "it showed the tornado before he even
 * initiated anything ... for a split second around the board").
 */
export const sceneOf = (moments: readonly Pick<Moment, "kind" | "at" | "ms" | "lead">[], now: number): { at: number | null; ahead: boolean } => {
  const m = moments.find((x) => x.kind === "storm");
  if (!m) return { at: null, ahead: false };
  const from = m.at - (m.lead ?? 0);
  return { at: now >= from && now < m.at + m.ms ? m.at : null, ahead: now < from };
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
    // (The dock's words after his name, short enough to be whole on a 360 px phone: refused.ts STORM_SHORT; through your turn, STORM_LINES.)
    stormIce: { order: 2, appearAt: iceFrom, dock: (m) => (m.squares?.length ? STORM_SHORT.ice : "The storm swirls."), view: stormIceMoment },
    stormFire: { order: 2, appearAt: fireFrom, dock: (m) => (m.squares?.length ? STORM_SHORT.fire : "The storm swirls."), view: stormFireMoment },
    stormBurn: { order: 0, dock: (m) => (m.fizzled?.length ? "A piece was spared." : "The marks burnt."), view: stormBurnMoment },
  },
  // The frozen piece's ice (the characters' iceOverlay, as Ginger's freeze), and on the flee turn its tile ablaze, its countdown 1.
  board: ({ boss, p, board, orientation, now, appearAt, moments }) => {
    const crowd = (sq: string) => pieceAt(board, sq)?.color === boss.crowdSide;
    const iced = p.iced.filter(crowd);
    const fx = EFFECTS.iceOverlay;
    const st = p.stranger?.strike ?? null;
    const flee = st && p.turn > st.frozenUntil && p.turn <= st.burnAt ? st.square : null;
    // (His storm: its ring and its rift while its turns run (and through its opening scene), a soft dim round the board, and a fire
    // turn's marked squares ablaze.)
    const { at: scene, ahead } = sceneOf(moments, now);
    const storm = !ahead && !boss.result && (scene !== null || (!!p.stranger?.storm && stormOn(p.stranger, p.turn)));
    const pick = p.stranger?.pick;
    const lead = scene === null && pick?.turn === p.turn ? pick.kind : null;
    // (The rift heals a little each turn of the storm: whole on its first.)
    const stage = p.stranger?.storm ? Math.max(0, p.turn - p.stranger.storm.at) : 0;
    // (Burnt as your move landed: the marks go, and the burn's moment plays on their squares.)
    const burnt = p.stranger?.scorch?.at === pick?.turn;
    const marks = pick?.kind === "fire" && pick.turn === p.turn && !burnt ? pick.squares.filter((sq) => now >= appearAt(sq)) : [];
    return {
      under: storm ? <StormRift scene={scene} stage={stage} /> : undefined,
      over: (
        <>
          {storm && <StormRing scene={scene} lead={lead} />}
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
