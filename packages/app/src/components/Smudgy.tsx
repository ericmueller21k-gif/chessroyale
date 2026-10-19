import { POWER_FX, SMUDGY_BEATS, pieceAt, withPiece } from "@chessroyale/chess";
import { bossKit } from "../characters/kits.ts";
import { EFFECTS, type SquareItem } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { seenFen } from "../camo.ts";
import { BoardEffects, BossEffect, prewarm, prewarmSprite } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { SoundAt, hash, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";

/**
 * Smudgy's powers on screen (his rules: packages/chess/src/bosses/smudgy.ts; the beats: SMUDGY_BEATS, timed by his
 * animations' cues; docs/decisions/2026-10-19-smudgy-wired.md), all from the shared state and each moment's start, so
 * everyone online sees the same thing:
 * - **Camouflage** (as your turn begins after his second forced move): "CAMOUFLAGE!", then he flings his brush and a blob
 *   of paint flies to his pawns; a splash lands on every square with one of his pawns (so nobody sees which swapped), the
 *   rook swaps with a pawn under it, the paint holds a beat and fades off the board as you'll see it from now on (his rook
 *   drawn as a pawn: camo.ts). Before the paint the board shows his rook where he lifted it.
 * - **The reveal** (his hidden rook strikes, gives check or leaves you no move you could see; as your turn begins): it
 *   moves as a pawn to your eye until his tail snaps open and the paint drips off its square, and it shows as a rook.
 * - **The rook taken** (your move took it, while he thinks): a drip on its square, "That was his rook!", his line.
 * - **Repaint** (his whole turn, as your turn begins): "REPAINT!", then two strokes of his brush: a cream one on his pawn's
 *   square (it's yours now) and a charcoal one on your piece's (it's his now); each piece changes color under its stroke.
 * What the board shows is `smudgyFen`; the rest draws over it.
 */

type Orientation = "white" | "black";
type Pt = { x: number; y: number };
const B = SMUDGY_BEATS;
const other = (side: "w" | "b") => (side === "w" ? "b" : "w");
const r2 = (v: number) => Math.round(v * 100) / 100;
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const find = (moments: readonly Moment[], kind: Moment["kind"]) => moments.find((m) => m.kind === kind) ?? null;

/** A square's middle in % of the board. */
const centreOf = (square: string, o: Orientation): Pt => {
  const { x, y } = squareXY(square, o);
  return { x: x / 8, y: y / 8 };
};

/** The dock's line on the turn he spent repainting (his whole turn: no move to show). */
export const REPAINT_LINE = "Smudgy spent his turn repainting.";
/** The dock's lines for the reveal and for the rook taken. */
export const UNMASK_LINE = "His pawn was a rook!";
export const TAKEN_LINE = "That was his rook!";

/**
 * Where his casting figure stands (the board's top-left corner, in % of the board: CSS .pm-by-smudgy) and where the blob
 * of paint leaves his brush at the `splash` cue (frame pixels 8, 20 of his 94 x 84 frame, measured on that frame's specks).
 */
export const SMUDGY_CASTER = { left: -5, top: -14, width: 28 } as const;
const BRUSH: Pt = { x: SMUDGY_CASTER.left + (SMUDGY_CASTER.width * 8) / 94, y: SMUDGY_CASTER.top + (SMUDGY_CASTER.width * 20) / 94 };

/** The squares holding a side's pawns in a position, in file order. */
export function pawnSquares(fen: string, side: "w" | "b"): string[] {
  const out: string[] = [];
  fen.split(" ")[0]!.split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (c >= "1" && c <= "8") f += Number(c);
      else {
        if (c.toLowerCase() === "p" && (c === c.toUpperCase()) === (side === "w")) out.push(`${"abcdefgh"[f]}${8 - i}`);
        f++;
      }
    }
  });
  return out.sort();
}

/**
 * The squares his splash covers: every square with one of his pawns on the board as the crowd sees it (his rook drawn as
 * one), nearest his brush first, so the paint spreads from his side. Nothing in it says which is the rook.
 */
export function splashRow(boss: Pick<BossView, "crowdSide"> & { board: { fen: string } }, orientation: Orientation): string[] {
  const row = pawnSquares(seenFen(boss.board.fen), other(boss.crowdSide));
  const dist = (sq: string) => {
    const c = centreOf(sq, orientation);
    return Math.hypot(c.x - BRUSH.x, c.y - BRUSH.y);
  };
  return row.sort((a, b) => dist(a) - dist(b) || (a < b ? -1 : 1));
}

// ---------------- The board under his moments ----------------

/**
 * The position the board shows during his moments (each moment draws its own paint over it): before the splash covers his
 * pawns the rook where he lifted it (the swap happens under the paint), before the drip a revealed rook still as a pawn (it
 * shows as a rook as the paint drips off), and on a Repaint each piece in its old color until its stroke. `still`: the
 * board doesn't animate now (a piece changing under the paint, a stroke). `hush`: the boss's move isn't named yet (a
 * strike's name would give it away a moment early). Null with none of his (the plain position: Boss.tsx).
 */
export function smudgyFen(boss: BossView, moments: readonly Moment[], now: number, fen: string): { fen: string; still: boolean; hush: boolean } | null {
  const p = boss.powers;
  if (!p || boss.id !== "smudgy") return null;
  const his = other(boss.crowdSide);
  const near = (at: number) => now >= at - 30 && now < at + 300;
  let out = fen;
  let still = false;
  let hush = false;
  const cam = find(moments, "camouflage");
  const swap = p.camo?.swap;
  if (cam && swap && now < cam.at + B.camouflage.swapAt) {
    // (The rook where he lifted it, the pawn where it stood: the swap is under the paint.)
    if (pieceAt(out, swap.pawn)?.type === "r" && pieceAt(out, swap.rook)?.type === "p") out = withPiece(withPiece(out, swap.pawn, { color: his, type: "p" }), swap.rook, { color: his, type: "r" });
  }
  if (cam) still ||= near(cam.at + B.camouflage.swapAt);
  const um = find(moments, "unmask");
  if (um?.square) {
    const dripAt = um.at + B.unmask.dripAt;
    if (now < dripAt) {
      if (pieceAt(out, um.square)?.type === "r") out = withPiece(out, um.square, { color: his, type: "p" });
      hush = true;
    }
    still ||= near(dripAt);
  }
  const rm = find(moments, "repaint");
  const rp = p.repaint;
  if (rm && rp) {
    const s1 = rm.at + B.repaint.stroke1At;
    const s2 = rm.at + B.repaint.stroke2At;
    // (Before its stroke each is as it was: his pawn his, your piece yours.)
    if (now < s1) out = withPiece(out, rp.pawn, { color: his, type: "p" });
    if (now < s2) out = withPiece(out, rp.piece, { color: boss.crowdSide, type: rp.type });
    still ||= near(s1) || near(s2);
  }
  return out === fen && !still && !hush ? null : { fen: out, still, hush };
}

// ---------------- The rook taken (while he thinks) ----------------

/** When this device first saw each rook taken (a screen drawn again carries on; it doesn't start over). */
const takenSeen = new Map<string, number>();

/**
 * The hidden rook your move just took, as a moment of his thinking screen (from when this device first saw it): the drip
 * on its square, "That was his rook!" and his line. None when your move took nothing hidden.
 */
export function rookTakenMoment(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "smudgy" || !p) return [];
  return p.events
    .filter((e) => e.kind === "rookTaken" && e.turn === p.turn)
    .map((e): Moment => {
      const key = `${boss.id}:rookTaken:${e.turn}:${e.square}`;
      let at = takenSeen.get(`${boss.startMove}:${key}`);
      if (at === undefined) {
        takenSeen.set(`${boss.startMove}:${key}`, (at = now));
        if (takenSeen.size > 20) takenSeen.delete(takenSeen.keys().next().value!);
      }
      return { kind: "rookTaken", key, at, ms: POWER_FX.rookTaken, ...(e.square ? { square: e.square } : {}) };
    });
}

// ---------------- His moments ----------------

/** The paint's look on the i-th square of a row: three shapes in turn, so a row of pawns doesn't look stamped. */
const shape = (i: number) => "ABC"[i % 3]!;

/**
 * The splash over his pawn row as `now`: each square's lands (spreading, then held) in turn, the swap done under it, then
 * each fades in turn. Only the squares that have started: an item shows from its own start.
 */
export function splashItems(squares: readonly string[], moment: Pick<Moment, "at">, now: number): SquareItem[] {
  const c = B.camouflage;
  const out: SquareItem[] = [];
  squares.forEach((square, i) => {
    const landAt = moment.at + c.splashAt + c.flyMs + i * c.stagger;
    const fadeAt = moment.at + c.swapAt + c.holdMs + i * c.stagger;
    // (Quiet: the splash's one sound is the row's, at the landing.)
    if (now >= fadeAt) out.push({ square, name: "paintSplash", anim: `fade${shape(i)}`, since: fadeAt, quiet: true });
    else if (now >= landAt) out.push({ square, name: "paintSplash", anim: `land${shape(i)}`, then: `hold${shape(i)}`, since: landAt, quiet: true });
  });
  return out;
}

/** "CAMOUFLAGE!": he flings his brush, a blob of paint flies to his pawns, a splash covers every one, the swap happens under it, and it fades. */
function camouflageMoment({ boss, moment, now, t, orientation, banner, cast }: MomentProps) {
  const c = B.camouflage;
  const squares = splashRow(boss, orientation);
  const items = splashItems(squares, moment, now);
  // The blob: from his brush to the middle of his pawns, arcing up as it goes.
  const targets = squares.map((sq) => centreOf(sq, orientation));
  const to: Pt = targets.length ? { x: targets.reduce((s, q) => s + q.x, 0) / targets.length, y: targets.reduce((s, q) => s + q.y, 0) / targets.length } : { x: 50, y: 20 };
  const u = (t - c.splashAt) / c.flyMs;
  const flying = u >= 0 && u < 1;
  const k = ease(u);
  const at = { x: BRUSH.x + (to.x - BRUSH.x) * k, y: BRUSH.y + (to.y - BRUSH.y) * k - 12 * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) };
  return (
    <div class="power-moment pm-camo">
      {banner("CAMOUFLAGE!", "A rook hides among his pawns", "paint", c.splashAt)}
      {cast("splash", c.splashAt)}
      <div class="sm-layer" aria-hidden="true" data-camo={t < c.splashAt ? "banner" : t < c.splashAt + c.flyMs ? "fly" : t < c.swapAt ? "cover" : t < c.swapAt + c.holdMs ? "hold" : "fade"} data-covered={items.length}>
        {flying && (
          <span key="fly" class="sm-fly" style={{ left: `${r2(at.x - 6.25)}%`, top: `${r2(at.y - 6.25)}%` }}>
            <BossEffect name="paintFly" since={moment.at + c.splashAt} id="fly" />
          </span>
        )}
        <BoardEffects items={items} orientation={orientation} class="sm-paint" />
      </div>
      <SoundAt id={`${moment.key}:${boss.startMove}:landed`} at={moment.at + c.splashAt + c.flyMs} now={now} sound="smudgySplash" />
    </div>
  );
}

/** The reveal: his tail snaps open and the paint drips off the piece's square, which shows as the rook it is (smudgyFen). */
function unmaskMoment({ boss, moment, now, orientation, cast }: MomentProps) {
  const d = B.unmask;
  const square = moment.square ?? boss.powers?.camo?.reveal?.square;
  // (Quiet: his `drip` cue is the sound.)
  const items: SquareItem[] = square && now >= moment.at + d.dripAt ? [{ square, name: "paintDrip", since: moment.at + d.dripAt, quiet: true }] : [];
  return (
    <div class="power-moment pm-unmask">
      {cast("drip", d.dripAt)}
      <div class="sm-layer" aria-hidden="true" data-unmask={now < moment.at + d.dripAt ? "pawn" : "rook"}>
        <BoardEffects items={items} orientation={orientation} class="sm-paint" />
      </div>
    </div>
  );
}

/** The rook taken: a drip on its square (its own sound), in the thinking screen: he stays where he is. */
function rookTakenView({ moment, now, orientation }: MomentProps) {
  const d = B.rookTaken;
  const items: SquareItem[] = moment.square && now >= moment.at + d.dripAt ? [{ square: moment.square, name: "paintDrip", since: moment.at + d.dripAt }] : [];
  return (
    <div class="power-moment pm-taken pm-stay">
      <div class="sm-layer" aria-hidden="true" data-taken={moment.square ?? ""}>
        <BoardEffects items={items} orientation={orientation} class="sm-paint" />
      </div>
    </div>
  );
}

/** "REPAINT!", then two strokes: cream on his pawn's square (it's yours), charcoal on your piece's (it's his). */
function repaintMoment({ boss, moment, now, t, orientation, banner, cast }: MomentProps) {
  const c = B.repaint;
  const rp = boss.powers?.repaint;
  const items: SquareItem[] = [];
  // (Quiet: his `stroke1` and `stroke2` cues are the sound.)
  if (rp && now >= moment.at + c.stroke1At) items.push({ square: rp.pawn, name: "brushStroke", anim: "strokeC", since: moment.at + c.stroke1At, quiet: true });
  if (rp && now >= moment.at + c.stroke2At) items.push({ square: rp.piece, name: "brushStroke", anim: "strokeN", since: moment.at + c.stroke2At, quiet: true });
  return (
    <div class="power-moment pm-repaint">
      {banner("REPAINT!", rp ? `${rp.pawn} and ${rp.piece} change sides` : undefined, "paint", c.stroke1At)}
      {cast("stroke1", c.stroke1At)}
      <div class="sm-layer" aria-hidden="true" data-repaint={t < c.stroke1At ? "banner" : t < c.stroke2At ? "first" : "second"}>
        <BoardEffects items={items} orientation={orientation} class="sm-paint" />
      </div>
    </div>
  );
}

/** A line from his kit's lines for one of his own moments (the same for everyone: by the moment's key). */
const ownLine = (beat: "camoStrike" | "rookTaken", kit: ReturnType<typeof bossKit>, key: string): string | null => {
  const lines = kit?.lines[beat];
  return lines?.length ? lines[hash(key) % lines.length]! : null;
};

/**
 * Camouflage, the reveal and the rook taken play as the crowd's turn begins (or, the rook taken, as its move lands, while
 * he thinks); Repaint is his whole turn.
 */
const MOMENTS: Record<"camouflage" | "unmask" | "rookTaken" | "repaint", MomentUi> = {
  // (His line as the paint leaves his brush.)
  camouflage: { order: 0, kit: "power", lineAt: B.camouflage.splashAt, view: camouflageMoment },
  // (His line as the paint drips: `camoStrike`'s, the rules' reveal, not his strike on a piece.)
  unmask: { order: 0, kit: "powerHit", dock: () => UNMASK_LINE, line: (kit, m) => ownLine("camoStrike", kit, m.key), lineAt: B.unmask.dripAt, view: unmaskMoment },
  rookTaken: { order: 0, kit: "ultimateHit", dock: () => TAKEN_LINE, line: (kit, m) => ownLine("rookTaken", kit, m.key), view: rookTakenView },
  repaint: { order: 2, kit: "ultimate", lineAt: B.repaint.stroke1At, view: repaintMoment },
};

let warmed = false;
/** His splash, reveal and Repaint drawn ahead as his battle starts, and the paint's frames. */
export function prewarmSmudgy(name: string): void {
  const kit = bossKit(name);
  if (!kit || warmed) return;
  warmed = true;
  const frames = (anim: string) => kit.ch.anims[anim]?.frames ?? [];
  prewarmSprite(kit.ch, [...frames("camouflage"), ...frames("strike"), ...frames("repaint")]);
  for (const fx of ["paintSplash", "paintDrip", "brushStroke", "paintFly"] as const) prewarm(fx, Object.entries(EFFECTS[fx].ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const SMUDGY_UI = {
  id: "smudgy",
  // (His Repaint comes at the start of his turn, after your move, as Alfil's Slam.)
  ultimate: { name: "Repaint", when: "After your move" },
  moments: MOMENTS,
  // His Repaint was his whole turn: no move to show.
  noMove: (boss) => (boss.powers?.repaint && boss.powers.repaint.at === boss.crowdMoves && !boss.lastMove ? REPAINT_LINE : null),
} satisfies BossUi;
