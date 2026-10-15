import type { BossKit } from "../characters/kits.ts";
import { cueAt } from "../characters/power-art.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BossEffect, BossMoment } from "./BossEffect.tsx";
import { funhouseAngle, type BoardAngle } from "@chessroyale/chess";
import type { QuarterTurn } from "../board-view.ts";
import { Flight, hash, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Boingo's powers on screen: the pie (his throw, the pie's flight, the splat, the pie on its square while it lasts) and
 * the funhouse (he pogos onto the board, it spins and flips, he speaks, he plays the crowd's move, he bounces off). His
 * rules: packages/chess/src/bosses/boingo.ts.
 */

/** The pie's beats: the banner, then his throw, the pie's flight from his side, the splat. */
export const PIE = { flyAt: 1450, landAt: 1800 } as const;

// ---------------- The funhouse's beats (ms into its moment) ----------------

/**
 * The funhouse as it comes, on a screen of its own (the crowd's turn about to begin): the banner first; then Boingo
 * drops onto the board (his kit's `funhouse`: he lands, springs into a spin, and the board turns upside down with him at
 * its `flip` cue), his joke, the crowd's move he plays for it (Eric, Oct 12: "the forced move is the joke"), and he
 * bounces off. Then he replies with his own move.
 */
export const FUNHOUSE = { clownAt: 2300, flipMs: 700, lineAt: 3700, moveAt: 4500, exitAt: 5500 } as const;
/** Each later step of the funhouse (the board turns again as a crowd turn begins): its banner, then the turn. */
export const SPIN = { spinAt: 2300, spinMs: 700, lineAt: 2300 } as const;

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

function pieMoment({ moment, t, orientation, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-pie">
      {t < 2500 && banner("PIE!", moment.square ? `Splat on ${moment.square}` : undefined)}
      {cast("throw", PIE.flyAt)}
      {moment.square && t >= PIE.flyAt && t < PIE.landAt && <Flight name="pieFly" square={moment.square} orientation={orientation} since={moment.at + PIE.flyAt} ms={PIE.landAt - PIE.flyAt} />}
    </div>
  );
}

function funhouseMoment({ boss, moment, t, banner, anim: kitAnim }: MomentProps) {
  // (His line, as he lands on the board, is in his text box: FUNHOUSE.lineAt, said into his voice.)
  return (
    <div class="power-moment pm-funhouse">
      {t < 2500 && banner("FUNHOUSE!", "Upside down!", "fun")}
      {t >= FUNHOUSE.clownAt && (
        <span class={`pm-pogo${t >= FUNHOUSE.exitAt ? " out" : ""}`}>
          {kitAnim() ? <BossMoment boss={boss.name} anim={kitAnim()!} since={moment.at + FUNHOUSE.clownAt} then="idle" /> : <BossFace boss={boss} />}
        </span>
      )}
    </div>
  );
}

/** A later step: the board turns again (round to a side, or back the right way up). */
function spinMoment({ boss, t, banner }: MomentProps) {
  const p = boss.powers;
  const to: BoardAngle = p?.angle ?? 0;
  const from = funhouseAngle(p?.funhouse ?? null, (p?.turn ?? 0) - 1);
  const s = spinOf(from, to);
  const sub = to === 0 ? "Right way up again" : s === "half" ? "To the other side" : s === "cw" ? "A quarter turn right" : "A quarter turn left";
  return <div class="power-moment pm-spin">{t < SPIN.spinAt && banner(to === 0 ? "BACK AGAIN!" : "SPIN!", sub, "fun")}</div>;
}

export const BOINGO_UI = {
  id: "clown",
  ultimate: { name: "the Funhouse" },
  moments: {
    pie: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + PIE.landAt : undefined), view: pieMoment },
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
  // The pies on their squares (pieSplat: the splat, then the pie), in eighths of the board's own size, where the board
  // shows them however it's turned.
  board: ({ p, orientation, now, appearAt, turn }) => {
    const pies = p.pies ?? (p.pie ? [p.pie] : []);
    return {
      over: pies.map(
        ({ square }) =>
          now >= appearAt(square) && (
            <span key={`pie-${square}`} class="pw-pie" style={onSquare(square, orientation, turn)} data-square={square}>
              <BossEffect name="pieSplat" since={appearAt(square)} id={square} />
            </span>
          ),
      ),
    };
  },
} satisfies BossUi;
