import { STORM_SCENE, STRANGER_FX, applyMove, finisherOf, pieceAt, stormOn, type Finisher } from "@chessroyale/chess";
import { useLayoutEffect, useRef } from "preact/hooks";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import { STRANGER, STRANGER_HOP } from "../characters/stranger.ts";
import riftUrl from "../characters/stranger-rift.webp?url";
import stormUrl from "../characters/stranger-storm.webp?url";
import type { BossView } from "../game.ts";
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
 * opacity over what it overlaps, `dim` the soft dim round the board (both in the CSS, here for the record).
 */
export const STORM_ART = { px: 250, cell: 170, frames: 36, cols: 6, fps: 12, margin: 0.12, see: 0.88, dim: 0.22 } as const;
/**
 * The rift's sheet (`stranger-rift.webp`, `cols` frames a row of `px` x `px`): each heal stage's loop (`loop` frames at `loopFps`), then
 * the opening's frames (`openA` from the fire sword's slam, `openB` from the ice sword's, at `openFps`), ending on stage 1.
 */
export const RIFT_ART = { px: 202, cols: 8, stages: 3, loop: 4, loopFps: 6, openA: 9, openB: 10, openFps: 12 } as const;

/** A sheet, fetched and decoded ahead as his battle shows (prewarmStranger): `src` once it can be drawn. */
type Sheet = { src: CanvasImageSource | null };
const sheets: { storm?: Sheet; rift?: Sheet } = {};
function sheetOf(which: "storm" | "rift"): Sheet {
  const had = sheets[which];
  if (had) return had;
  const sheet: Sheet = { src: null };
  sheets[which] = sheet;
  if (typeof Image === "undefined") return sheet;
  const img = new Image();
  const ready = () => {
    sheet.src = img;
    // (Kept decoded, so no frame's draw waits on a decode.)
    if (typeof createImageBitmap === "function") createImageBitmap(img).then((b) => (sheet.src = b), () => undefined);
  };
  img.onload = ready;
  img.src = which === "storm" ? stormUrl : riftUrl;
  return sheet;
}

/**
 * How strong the storm is at `now`: `fire` and `ice`, each element's strength (0 none, 1 whole); `chaos`, the charge's wild layer. During
 * its opening scene (`scene`: the moment's start, its own clock) the fire rises from the fire sword's slam and the ice from the ice
 * sword's, both whole by his grip; the charge builds to the full swirl and eases back as he leaves; through its turns, steady.
 */
export function stormLevel(scene: number | null, now: number): { fire: number; ice: number; chaos: number } {
  if (scene === null) return { fire: 1, ice: 1, chaos: 0 };
  const t = now - scene;
  const S = STORM_SCENE;
  const rise = (from: number) => (t < from ? 0 : lerp(0.25, 1, (t - from) / (S.gripAt - S.iceAt)));
  const chaos = t < S.gripAt ? 0 : t < S.fullAt ? ease((t - S.gripAt) / (S.fullAt - S.gripAt)) : t < S.pullAt ? 1 : 1 - ease((t - S.pullAt) / (S.leapAt - S.pullAt));
  return { fire: rise(S.fireAt), ice: rise(S.iceAt), chaos };
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
  const own = (el: "fire" | "ice") => (lead === null ? 0.9 : lead === el ? 1 : 0.8) * level[el];
  const twice = (el: "fire" | "ice") => Math.max(lead === el ? 0.6 : 0, 0.6 * level.chaos) * level[el];
  cell(A.frames, true, level.ice * (lead === "fire" ? 0.75 : 1));
  for (const el of lead === "fire" ? (["ice", "fire"] as const) : (["fire", "ice"] as const)) {
    cell(far, el === "ice", twice(el));
    cell(f, el === "ice", own(el));
  }
  g.globalAlpha = 1;
}

/** What the storm's canvases last drew (the tests' read: the ring's frame, the rift's sheet frame; -1 nothing yet). */
const drawn = { ring: -1, rift: -1 };
if (typeof window !== "undefined") (window as unknown as { __stormArt?: typeof drawn }).__stormArt = drawn;

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
    const sheet = sheetOf("storm");
    const draw = () => {
      if (!sheet.src) return;
      const now = Date.now();
      const level = stormLevel(at.current.scene, now);
      paintRing(g, sheet.src, now, level, at.current.lead);
      drawn.ring = level.fire > 0 ? ringFrame(now, level.chaos) : -1;
    };
    draw();
    const stop = onEachFrame(draw);
    return () => {
      stop();
      drawn.ring = -1;
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
    const sheet = sheetOf("rift");
    let shown = -2;
    const draw = () => {
      if (!sheet.src) return;
      const f = riftFrame(at.current.scene, at.current.stage, Date.now());
      if (f === shown) return;
      shown = f;
      drawn.rift = f;
      g.clearRect(0, 0, R.px, R.px);
      if (f >= 0) g.drawImage(sheet.src, (f % R.cols) * R.px, Math.floor(f / R.cols) * R.px, R.px, R.px, 0, 0, R.px, R.px);
    };
    draw();
    const stop = onEachFrame(draw);
    return () => {
      stop();
      drawn.rift = -1;
    };
  }, []);
  return <canvas ref={cv} class="sg-rift" width={RIFT_ART.px} height={RIFT_ART.px} aria-hidden="true" data-stage={stage} />;
}

/** Where he stands for the storm's scene (% of the board): his feet a little below its middle, his head on it. */
const STORM_STAND: Pt = { x: 50, y: 56 };
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
  return (
    <svg class="sg-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
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
 * the fire sword then the ice sword slammed in, the board torn open from each (the rift, drawn by the board layer under the pieces) and
 * rippling its color as the storm gathers round the board (the ring, the board layer's too); his grip on both hilts, his red and blue
 * aura, the charge building to the full swirl; then the swords pulled out, his leap back and the pieces sliding back to their squares.
 * The rift stays for the storm's turns.
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
        <Ripples t={t} />
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
    const scene = sceneOf(moments, now);
    const storm = scene !== null || (!!p.stranger?.storm && stormOn(p.stranger, p.turn));
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
          {storm && (scene === null || now >= scene + STORM_SCENE.fireAt) && <span class="sg-dim" />}
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
