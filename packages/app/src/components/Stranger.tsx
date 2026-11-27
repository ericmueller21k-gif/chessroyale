import { STRANGER_FX, applyMove, finisherOf, pieceAt, type Finisher } from "@chessroyale/chess";
import { EFFECTS, animLength, cueAt } from "../characters/power-art.ts";
import { STRANGER, STRANGER_HOP } from "../characters/stranger.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossMoment, SpriteAnim, prewarm, type BoardItem } from "./BossEffect.tsx";
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
export function strangerBoard(boss: Pick<BossView, "id">, moments: readonly Moment[], now: number, fen: string): { fen: string; still: boolean; lastMove?: string } | null {
  if (boss.id !== "stranger") return null;
  const m = moments.find((x) => x.kind === "finisher");
  if (!m?.square) return null;
  if (now < m.at + finishTimeline(finisherOf(m.pick)).goneAt) return { fen, still: true };
  const after = m.move ? played(fen, m.move) : null;
  return after ? { fen: after, still: false, lastMove: m.move } : { fen, still: true };
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

export const STRANGER_UI = {
  id: "stranger",
  // (A placeholder until Eric's ultimate lands: the hook never fires, so its warning never shows.)
  ultimate: { name: "his ultimate" },
  moments: {
    frostfire: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: strikeMoment },
    frostfireBurn: { order: 0, kit: "power", dock: (m) => (m.fizzled?.length ? "The fire spared the piece there." : m.shape ? "The square burnt." : "The square burnt empty."), view: burnMoment },
    // (His finisher, while he still thinks: strangerTurnMoments. No banner: his move is an ordinary capture.)
    finisher: { order: 2, dock: (m) => `Your ${PIECE_WORD[m.shape ?? "n"] ?? "piece"} falls.`, view: finisherMoment },
  },
  // The frozen piece's ice (the characters' iceOverlay, as Ginger's freeze), and on the flee turn its tile ablaze, its countdown 1.
  board: ({ boss, p, board, orientation, now, appearAt }) => {
    const crowd = (sq: string) => pieceAt(board, sq)?.color === boss.crowdSide;
    const iced = p.iced.filter(crowd);
    const fx = EFFECTS.iceOverlay;
    const st = p.stranger?.strike ?? null;
    const flee = st && p.turn > st.frozenUntil && p.turn <= st.burnAt ? st.square : null;
    return {
      over: (
        <>
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
