import { STRANGER_FX, finisherLeadMs, finisherOf, pieceAt, withoutPiece, type Finisher } from "@chessroyale/chess";
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
 * one of four finishers on it (the flame strike, the ice and its shatter, the clean cut, the frostfire), the piece gone, his hop back;
 * then his move, his piece sliding onto the empty square (strangerTurnMoments, strangerBoard).
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
      <FireBurn burnt={burnt} since={moment.at} now={now} orientation={orientation} />
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
const arc = (a: Pt, b: Pt, h: number, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - h * 4 * u * (1 - u) });

/** His box on the board (% of its width): 128 frame px, his body about 2.4 squares tall. */
const FIG_W = 38;
const PX = FIG_W / STRANGER.w;
/**
 * His corner of the board, where he hops from and back to (his feet), his box inside the board's left edge: on a phone its top left (his
 * place in the bar above it), on a computer its bottom left (his place beside it; the board's top is near the window's there).
 */
const cornerOf = (computer: boolean): Pt => ({ x: FIG_W / 2 + 1, y: computer ? 97 : 6 });
/**
 * His drawing's reach above his feet (sprite px, his crown and aura), so his head never rises more than `headRoom` % above the board: a
 * little on a phone (the bar is above it), none on a computer.
 */
const UP = 110;

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
  const hop = (a: Pt, b: Pt, from: number): Pt => (t < from + STRANGER_HOP.upAt ? a : arc(a, b, 14, clamp01((t - from - STRANGER_HOP.upAt) / flight)));
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
 * this turn's, from when this device first saw it (after his block, where a piece of his was just lost); his move shows after it (the
 * server holds it, solo waits).
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
      // (After his block, where a piece of his was just lost: it plays where he stands first, his move held as long: finisherLeadMs.)
      return { kind: "finisher", key, at: at + finisherLeadMs(boss.board, boss.crowdSide), ms: STRANGER_FX.finisher, square: e.square!, ...(e.shape ? { shape: e.shape } : {}), ...(e.pick !== undefined ? { pick: e.pick } : {}) } satisfies Moment;
    });
}

/**
 * The board while his finisher plays: your piece gone from its `goneAt` (its board art took it) until his move shows, his piece then
 * sliding onto the empty square; the board doesn't animate the piece going (`still`). Null: no finisher now.
 */
export function strangerBoard(boss: Pick<BossView, "id">, moments: readonly Moment[], now: number, fen: string): { fen: string; still: boolean } | null {
  if (boss.id !== "stranger") return null;
  const m = moments.find((x) => x.kind === "finisher");
  if (!m?.square) return null;
  const gone = now >= m.at + finishTimeline(finisherOf(m.pick)).goneAt;
  return { fen: gone && pieceAt(fen, m.square) ? withoutPiece(fen, m.square) : fen, still: true };
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
