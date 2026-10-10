import type { BossKit } from "../characters/kits.ts";
import { cueAt } from "../characters/power-art.ts";
import { BossFace } from "./BossCharacter.tsx";
import { BossEffect, BossMoment } from "./BossEffect.tsx";
import { Flight, at, hash, kitLine, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Boingo's powers on screen: the pie (his throw, the pie's flight, the splat, the pie on its square while it lasts) and
 * the funhouse (he pogos onto the board, it spins and flips, he speaks, he plays the crowd's move, he bounces off). His
 * rules: packages/chess/src/bosses/boingo.ts.
 */

/** The pie's beats: the banner, then his throw, the pie's flight from his side, the splat. */
export const PIE = { flyAt: 1450, landAt: 1800 } as const;

// ---------------- The funhouse's beats (ms into its moment) ----------------

/**
 * The banner first; then Boingo drops onto the board (his kit's `funhouse`: he lands, springs into a spin, and the
 * board spins with him at its `flip` cue), his line, the move he plays for the crowd, and he bounces off.
 */
export const FUNHOUSE = { clownAt: 1300, flipMs: 700, lineAt: 2700, moveAt: 3500, exitAt: 4500 } as const;

/** When the board starts its spin (ms into the moment): on the funhouse animation's `flip` cue. */
export function funhouseFlipAt(kit: BossKit | null): number {
  const a = kit?.ch.anims.funhouse;
  return FUNHOUSE.clownAt + ((a && cueAt(a, "flip")) ?? 620);
}

/**
 * In the funhouse's moment: whether the board spins (a half turn in its own plane, pieces upside down for a moment),
 * whether it shows flipped yet (the orientation swaps as the spin ends, with nothing transformed, so the board's
 * squares are measured true), and whether the move has been played.
 */
export function funhouseBeat(m: Moment | null, now: number, flipAt: number = funhouseFlipAt(null)): { flipped: boolean; flipping: boolean; played: boolean } | null {
  if (!m || m.kind !== "funhouse") return null;
  const t = now - m.at;
  const end = flipAt + FUNHOUSE.flipMs;
  return { flipped: t >= end, flipping: t >= flipAt && t < end, played: t >= FUNHOUSE.moveAt };
}

/** Boingo's line in his funhouse (his kit's, if it has some; these otherwise). */
export const FUNHOUSE_LINES = ["Let me get that for you!", "Welcome to the funhouse!", "Your move? Mine now!", "Honk! I'll drive."];
export function funhouseLine(kit: BossKit | null, key: string): string {
  return kitLine(kit, "ultimate", key) ?? FUNHOUSE_LINES[hash(key) % FUNHOUSE_LINES.length]!;
}

function pieMoment({ moment, t, orientation, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-pie">
      {t < 1500 && banner("PIE!", moment.square ? `Splat on ${moment.square}` : undefined)}
      {cast("throw", PIE.flyAt)}
      {moment.square && t >= PIE.flyAt && t < PIE.landAt && <Flight name="pieFly" square={moment.square} orientation={orientation} since={moment.at + PIE.flyAt} ms={PIE.landAt - PIE.flyAt} />}
    </div>
  );
}

function funhouseMoment({ boss, moment, t, banner, line: kitsLine, anim: kitAnim }: MomentProps) {
  const line = kitsLine() ?? FUNHOUSE_LINES[hash(moment.key) % FUNHOUSE_LINES.length]!;
  return (
    <div class="power-moment pm-funhouse">
      {t < 1500 && banner("FUNHOUSE!", undefined, "fun")}
      {t >= FUNHOUSE.clownAt && (
        <span class={`pm-pogo${t >= FUNHOUSE.exitAt ? " out" : ""}`}>
          {kitAnim() ? <BossMoment boss={boss.name} anim={kitAnim()!} since={moment.at + FUNHOUSE.clownAt} then="idle" /> : <BossFace boss={boss} />}
        </span>
      )}
      {t >= FUNHOUSE.lineAt && t < FUNHOUSE.exitAt && (
        <div class="pm-line" role="status" aria-label={line}>
          {line.slice(0, Math.min(line.length, Math.floor((t - FUNHOUSE.lineAt) / 28) + 1))}
        </div>
      )}
    </div>
  );
}

export const BOINGO_UI = {
  id: "clown",
  ultimate: { name: "the Funhouse" },
  moments: {
    pie: { order: 0, kit: "power", dock: "Pie!", appearAt: (m, square) => (m.square === square ? m.at + PIE.landAt : undefined), view: pieMoment },
    // The funhouse has a screen of its own: after the move he plays for the crowd.
    funhouse: {
      order: 3,
      kit: "ultimate",
      dock: "Funhouse!",
      own: (boss) => !!boss.powers?.funhouse && boss.powers.funhouse.turn === boss.crowdMoves && boss.powers.events.some((e) => e.kind === "funhouse"),
      view: funhouseMoment,
    },
  },
  // The pie on its square (pieSplat: the splat, then the pie).
  board: ({ p, orientation, now, appearAt }) => {
    const pie = p.pie?.square;
    return {
      over: pie && now >= appearAt(pie) && (
        <span key={`pie-${pie}`} class="pw-pie" style={at(pie, orientation)}>
          <BossEffect name="pieSplat" since={appearAt(pie)} id={pie} />
        </span>
      ),
    };
  },
} satisfies BossUi;
