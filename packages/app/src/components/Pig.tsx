import { DRAG, PULL, SHOWDOWN, pieceAt, withPiece, withoutPiece } from "@chessroyale/chess";
import type { LassoDrag, LongPull, ShowdownResult } from "@chessroyale/core";
import { CATCH_AT, HAUL_FISTS, PIG, PIG_LEAP } from "../characters/pig.ts";
import { bossKit } from "../characters/kits.ts";
import { cueAt } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { BossMoment, prewarmSprite } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { PIECE_WORD, SoundAt, hash, type BossUi, type KitMoment, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Wrangler on the board (his rules: packages/chess/src/bosses/pig.ts):
 * - **The long pull** (after his first move) and **the lasso drag**: he hops from his corner to beside the piece, throws
 *   his lasso so its loop (the art's CATCH point) drops over it, and on his `tug` hauls it one square (stepping with it,
 *   the rope taut), then hops back. The board shows the piece where it was until the tug, the moment draws it sliding,
 *   then the board has it on its new square.
 * - **SHOWDOWN!**: he drops into the middle of the board winding up both loops, leaps back to his corner, and his ropes
 *   yank the pairs into the line-up one at a time; "DRAW!" with a quick-draw sting. On the crowd's turn the three duels
 *   glow (a rope of light between each pair) as the only moves.
 * - **His meter full** (no moment of its own): "I've got you in my sights." and his ready loop (boss-beats.ts) until he
 *   fires.
 * All from the shared state (`powers.pull`, `drag`, `showdown`) and the moment's start, so everyone online sees the same
 * thing. Everything sits in eighths of the board's own size (`--board-size`).
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };

/** A square's middle, in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const arc = (a: Pt, b: Pt, h: number, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - h * 4 * u * (1 - u) });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** His box on the board (% of its width), at the scale the others are drawn on it (Sawyer's 34% for his 83 px frame). */
const PIG_W = 47;
/** % of the board per frame pixel. */
const PX = PIG_W / PIG.w;
/** His corner of the board (its top left), where he hops from and back to (his feet). */
const CORNER: Pt = { x: 7, y: 3 };
/** Where his loop drops (CATCH) from his feet, in % of the board, facing right. */
const CATCH_OFF: Pt = { x: (CATCH_AT[0] - PIG.foot[0]) * PX, y: (CATCH_AT[1] - PIG.foot[1]) * PX };
const FLIGHT = PIG_LEAP.landAt - PIG_LEAP.upAt;
/** Where he lands in the middle for his showdown's wind-up (his feet). */
const MIDDLE: Pt = { x: 50, y: 64 };

/** The lasso's beats within its own animation: its catch, and its tug after it. */
const LASSO = (() => {
  const a = PIG.anims.lasso!;
  return { catch: cueAt(a, "catch") ?? 0, tug: cueAt(a, "tug") ?? 0 };
})();

/** One of his figures on the board: his frame placed by his feet, facing right (or left, `flip`), playing `anim` from `since`. */
function Figure({ boss, at, flip, anim, since, then, id }: { boss: BossView; at: Pt; flip: boolean; anim: string; since: number; then?: string; id: string }) {
  const h = (PIG_W * PIG.h) / PIG.w;
  return (
    <span
      key={id}
      class="pg-pig"
      style={{
        left: `${r2(at.x - PIG_W * (PIG.foot[0] / PIG.w))}%`,
        top: `${r2(at.y - h * (PIG.foot[1] / PIG.h))}%`,
        width: `${PIG_W}%`,
        aspectRatio: `${PIG.w} / ${PIG.h}`,
        transformOrigin: `${r2((100 * PIG.foot[0]) / PIG.w)}% ${r2((100 * PIG.foot[1]) / PIG.h)}%`,
        ...(flip ? { scale: "-1 1" } : {}),
      }}
      data-anim={anim}
    >
      <BossMoment key={`${id}:${anim}:${since}`} boss={boss.name} anim={anim} since={since} then={then} />
    </span>
  );
}

/** His shadow on the board where he's coming down (a dark ellipse, growing as he nears it). */
const Shadow = ({ at, size }: { at: Pt; size: number }) => (
  <span class="pg-shadow" style={{ left: `${r2(at.x)}%`, top: `${r2(at.y)}%`, width: `${r2(20 * size)}%`, height: `${r2(6 * size)}%`, opacity: String(r2(Math.min(0.55, 0.2 + 0.35 * size))) }} />
);

/** A hop from `a` to `b` taking off at `upAt` (ms into the moment): where he is, and his shadow below where he'll land. */
function hop(t: number, a: Pt, b: Pt, upAt: number): { at: Pt; shadow: { at: Pt; size: number } | null } {
  if (t < upAt) return { at: a, shadow: null };
  if (t < upAt + FLIGHT) {
    const u = (t - upAt) / FLIGHT;
    return { at: arc(a, b, 16, u), shadow: { at: b, size: 0.4 + 0.6 * u } };
  }
  return { at: b, shadow: null };
}

/** A piece the moment draws over the board (sliding, or yanked in), in % of the board: drawn as the board draws pieces. */
function AirPiece({ code, at, square }: { code: string; at: Pt; square: string }) {
  return <piece class={`pg-piece ${code}`} style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%` }} data-square={square} />;
}
const COLOUR = { w: "white", b: "black" } as const;
const pieceCode = (color: "w" | "b", type: string) => `${COLOUR[color]} ${PIECE_WORD[type] ?? "pawn"}`;


// ---------------- The long pull and the lasso drag ----------------

/** What a lasso moment drags: the piece (its color and kind), from and to (one square, or the pull's from its double step's square). */
interface Lasso {
  color: "w" | "b";
  type: string;
  from: string;
  to: string;
}

const lassoOf = (boss: BossView, m: Pick<Moment, "kind">): Lasso | null => {
  const p = boss.powers;
  if (m.kind === "pull" && p?.pull) return { color: boss.crowdSide === "w" ? "b" : "w", type: "p", from: p.pull.via, to: p.pull.to };
  if (m.kind === "drag" && p?.drag) return { color: boss.crowdSide, type: p.drag.piece, from: p.drag.from, to: p.drag.to };
  return null;
};

/** When the piece slides in a lasso moment (ms into it): at his tug, for slideMs. */
const slideAt = (): number => DRAG.catchAt + (LASSO.tug - LASSO.catch);

/**
 * Where he stands to rope a piece and which way he faces: his loop (CATCH) drops on the piece; he stands on the side it
 * comes toward (it's hauled to him), or the roomier side when it moves up or down the board, or the other side when
 * that would put him off the board.
 */
export function lassoStand(from: Pt, to: Pt): { feet: Pt; flip: boolean } {
  const dx = to.x - from.x;
  let flip = dx > 0.1 ? true : dx < -0.1 ? false : from.x < 50;
  const feetFor = (f: boolean): Pt => ({ x: from.x - (f ? -CATCH_OFF.x : CATCH_OFF.x), y: from.y - CATCH_OFF.y });
  if (feetFor(flip).x < 4 || feetFor(flip).x > 96) flip = !flip;
  return { feet: feetFor(flip), flip };
}

function lassoMoment({ boss, moment, now, t, orientation, banner }: MomentProps) {
  const l = lassoOf(boss, moment);
  const pull = moment.kind === "pull";
  const title = pull ? "LONG PULL!" : "LASSO!";
  const sub = pull ? "Three squares in one move" : moment.ult ? "No showdown this time: a tug instead" : l ? `Your ${PIECE_WORD[l.type] ?? "piece"}, dragged a square` : undefined;
  if (!l) return <div class={`power-moment pm-${moment.kind}`}>{banner(title, sub, "western", PULL.bannerMs)}</div>;
  const from = centreOf(l.from, orientation);
  const to = centreOf(l.to, orientation);
  const stand = lassoStand(from, to);
  const B = pull ? PULL : DRAG;
  const s0 = slideAt();
  const u = ease((t - s0) / B.slideMs);
  // He steps with the piece as he hauls it, so the rope stays taut and the loop on it.
  const spot = lerp(stand.feet, { x: stand.feet.x + to.x - from.x, y: stand.feet.y + to.y - from.y }, u);
  // (Each hop takes off at its beat, its crouch PIG_LEAP.upAt before: the leap's own landing matches the arc's.)
  const out = hop(t, CORNER, stand.feet, B.hopAt);
  const back = hop(t, spot, CORNER, B.backAt);
  const goingBack = t >= B.backAt - PIG_LEAP.upAt;
  const at = goingBack ? back : t < B.landAt ? out : { at: spot, shadow: null };
  const anim = t < B.landAt ? { anim: "leap", since: moment.at + B.hopAt - PIG_LEAP.upAt } : goingBack ? { anim: "leap", since: moment.at + B.backAt - PIG_LEAP.upAt } : { anim: "lasso", since: moment.at + B.catchAt - LASSO.catch };
  const sliding = t >= s0 && t < s0 + B.slideMs + SLIDE_OVERLAP;
  const shown = t >= B.hopAt - PIG_LEAP.upAt && t < B.backAt + FLIGHT + 120;
  return (
    <div class={`power-moment pm-${moment.kind}`}>
      {banner(title, sub, "western", PULL.bannerMs)}
      <div class="hb-pieces pg-layer" aria-hidden="true" data-lasso={`${l.from}${l.to}`} data-stage={t < s0 ? "rope" : sliding ? "tug" : "done"}>
        {at.shadow && <Shadow at={at.shadow.at} size={at.shadow.size} />}
        {sliding && <AirPiece code={pieceCode(l.color, l.type)} at={lerp(from, to, u)} square={u < 0.5 ? l.from : l.to} />}
        {/* (Hopping back, he faces his corner, to the left.) */}
        {shown && <Figure boss={boss} at={at.at} flip={goingBack ? true : stand.flip} anim={anim.anim} since={anim.since} id={`lasso-${moment.key}`} />}
      </div>
    </div>
  );
}
/** The moment draws the sliding piece a little past its landing (the board draws its new position as it comes: no blink). */
const SLIDE_OVERLAP = 60;

// ---------------- SHOWDOWN! ----------------

/** His fists' place on the board while he hauls from his corner (% of the board): the ropes run from them. */
const FISTS: Pt[] = HAUL_FISTS.map(([x, y]) => ({ x: CORNER.x + (x - PIG.foot[0]) * PX, y: CORNER.y + (y - PIG.foot[1]) * PX }));

/** Each pair's yank: when it starts and ends (ms into the moment). */
const yankOf = (k: number) => ({ t0: SHOWDOWN.pairs[k] ?? SHOWDOWN.pairs[SHOWDOWN.pairs.length - 1]! + (k - SHOWDOWN.pairs.length + 1) * 500, ms: SHOWDOWN.yankMs });
/** A rope shoots out this long before its pair is yanked, and pulls back this long after. */
const ROPE_OUT = 160;
const ROPE_BACK = 140;

function showdownMoment({ boss, moment, now, t, orientation, banner }: MomentProps) {
  const sd = boss.powers?.showdown;
  const pairs = sd && sd.turn === boss.powers?.turn ? sd.pairs : [];
  const crowd = boss.crowdSide;
  const his = crowd === "w" ? "b" : "w";
  // His path: the corner, a leap into the middle (the wind-up there), a leap back to the corner (the hauling).
  const toMiddle = hop(t, CORNER, MIDDLE, SHOWDOWN.dropAt);
  const toCorner = hop(t, MIDDLE, CORNER, SHOWDOWN.throwAt);
  const pos = t < SHOWDOWN.landAt ? toMiddle : toCorner;
  // (The wind-up from his landing, its whirl heard; he leaves before its throw, which the ropes take over.)
  const anim =
    t < SHOWDOWN.landAt
      ? { anim: "leap", since: moment.at + SHOWDOWN.dropAt - PIG_LEAP.upAt }
      : t < SHOWDOWN.throwAt - PIG_LEAP.upAt
        ? { anim: "windup", since: moment.at + SHOWDOWN.landAt }
        : t < SHOWDOWN.cornerAt + 200
          ? { anim: "leap", since: moment.at + SHOWDOWN.throwAt - PIG_LEAP.upAt }
          : { anim: "haul", since: moment.at + SHOWDOWN.cornerAt + 200 };
  const ropes: { from: Pt; to: Pt; loop: boolean; key: string }[] = [];
  const air: { code: string; at: Pt; square: string }[] = [];
  pairs.forEach((p, k) => {
    const { t0, ms } = yankOf(k);
    const ends: [string, string, "w" | "b", Pt][] = [
      [p.crowdFrom, p.crowd, crowd, FISTS[0]!],
      [p.bossFrom, p.boss, his, FISTS[1]!],
    ];
    for (const [i, [fromSq, toSq, color, fist]] of ends.entries()) {
      const a = centreOf(fromSq, orientation);
      const b = centreOf(toSq, orientation);
      if (t >= t0 - ROPE_OUT && t < t0) ropes.push({ from: fist, to: lerp(fist, a, ease((t - (t0 - ROPE_OUT)) / ROPE_OUT)), loop: false, key: `${k}${i}` });
      else if (t >= t0 && t < t0 + ms + SLIDE_OVERLAP) {
        const at = lerp(a, b, ease((t - t0) / ms));
        ropes.push({ from: fist, to: at, loop: true, key: `${k}${i}` });
        air.push({ code: pieceCode(color, p.piece), at, square: t < t0 + ms / 2 ? fromSq : toSq });
      } else if (t >= t0 + ms + SLIDE_OVERLAP && t < t0 + ms + SLIDE_OVERLAP + ROPE_BACK) ropes.push({ from: fist, to: lerp(b, fist, ease((t - (t0 + ms + SLIDE_OVERLAP)) / ROPE_BACK)), loop: false, key: `${k}${i}` });
    }
  });
  return (
    <div class="power-moment pm-showdown">
      {banner("SHOWDOWN!", `${pairs.length === 2 ? "Two" : "Three"} duels: you must take one`, "western", SHOWDOWN.bannerMs)}
      {/* (Its name alone: what to do is the dock's on your move, and the God King says it his way as it comes.) */}
      {banner("DRAW!", undefined, "western draw", SHOWDOWN.total, SHOWDOWN.drawAt)}
      <SoundAt id={`${moment.key}:draw`} at={moment.at + SHOWDOWN.drawAt} now={now} sound="pigDraw" />
      {pairs.map((_, k) => (
        <SoundAt key={k} id={`${moment.key}:yank${k}`} at={moment.at + yankOf(k).t0} now={now} sound="pigYank" />
      ))}
      <div class="hb-pieces pg-layer" aria-hidden="true" data-showdown={t < SHOWDOWN.landAt ? "drop" : t < SHOWDOWN.throwAt ? "windup" : t < SHOWDOWN.drawAt ? "yank" : "draw"}>
        {pos.shadow && <Shadow at={pos.shadow.at} size={pos.shadow.size} />}
        {ropes.length > 0 && (
          <svg class="pg-ropes" viewBox="0 0 100 100" preserveAspectRatio="none">
            {ropes.map((r) => (
              <g key={r.key}>
                <line x1={r2(r.from.x)} y1={r2(r.from.y)} x2={r2(r.to.x)} y2={r2(r.to.y)} class="pg-rope" />
                {r.loop && <ellipse cx={r2(r.to.x)} cy={r2(r.to.y + 3.2)} rx={4.4} ry={1.5} class="pg-loop" />}
              </g>
            ))}
          </svg>
        )}
        {air.map((a) => (
          <AirPiece key={`${a.square}${a.code}`} code={a.code} at={a.at} square={a.square} />
        ))}
        <Figure boss={boss} at={pos.at} flip={false} anim={anim.anim} since={anim.since} then={anim.anim === "haul" ? undefined : "idle"} id={`showdown-${moment.key}`} />
      </div>
    </div>
  );
}

// ---------------- The board during his moments ----------------

/**
 * The board during his lasso moments and his showdown (`fen`: the position as it ends): the piece where it was until his
 * tug, then (the moment drawing it on its way) off the board until it lands; the line-up's pieces where they stood
 * until each pair is yanked in. Null: as it is. `still`: the board shouldn't animate its own changes meanwhile (the moment
 * draws the pieces moving). `evalFen`: what the eval bar shows (the position before, until it's all in). `lastMove`: the
 * last move to mark (his double step, until the pull's tug).
 */
export function pigBoard(boss: BossView, moments: readonly Moment[], now: number, fen: string): { fen: string; still: boolean; evalFen: string; lastMove?: string } | null {
  const p = boss.powers;
  if (!p || boss.id !== "pig") return null;
  const lasso = moments.find((m) => m.kind === "pull" || m.kind === "drag");
  if (lasso) {
    const l = lassoOf(boss, lasso);
    if (!l) return null;
    const t = now - lasso.at;
    const s0 = slideAt();
    const end = s0 + DRAG.slideMs + SLIDE_OVERLAP;
    const before = withPiece(withoutPiece(fen, l.to), l.from, { color: l.color, type: l.type });
    const pullFrom = lasso.kind === "pull" && p.pull ? p.pull.from : null;
    if (t >= end) return t < end + 300 ? { fen, still: true, evalFen: fen } : null;
    return {
      fen: t < s0 ? before : withoutPiece(fen, l.to),
      still: t >= s0 - 80,
      evalFen: before,
      ...(pullFrom ? { lastMove: `${pullFrom}${l.from}` } : {}),
    };
  }
  const m = moments.find((x) => x.kind === "showdown");
  const sd = p.showdown;
  if (!m || !sd || sd.turn !== p.turn) return null;
  const t = now - m.at;
  const last = yankOf(sd.pairs.length - 1);
  if (t >= last.t0 + last.ms + SLIDE_OVERLAP + 300) return null;
  return { fen: showdownFen(sd, t), still: t >= yankOf(0).t0 - 80, evalFen: sd.before };
}

/** The board at `t` ms into the showdown: the pairs yanked in so far on their squares, the pair on its way off the board. */
export function showdownFen(sd: Pick<ShowdownResult, "pairs" | "before">, t: number): string {
  let f = sd.before;
  sd.pairs.forEach((p, k) => {
    const { t0, ms } = yankOf(k);
    if (t < t0) return;
    const c = pieceAt(sd.before, p.crowdFrom);
    const b = pieceAt(sd.before, p.bossFrom);
    f = withoutPiece(withoutPiece(f, p.crowdFrom), p.bossFrom);
    if (t >= t0 + ms + SLIDE_OVERLAP && c && b) f = withPiece(withPiece(f, p.crowd, c), p.boss, b);
  });
  return f;
}

// ---------------- The duels, on the crowd's turn ----------------

/** The showdown whose duel the crowd must play this turn, if any. */
const duelNow = (p: NonNullable<BossView["powers"]>): ShowdownResult | null => (p.showdown && p.showdown.turn === p.turn ? p.showdown : null);
/** When the God King has his word in the showdown's moment (ms into it): as "DRAW!" comes. */
export const SHOWDOWN_KING_AT = SHOWDOWN.drawAt;

/** The crowd's move this turn must be one of Wrangler's duels (the dock says so for the whole turn). */
export const duelTurn = (boss: Pick<BossView, "id" | "powers"> | null | undefined): boolean => boss?.id === "pig" && !!boss.powers && !!duelNow(boss.powers) && !!boss.powers.allowed;

/** How many duels the crowd picks from this turn (3, or 2 on his last try; 0: not a duel turn). */
export const duelCount = (boss: Pick<BossView, "id" | "powers"> | null | undefined): number => (boss?.id === "pig" && boss.powers ? (duelNow(boss.powers)?.pairs.length ?? 0) : 0);

/** The three duels glowing as the only moves (a rope of light from each of the crowd's pieces to the one it must take). */
function Duels({ sd, orientation }: { sd: ShowdownResult; orientation: Orientation }) {
  return (
    <svg class="pg-duels" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-duels={sd.pairs.map((p) => p.crowd + p.boss).join(" ")}>
      {sd.pairs.map((p) => {
        const a = centreOf(p.crowd, orientation);
        const b = centreOf(p.boss, orientation);
        return (
          <g key={p.crowd + p.boss} class="pg-duel">
            <line x1={r2(a.x)} y1={r2(a.y)} x2={r2(b.x)} y2={r2(b.y)} class="pg-duel-line" />
            <circle cx={r2(a.x)} cy={r2(a.y)} r={5.6} class="pg-duel-ring" />
            <circle cx={r2(b.x)} cy={r2(b.y)} r={5.6} class="pg-duel-target" />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------- Drawn ahead ----------------

const warmed = new Set<string>();
/**
 * His moments' frames drawn ahead, a slice each animation frame (prewarm), from when his battle shows: the leap and the
 * lasso first (his long pull comes a move in), then the wind-up, the haul and the taunt, so none stalls a slow phone the
 * first time it shows (.claude/LESSONS.md: "A stall the first time an effect shows").
 */
export function prewarmPig(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed.has(name)) return;
  warmed.add(name);
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("leap"), ...frames("lasso"), ...frames("taunt"), ...frames("windup"), ...frames("haul")]);
}

// ---------------- His powers on screen ----------------

/** A line from his kit's lines for a beat of his own (pull, tug, power), picked by the moment: the same for everyone. */
const lineOf = (beat: "pull" | "tug" | "power") => (kit: ReturnType<typeof bossKit>, m: Pick<Moment, "key">): string | null => {
  const lines = kit?.lines[beat];
  return lines?.length ? lines[hash(m.key) % lines.length]! : null;
};

/** Wrangler's powers on screen. His rules: packages/chess/src/bosses/pig.ts. */
export const PIG_UI = {
  id: "pig",
  ultimate: { name: "SHOWDOWN!" },
  moments: {
    pull: { order: 0, kit: "power" as KitMoment, line: lineOf("pull"), view: lassoMoment },
    drag: { order: 0, kit: "power" as KitMoment, line: (kit, m) => (m.ult ? lineOf("tug") : lineOf("power"))(kit, m), view: lassoMoment },
    showdown: { order: 2, kit: "ultimate" as KitMoment, view: showdownMoment },
  },
  // Over the pieces, on the crowd's duel turn (and from "DRAW!" in the showdown's moment): the three duels glowing.
  board: ({ p, orientation, moments, now }) => {
    const sd = duelNow(p);
    const m = moments.find((x) => x.kind === "showdown");
    const show = !!sd && (!m || now >= m.at + SHOWDOWN.drawAt);
    return { over: show ? <Duels sd={sd!} orientation={orientation} /> : null };
  },
} satisfies BossUi;

export type { LassoDrag, LongPull };
