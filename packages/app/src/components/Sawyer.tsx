import { useLayoutEffect, useRef } from "preact/hooks";
import { BOARD_SAW, SAW_CUT, SPLIT, withoutPiece } from "@chessroyale/chess";
import { BOSS_POWERS, type SawCut, type SplitPawn } from "@chessroyale/core";
import { CUT, LEAP, SAWYER } from "../characters/sawyer.ts";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, animLength } from "../characters/power-art.ts";
import type { CutSide } from "../characters/effects.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossEffect, BossMoment, SpriteAnim, prewarm, prewarmSprite, type BoardItem } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { hash, stageSince, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Sawyer on the board: his split pawn after his first move (he leaps onto the pawn, saws it, it cracks, and its two
 * halves come apart onto their squares; the board then draws those two pawns as halves wherever they go), his saw cuts
 * (a groove along one edge of a square, sawn as his saw comes down at the board's corner, taped over turn by turn as it
 * heals) and his board saw (he leaps onto the board, revs, saws his way up between the d and e files, and the board
 * splits with a gap for its turns, then rejoins). All from the shared state (`powers.split`, `cut`, `boardSaw`) and
 * the moment's start, so everyone online sees the same thing. Everything sits in eighths of chessground's board.
 * His rules: packages/chess/src/bosses/sawyer.ts.
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };

const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};
/** A square's column and row on screen (0 at the top left). */
const onScreen = (square: string, o: Orientation) => {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { col: o === "white" ? f : 7 - f, row: o === "white" ? 7 - r : r };
};
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const arc = (a: Pt, b: Pt, h: number, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - h * 4 * u * (1 - u) });

/** His box on the board (% of its width), his feet on the point he's at. */
const SAWYER_W = 34;
/** His corner of the board (top left), where he leaps from and back to (his feet). */
const CORNER: Pt = { x: 6, y: 3 };
/** How far his saw's tip is from his feet when it bites (frame pixels: CUT is in his drawing space, 7 and 5 in). */
const TIP = { x: 7 + CUT[0] - SAWYER.foot[0], y: 5 + CUT[1] - SAWYER.foot[1] };
const FLIGHT = LEAP.landAt - LEAP.upAt;

/** Where his feet go for his saw's tip to bite at `tip` (% of the board); `flip`: he faces right (his tip to his right). */
const feetFor = (tip: Pt, flip: boolean): Pt => {
  const px = SAWYER_W / SAWYER.w;
  return { x: tip.x - (flip ? -TIP.x : TIP.x) * px, y: tip.y - TIP.y * px };
};

/** One of his figures on the board: his frame placed by his feet, facing left (or right), playing `anim` from `since`. */
function Figure({ boss, at, flip, anim, since, id }: { boss: BossView; at: Pt; flip: boolean; anim: string; since: number; id: string }) {
  const ch = SAWYER;
  const h = (SAWYER_W * ch.h) / ch.w;
  return (
    <span
      key={id}
      class="sw-boy"
      style={{
        left: `${at.x - (SAWYER_W * ch.foot[0]) / ch.w}%`,
        top: `${at.y - (h * ch.foot[1]) / ch.h}%`,
        width: `${SAWYER_W}%`,
        aspectRatio: `${ch.w} / ${ch.h}`,
        transformOrigin: `${(100 * ch.foot[0]) / ch.w}% ${(100 * ch.foot[1]) / ch.h}%`,
        ...(flip ? { scale: "-1 1" } : {}),
      }}
      data-anim={anim}
    >
      <BossMoment key={`${id}:${anim}:${since}`} boss={boss.name} anim={anim} since={since} />
    </span>
  );
}

/** His shadow on the board where he's coming down (a dark ellipse, growing as he nears it). */
const Shadow = ({ at, size }: { at: Pt; size: number }) => (
  <span class="sw-shadow" style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${18 * size}%`, height: `${6 * size}%`, opacity: String(Math.min(0.55, 0.2 + 0.35 * size)) }} />
);

/**
 * His trip onto the board and back for a moment: a leap from his corner at `upAt` to `spot` (landing `FLIGHT` later),
 * there until `backAt`, a leap back to the corner. Null: not on the board.
 */
function trip(t: number, spot: Pt, upAt: number, backAt: number): { at: Pt; shadow: { at: Pt; size: number } | null } | null {
  if (t < upAt - LEAP.upAt) return null;
  if (t < upAt) return { at: CORNER, shadow: null };
  if (t < upAt + FLIGHT) {
    const u = (t - upAt) / FLIGHT;
    return { at: arc(CORNER, spot, 16, u), shadow: { at: spot, size: 0.4 + 0.6 * u } };
  }
  if (t < backAt) return { at: spot, shadow: null };
  if (t < backAt + FLIGHT) {
    const u = (t - backAt) / FLIGHT;
    return { at: arc(spot, CORNER, 16, u), shadow: u < 0.5 ? { at: spot, size: 1 - u * 1.6 } : null };
  }
  return t < backAt + FLIGHT + 150 ? { at: CORNER, shadow: null } : null;
}

// ---------------- His half-pawns ----------------

/** Which half of a pawn a split half shows on screen: the side away from its partner (the a-file half shows its a-side). */
export const halfClass = (side: "a" | "h", o: Orientation): "saw-half-l" | "saw-half-r" => ((side === "a") === (o === "white") ? "saw-half-l" : "saw-half-r");

/**
 * The board draws his two split pawns as halves wherever they go: each of chessground's piece elements standing on a
 * half's square (one of his pawns) gets its half's class (clipped to that half, its cut face shaded: styles.css), kept
 * in step with every change chessground makes before the browser paints (a MutationObserver's callback runs first).
 */
function HalfPawns({ halves, color, orientation, on }: { halves: SplitPawn["halves"]; color: "w" | "b"; orientation: Orientation; on: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const want = useRef(new Map<string, string>());
  want.current = on ? new Map(halves.map((h) => [h.square, halfClass(h.side, orientation)])) : new Map();
  const apply = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    let stop = () => {};
    let tries = 0;
    let live = true;
    const pawn = `${color === "w" ? "white" : "black"} pawn`;
    const start = () => {
      if (!live) return;
      // (The board's own element: chessground draws a new cg-board inside it whenever it redraws everything, on a
      // resize too, so the board is looked up afresh each time.)
      const wrap = ref.current?.closest(".board-wrap")?.querySelector(".board");
      if (!wrap?.querySelector("cg-board")) {
        // (This layer's effects run before the board's own, which builds chessground: on a new screen it's there by
        // the end of this commit, before the paint; failing that, a frame later.)
        if (tries++ === 0) queueMicrotask(start);
        else if (tries < 30) requestAnimationFrame(start);
        return;
      }
      apply.current = () => {
        const board = wrap.querySelector("cg-board");
        if (!board) return;
        for (const el of Array.from(board.children)) {
          if (el.tagName !== "PIECE" || el.classList.contains("fading")) continue;
          const node = el as Element & { cgKey?: string; cgPiece?: string };
          const cls = node.cgPiece === pawn && node.cgKey ? want.current.get(node.cgKey) : undefined;
          for (const c of ["saw-half-l", "saw-half-r"]) if (el.classList.contains(c) !== (c === cls)) el.classList.toggle(c, c === cls);
        }
      };
      apply.current();
      const watch = new MutationObserver(() => apply.current());
      watch.observe(wrap, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
      stop = () => {
        watch.disconnect();
        for (const el of Array.from(wrap.querySelectorAll("piece.saw-half-l, piece.saw-half-r"))) el.classList.remove("saw-half-l", "saw-half-r");
      };
    };
    start();
    return () => {
      live = false;
      apply.current = () => {};
      stop();
    };
  }, [color]);
  useLayoutEffect(() => apply.current(), [on, orientation, halves.map((h) => h.square + h.side).join()]);
  return <span ref={ref} class="sw-halves" hidden data-halves={on ? halves.map((h) => `${h.square}:${h.side}`).join(" ") : ""} />;
}

// ---------------- The split ----------------

/**
 * The board during the split (its moment `m`, or the boss's move before it): the new half isn't there until the pawn
 * cracks, and from the crack until they've settled both are in the air (the moment draws them). Null: as it is.
 */
export function splitFen(split: SplitPawn | null | undefined, m: Pick<Moment, "kind" | "at"> | null, now: number, fen: string): string | null {
  if (!split?.square || !split.pawn || !m || m.kind !== "split") return null;
  const t = now - m.at;
  if (t >= SPLIT.settledAt) return null;
  const f = withoutPiece(fen, split.square);
  return t >= PAWN_UP ? withoutPiece(f, split.pawn) : f;
}
/** From his landing, the pawn he saws is drawn over him (the moment's), so the saw is seen going into it. */
const PAWN_UP = SPLIT.landAt - 100;

/** The board shouldn't animate its own changes while the moment draws the pawn and its halves. */
export const splitStill = (m: Pick<Moment, "kind" | "at"> | null, now: number): boolean => !!m && m.kind === "split" && now >= m.at + PAWN_UP - 80 && now < m.at + SPLIT.settledAt + 300;

const PIECE_COLOUR = { w: "white", b: "black" } as const;

function splitMoment({ boss, moment, now, t, orientation, banner }: MomentProps) {
  const split = boss.powers?.split;
  if (!split?.pawn || !split.square) return <div class="power-moment pm-split">{t < 1300 && banner("SPLIT PAWN!", "Two for one", "saw")}</div>;
  const mine = boss.crowdSide === "w" ? "b" : "w";
  const pawn = centreOf(split.pawn, orientation);
  const half = centreOf(split.square, orientation);
  // His saw's tip bites the pawn a little below its middle; near the board's right edge he faces right, from its left.
  const flip = pawn.x > 70;
  const spot = feetFor({ x: pawn.x, y: pawn.y + 2.5 }, flip);
  const at = trip(t, spot, SPLIT.hopAt, SPLIT.backAt);
  const anim = t < SPLIT.sawAt ? { anim: "leap", since: moment.at + SPLIT.hopAt - LEAP.upAt } : t < SPLIT.backAt - LEAP.upAt ? { anim: "sawDown", since: moment.at + SPLIT.sawAt } : { anim: "leap", since: moment.at + SPLIT.backAt - LEAP.upAt };
  const [sq0, sq1] = [split.pawn, split.square];
  const sideOf = (sq: string): "a" | "h" => split.halves.find((h) => h.square === sq)?.side ?? ((sq === sq1) === sq1 < sq0 ? "a" : "h");
  const apart = clamp01((t - SPLIT.crackAt) / (SPLIT.settledAt - SPLIT.crackAt));
  // The pawn over him as he saws it (shaking as the blade bites), then its two halves in the air, from the crack until
  // they've settled: one stays (a little hop apart), the other slides over.
  const shake = t >= SPLIT.cutAt && t < SPLIT.crackAt ? (Math.floor(t / 60) % 2 ? 0.5 : -0.5) : 0;
  const whole = t >= PAWN_UP && t < SPLIT.crackAt ? [{ sq: split.pawn, at: { x: pawn.x + shake, y: pawn.y }, rot: 0, cls: "" }] : [];
  const halves =
    t >= SPLIT.crackAt && t < SPLIT.settledAt
      ? [
          { sq: split.pawn, at: { x: pawn.x + (pawn.x - half.x) * 0.06 * Math.sin(Math.PI * apart), y: pawn.y - 4 * Math.sin(Math.PI * apart) }, rot: (half.x > pawn.x ? -8 : 8) * Math.sin(Math.PI * apart), cls: halfClass(sideOf(split.pawn), orientation) },
          { sq: split.square, at: { x: pawn.x + (half.x - pawn.x) * ease(apart), y: pawn.y - 7 * Math.sin(Math.PI * apart) }, rot: (half.x > pawn.x ? 12 : -12) * Math.sin(Math.PI * apart), cls: halfClass(sideOf(split.square), orientation) },
        ]
      : whole;
  const crackAt = moment.at + SPLIT.crackAt;
  const crackMs = animLength(EFFECTS.sawCrack.ch.anims.crack!);
  return (
    <div class="power-moment pm-split">
      {t < 1300 && banner("SPLIT PAWN!", "Two for one", "saw")}
      <div class="cg-wrap sw-layer" aria-hidden="true" data-split={t < SPLIT.crackAt ? "saw" : t < SPLIT.settledAt ? "apart" : "settled"}>
        {at?.shadow && <Shadow at={at.shadow.at} size={at.shadow.size} />}
        {halves.map((h) => (
          <piece
            key={`half-${h.sq}`}
            class={`sw-half ${PIECE_COLOUR[mine]} pawn ${h.cls}`}
            style={{ left: `${h.at.x - 6.25}%`, top: `${h.at.y - 6.25}%`, rotate: `${Math.round(h.rot)}deg` }}
            data-square={h.sq}
          />
        ))}
        {now >= crackAt && now < crackAt + crackMs && (
          <span class="sw-crack" style={{ left: `${pawn.x - 6.25}%`, top: `${pawn.y - 6.25}%` }}>
            <BossEffect name="sawCrack" since={crackAt} id={`crack-${moment.key}`} />
          </span>
        )}
        {at && <Figure boss={boss} at={at.at} flip={flip && t < SPLIT.backAt} anim={anim.anim} since={anim.since} id="split" />}
      </div>
    </div>
  );
}

// ---------------- The saw cut ----------------

/** Which side of each of its two squares a cut's edge is on, on screen (a's, then b's). */
export function cutSides(cut: Pick<SawCut, "a" | "b">, o: Orientation): [CutSide, CutSide] {
  const A = onScreen(cut.a, o);
  const B = onScreen(cut.b, o);
  if (A.row === B.row) return A.col < B.col ? ["E", "W"] : ["W", "E"];
  return A.row < B.row ? ["S", "N"] : ["N", "S"];
}

const TAPE_MS = Math.max(...(["tape1N", "tape2N"] as const).map((a) => animLength(EFFECTS.sawCut.ch.anims[a]!)));
const HEAL_MS = animLength(EFFECTS.sawCut.ch.anims.healN!);
/** The last cut each battle showed (so one that has just gone heals away), and when this device saw it go. */
const cutLast = new Map<string, SawCut>();
const cutGone = new Map<string, number>();

/**
 * The saw cut on the board: its half on each of its two squares, sawn open as his saw comes down (its moment), the raw
 * groove its first turn, taped (two strips) its second, more tape and closing its third, healing away as it goes.
 */
export function cutItems(boss: BossView, orientation: Orientation, now: number, appearAt: (square: string) => number): BoardItem[] {
  const p = boss.powers;
  if (!p || p.passive !== "cuts") return [];
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const cut = p.cut ?? null;
  const out: BoardItem[] = [];
  const both = (c: SawCut, item: (side: CutSide) => Omit<BoardItem, "square" | "name">) => {
    const [sa, sb] = cutSides(c, orientation);
    out.push({ square: c.a, name: "sawCut", ...item(sa) }, { square: c.b, name: "sawCut", ...item(sb), quiet: true });
  };
  if (cut) {
    cutLast.set(key, cut);
    const since = appearAt(cut.a);
    if (since && now < since) return [];
    const stage = Math.max(0, Math.min(2, p.turn - cut.at));
    if (stage === 0) both(cut, (S) => (since ? { anim: `open${S}`, then: `raw${S}`, since } : { anim: `raw${S}`, since: 0 }));
    else {
      const from = stageSince(`${key}:${cut.a}${cut.b}:${cut.at}:${stage}`, now);
      both(cut, (S) => (now < from + TAPE_MS ? { anim: `tape${stage}${S}`, then: `taped${stage}${S}`, since: from } : { anim: `taped${stage}${S}`, since: 0 }));
    }
  } else {
    const last = cutLast.get(key);
    if (last && last.until < p.turn) {
      const tag = `${key}:${last.a}${last.b}:${last.until}`;
      let at = cutGone.get(tag);
      if (at === undefined) {
        cutGone.set(tag, (at = now));
        if (cutGone.size > 50) cutGone.delete(cutGone.keys().next().value!);
      }
      if (now < at + HEAL_MS) both(last, (S) => ({ anim: `heal${S}`, since: at! }));
    }
  }
  return out;
}

function cutMoment({ moment, t, banner, cast }: MomentProps) {
  const [a, b] = moment.squares ?? [];
  return (
    <div class="power-moment pm-cut">
      {t < 1500 && banner("SAW CUT!", a && b ? `No crossing ${a}–${b}` : undefined, "saw")}
      {cast("cut", SAW_CUT.cutAt)}
    </div>
  );
}

// ---------------- The board saw ----------------

/** The last board saw each battle showed (so one that has just ended closes up), and when this device saw it end. */
const gapLast = new Map<string, { at: number; until: number }>();
const gapGone = new Map<string, number>();
const CLOSE_MS = animLength(EFFECTS.boardGap.ch.anims.close!);

/** The gap down the middle now: its animation and since when (sawn open in its moment; there; closing as it ends); null: none. */
export function gapState(boss: BossView, moments: readonly Moment[], now: number): { anim: string; then?: string; since: number } | null {
  const p = boss.powers;
  if (!p || p.ultimate !== "boardsaw") return null;
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const saw = p.boardSaw ?? null;
  if (saw) {
    gapLast.set(key, saw);
    const m = moments.find((x) => x.kind === "boardsaw");
    if (m) {
      if (now < m.at + BOARD_SAW.runAt) return null;
      if (now < m.at + BOARD_SAW.splitAt) return { anim: "run", since: m.at + BOARD_SAW.runAt };
      return { anim: "part", then: "gap", since: m.at + BOARD_SAW.splitAt };
    }
    return { anim: "gap", since: 0 };
  }
  const last = gapLast.get(key);
  if (last && last.until < p.turn) {
    const tag = `${key}:${last.at}`;
    let at = gapGone.get(tag);
    if (at === undefined) {
      gapGone.set(tag, (at = now));
      if (gapGone.size > 50) gapGone.delete(gapGone.keys().next().value!);
    }
    if (now < at + CLOSE_MS) return { anim: "close", since: at };
  }
  return null;
}

/** The board jolts as it splits in two. */
export function boardSawJolt(m: Pick<Moment, "kind" | "at"> | null, now: number): "crash" | null {
  if (!m || m.kind !== "boardsaw") return null;
  const t = now - m.at;
  return t >= BOARD_SAW.splitAt && t < BOARD_SAW.splitAt + BOARD_SAW.jolt ? "crash" : null;
}

function boardSawMoment({ boss, moment, t, banner }: MomentProps) {
  // His saw's tip on the line between the d and e files (the board's middle, whichever way up), from the bottom edge to
  // the top as he saws.
  const bottom = feetFor({ x: 50, y: 99 }, false);
  const run = clamp01((t - BOARD_SAW.runAt) / BOARD_SAW.runMs);
  const tipY = 99 - 98 * run;
  const spot = t < BOARD_SAW.runAt ? bottom : feetFor({ x: 50, y: tipY }, false);
  const at = trip(t, t < BOARD_SAW.offAt ? spot : feetFor({ x: 50, y: 1 }, false), BOARD_SAW.jumpAt, BOARD_SAW.offAt);
  const anim =
    t < BOARD_SAW.revAt
      ? { anim: "leap", since: moment.at + BOARD_SAW.jumpAt - LEAP.upAt }
      : t < BOARD_SAW.runAt
        ? { anim: "rev", since: moment.at + BOARD_SAW.revAt }
        : t < BOARD_SAW.offAt - LEAP.upAt
          ? { anim: "boardSaw", since: moment.at + BOARD_SAW.runAt }
          : { anim: "leap", since: moment.at + BOARD_SAW.offAt - LEAP.upAt };
  return (
    <div class="power-moment pm-boardsaw">
      {t < 1500 && banner("BOARD SAW!", `No crossing the middle for ${BOSS_POWERS.boardSawTurns} turns`, "saw")}
      <div class="cg-wrap sw-layer" aria-hidden="true" data-boardsaw={t < BOARD_SAW.runAt ? "rev" : t < BOARD_SAW.splitAt ? "run" : "split"}>
        {at?.shadow && <Shadow at={at.shadow.at} size={at.shadow.size} />}
        {at && <Figure boss={boss} at={at.at} flip={false} anim={anim.anim} since={anim.since} id="boardsaw" />}
      </div>
    </div>
  );
}

// ---------------- Drawn ahead ----------------

const warmed = new Set<string>();
/**
 * His powers' frames drawn ahead, a slice each animation frame (prewarm), from when his battle shows: the leap and the
 * saw for the split (after his first move), the cut's grooves and tape, then the board saw and its gap, so none of
 * them stalls a slow phone the first time it shows (.claude/LESSONS.md: "A stall the first time an effect shows").
 */
export function prewarmSawyer(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed.has(name)) return;
  warmed.add(name);
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("leap"), ...frames("sawDown"), ...frames("rev"), ...frames("boardSaw")]);
  const fx = (n: keyof typeof EFFECTS) => Object.entries(EFFECTS[n].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const));
  prewarm("sawCrack", fx("sawCrack"));
  prewarm("sawCut", fx("sawCut"));
  prewarm("boardGap", fx("boardGap"));
}

// ---------------- His powers on screen ----------------

/** The split's line (his kit's `split` lines, picked by the moment: the same for everyone). */
const splitLine = (kit: ReturnType<typeof bossKit>, m: Pick<Moment, "key">): string | null => {
  const lines = kit?.lines.split;
  return lines?.length ? lines[hash(m.key) % lines.length]! : null;
};

/** Sawyer's powers on screen. His rules: packages/chess/src/bosses/sawyer.ts. */
export const SAWYER_UI = {
  id: "sawyer",
  ultimate: { name: "the board saw" },
  moments: {
    split: { order: 0, kit: "power", dock: "Split pawn!", line: splitLine, view: splitMoment },
    cut: { order: 0, kit: "power", dock: "Saw cut!", appearAt: (m, square) => (m.squares?.includes(square) ? m.at + SAW_CUT.cutAt : undefined), view: cutMoment },
    boardsaw: { order: 2, kit: "ultimate", dock: "Board saw!", view: boardSawMoment },
  },
  // Under the pieces: the cut's groove and tape, the gap down the middle. Over them: his split pawns drawn as halves
  // (once they've landed), and markers for tests and readers.
  board: ({ boss, p, orientation, now, appearAt, moments }) => {
    const cuts = cutItems(boss, orientation, now, appearAt);
    const gap = gapState(boss, moments, now);
    const splitting = moments.find((m) => m.kind === "split");
    const halvesOn = !splitting || now >= splitting.at + SPLIT.settledAt;
    const mine = boss.crowdSide === "w" ? "b" : "w";
    return {
      under: (
        <>
          {cuts.length > 0 && <BoardEffects items={cuts} orientation={orientation} class="sw-cut-board" />}
          {gap && (
            <span class="sw-gap" data-state={gap.anim}>
              <SpriteAnim ch={EFFECTS.boardGap.ch} anim={gap.anim} then={gap.then} since={gap.since} sounds={EFFECTS.boardGap.sounds} id="gap" />
            </span>
          )}
        </>
      ),
      over: (
        <>
          {p.cut && <span class="sw-cut" data-cut={`${p.cut.a}-${p.cut.b}`} data-stage={Math.max(0, Math.min(2, p.turn - p.cut.at))} />}
          {(p.split?.halves.length ?? 0) > 0 && <HalfPawns halves={p.split!.halves} color={mine} orientation={orientation} on={halvesOn} />}
        </>
      ),
    };
  },
} satisfies BossUi;
