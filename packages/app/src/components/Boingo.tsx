import { useContext } from "preact/hooks";
import type { BossKit } from "../characters/kits.ts";
import { EFFECTS, cueAt } from "../characters/power-art.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BossEffect, BossMoment, SpriteAnim } from "./BossEffect.tsx";
import { funhouseAngle, pieceAt, type BoardAngle } from "@chessroyale/chess";
import { BoardTurn, type QuarterTurn } from "../board-view.ts";
import type { PieceDecor } from "../board/types.ts";
import type { BossView } from "../game.ts";
import { Flight, PIECE_WORD, hash, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Boingo's powers on screen: the pie (Eric, Nov 12: his throw, the pie in the face of one of your pieces, two pieces of it
 * splitting off onto the two squares diagonally behind it, the pies there while they last; the piece's splat mark, a
 * small cream smear drawn with the piece; a second splat's freeze, Ginger's ice) and the funhouse (he pogos onto the
 * board, it spins and flips, he speaks, he plays the crowd's move, he bounces off). His rules:
 * packages/chess/src/bosses/boingo.ts.
 */

/**
 * The pie's beats (ms into its moment): the banner (gone as he throws), then his throw and the pie's flight from his side
 * (`flyAt`), the pie in the piece's face (`hitAt`: the splash, its splat mark, a second splat's ice from `iceAt`), two
 * pieces of it splitting off (`splitAt`) and landing on the two squares behind (`landAt`: the splat, then the pie).
 */
export const PIE = { flyAt: 1450, hitAt: 1800, iceAt: 1900, splitAt: 1880, landAt: 2160 } as const;

// ---------------- The funhouse's beats (ms into its moment) ----------------

/**
 * The funhouse as it comes, on a screen of its own (the crowd's turn about to begin): the banner first; then Boingo
 * drops onto the board (his kit's `funhouse`: he lands, springs into a spin, and the board turns upside down with him at
 * its `flip` cue), his joke, the crowd's move he plays for it (Eric, Oct 12: "the forced move is the joke"), and he
 * bounces off. Then he replies with his own move.
 */
export const FUNHOUSE = { clownAt: 1300, flipMs: 700, lineAt: 2700, moveAt: 3500, exitAt: 4500 } as const;
/** Each later step of the funhouse (the board turns again as a crowd turn begins): its banner, then the turn. */
export const SPIN = { spinAt: 1300, spinMs: 700, lineAt: 1300 } as const;

/** When the board starts its spin (ms into the funhouse's moment): on the funhouse animation's `flip` cue. */
export function funhouseFlipAt(kit: BossKit | null): number {
  const a = kit?.ch.anims.funhouse;
  return FUNHOUSE.clownAt + ((a && cueAt(a, "flip")) ?? 620);
}

/** How a step turns the board: a quarter turn clockwise or anticlockwise, or a half turn. */
export type Spin = "cw" | "ccw" | "half";
export const spinOf = (from: BoardAngle, to: BoardAngle): Spin | null => {
  const d = (to - from + 360) % 360;
  return d === 90 ? "cw" : d === 270 ? "ccw" : d === 180 ? "half" : null;
};

/**
 * The board's angle as a boss screen shows it, and its spin while it turns: the funhouse's moment (or a later step's)
 * shows the board as it was until its spin, turns it (a CSS turn of the board in its own plane, the pieces going round
 * with it for a moment), then shows it at its new angle, drawn untransformed (the board's squares are placed then).
 * Without one, the angle the battle's powers say. `turn`: the crowd turn the powers are set for.
 */
export function funhouseView(moments: readonly Moment[], now: number, powers: { funhouse: { turn: number; side: 90 | 270 } | null; angle?: BoardAngle; flipped: boolean; turn: number } | null | undefined, kit: BossKit | null): { angle: BoardAngle; spin: Spin | null } {
  const angle: BoardAngle = powers?.angle ?? (powers?.flipped ? 180 : 0);
  const m = moments.find((x) => x.kind === "funhouse" || x.kind === "spin");
  if (!m || !powers) return { angle, spin: null };
  const from: BoardAngle = m.kind === "funhouse" ? 0 : funhouseAngle(powers.funhouse, powers.turn - 1);
  const spinAt = m.at + (m.kind === "funhouse" ? funhouseFlipAt(kit) : SPIN.spinAt);
  const ms = m.kind === "funhouse" ? FUNHOUSE.flipMs : SPIN.spinMs;
  if (now < spinAt) return { angle: from, spin: null };
  if (now < spinAt + ms) return { angle: from, spin: spinOf(from, angle) };
  return { angle, spin: null };
}

/** The board's orientation and quarter turn for an angle, from the crowd's side. */
export function angleView(angle: BoardAngle, side: "w" | "b"): { orientation: "white" | "black"; turn: QuarterTurn } {
  const own = side === "w" ? "white" : "black";
  const other = side === "w" ? "black" : "white";
  return { orientation: angle === 180 ? other : own, turn: angle === 90 || angle === 270 ? angle : 0 };
}

/**
 * Boingo's joke as he plays the crowd's move in his funhouse: one of these, picked from the battle's seed (the event's
 * `pick`), so every screen in a lobby hears the same one.
 */
export const FUNHOUSE_LINES = [
  "Oops! Did I just play for you? Hee hee!",
  "Whoopsie, my hand slipped... on YOUR piece!",
  "Honk honk! I'll drive this one!",
  "Your move? I made it for you. You're welcome!",
];
export function funhouseLine(m: Pick<Moment, "key" | "pick">): string {
  return FUNHOUSE_LINES[(m.pick ?? hash(m.key)) % FUNHOUSE_LINES.length]!;
}
/** His line as the board turns again (round to a side, or back the right way up). */
export const SPIN_LINES = ["Wheee! Round we go!", "Dizzy yet? Honk!", "Hold on tight! Hee hee!"];

/** The throw froze its piece (its second splat): the piece the pie hit is the one frozen from this turn. */
const pieFroze = (boss: Pick<BossView, "powers">, m: Pick<Moment, "square">): boolean => !!m.square && boss.powers?.frozen?.square === m.square && boss.powers.frozen.until === boss.powers.turn;

/** The pie in the piece's face, side on from his side (the king attack's art, `hitHL`), with its splat. */
function FaceSplash({ square, orientation, since }: { square: string; orientation: "white" | "black"; since: number }) {
  const fx = EFFECTS.pieHit;
  return (
    <span class="pw-pie pw-pie-face" style={onSquare(square, orientation, useContext(BoardTurn))}>
      <SpriteAnim ch={fx.ch} anim="hitHL" since={since} sounds={{ splat: "clownSplat" }} id={`face-${square}`} />
    </span>
  );
}

function pieMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const sq = moment.square;
  const piece = sq ? pieceAt(boss.board.fen, sq) : null;
  const word = piece ? PIECE_WORD[piece.type] : null;
  return (
    <div class="power-moment pm-pie">
      {banner("PIE!", word ? (pieFroze(boss, moment) ? `Splat! Your ${word} is frozen` : `Splat on your ${word}`) : undefined, "", PIE.flyAt)}
      {cast("throw", PIE.flyAt)}
      {sq && t >= PIE.flyAt && t < PIE.hitAt && <Flight name="pieFly" square={sq} orientation={orientation} since={moment.at + PIE.flyAt} ms={PIE.hitAt - PIE.flyAt} />}
      {sq && t >= PIE.hitAt && t < PIE.hitAt + 260 && <FaceSplash square={sq} orientation={orientation} since={moment.at + PIE.hitAt} />}
      {sq &&
        t >= PIE.splitAt &&
        t < PIE.landAt &&
        (moment.squares ?? []).map((to) => <Flight key={to} name="pieFly" anim="fly" square={to} fromSquare={sq} bit orientation={orientation} since={moment.at + PIE.splitAt} ms={PIE.landAt - PIE.splitAt} />)}
    </div>
  );
}

/**
 * The splat marks on your pieces (a small cream smear drawn with each piece, so it slides with it), as a board decor. During
 * the pie's moment (Boss.tsx passes its moments): the new mark comes as the pie hits, and a mark the throw turned into a
 * freeze stays until then. Null when there's none to draw.
 */
export function boingoDecor(boss: (Pick<BossView, "id" | "crowdSide" | "powers">) | null | undefined, moments: readonly Moment[] = [], now = 0): PieceDecor | undefined {
  const p = boss?.id === "clown" ? boss.powers : null;
  if (!p) return undefined;
  const pie = moments.find((m) => m.kind === "pie");
  const before = !!pie?.square && now < pie.at + PIE.hitAt;
  const marks = (p.splats ?? []).filter((m) => !(before && m.square === pie!.square)).map((m) => `${m.square}${m.piece}`);
  if (before && pieFroze(boss!, pie!) && p.frozen) marks.push(p.frozen.square);
  if (!marks.length) return undefined;
  const side = boss!.crowdSide;
  return {
    key: `splat:${marks.join(",")}`,
    of: (square, code) => (code[0] === side && marks.some((m) => m.slice(0, 2) === square && (m.length === 2 || m[2] === code[1])) ? { cls: "pw-splatted", kids: <i class="pw-splat-mark" /> } : null),
  };
}

function funhouseMoment({ boss, moment, t, banner, anim: kitAnim }: MomentProps) {
  // (His line, as he lands on the board, is in his text box: FUNHOUSE.lineAt, said into his voice.)
  return (
    <div class="power-moment pm-funhouse">
      {banner("FUNHOUSE!", "Upside down!", "fun")}
      {t >= FUNHOUSE.clownAt && (
        <span class={`pm-pogo${t >= FUNHOUSE.exitAt ? " out" : ""}`}>
          {kitAnim() ? <BossMoment boss={boss.name} anim={kitAnim()!} since={moment.at + FUNHOUSE.clownAt} then="idle" /> : <BossFace boss={boss} />}
        </span>
      )}
    </div>
  );
}

/** A later step: the board turns again (round to a side, or back the right way up). */
function spinMoment({ boss, banner }: MomentProps) {
  const p = boss.powers;
  const to: BoardAngle = p?.angle ?? 0;
  const from = funhouseAngle(p?.funhouse ?? null, (p?.turn ?? 0) - 1);
  const s = spinOf(from, to);
  const sub = to === 0 ? "Right way up again" : s === "half" ? "To the other side" : s === "cw" ? "A quarter turn right" : "A quarter turn left";
  return <div class="power-moment pm-spin">{banner(to === 0 ? "BACK AGAIN!" : "SPIN!", sub, "fun", SPIN.spinAt)}</div>;
}

export const BOINGO_UI = {
  id: "clown",
  ultimate: { name: "the Funhouse" },
  moments: {
    // (The pies on the two squares behind as the split pieces land; a second splat's ice on the piece just after the hit.)
    pie: { order: 0, kit: "power", appearAt: (m, square) => (m.squares?.includes(square) ? m.at + PIE.landAt : m.square === square ? m.at + PIE.iceAt : undefined), view: pieMoment },
    // The funhouse has a screen of its own, after the move he plays for the crowd: the board turns upside down and the
    // move lands. Then each later step turns it again as a crowd turn begins.
    funhouse: {
      order: 3,
      kit: "ultimate",
      line: (_kit, m) => funhouseLine(m),
      lineAt: FUNHOUSE.lineAt,
      own: (boss) => !!boss.powers?.funhouse?.move && boss.powers.funhouse.turn === boss.crowdMoves && boss.powers.events.some((e) => e.kind === "funhouse"),
      view: funhouseMoment,
    },
    spin: {
      order: 3,
      kit: "ultimate",
      line: (_kit, m) => SPIN_LINES[hash(m.key) % SPIN_LINES.length]!,
      lineAt: SPIN.lineAt,
      view: spinMoment,
    },
  },
  // The pies on their squares (pieSplat: the splat, then the pie; one splat sound for the pair), and a frozen piece's ice
  // (Ginger's: it forms, then shimmers while it lasts), in eighths of the board's own size, where the board shows them
  // however it's turned.
  board: ({ boss, p, board, orientation, now, appearAt, turn }) => {
    const pies = p.pies ?? (p.pie ? [p.pie] : []);
    const ice = EFFECTS.iceOverlay;
    return {
      over: [
        ...pies.map(
          ({ square }, i) =>
            now >= appearAt(square) && (
              <span key={`pie-${square}`} class="pw-pie" style={onSquare(square, orientation, turn)} data-square={square}>
                <BossEffect name="pieSplat" since={appearAt(square)} id={square} quiet={i > 0} />
              </span>
            ),
        ),
        ...p.iced
          .filter((sq) => pieceAt(board, sq)?.color === boss.crowdSide && now >= appearAt(sq))
          .map((sq) => (
            <span key={`ice-${sq}`} class="pw-ice" style={onSquare(sq, orientation, turn)} data-square={sq}>
              <SpriteAnim ch={ice.ch} anim={ice.start!} then={ice.loop} since={appearAt(sq)} sounds={ice.sounds} id={sq} />
            </span>
          )),
      ],
    };
  },
} satisfies BossUi;
