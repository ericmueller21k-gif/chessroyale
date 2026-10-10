import { BOSS_POWERS } from "@chessroyale/core";
import { inCheck, pieceAt, sideToMove } from "@chessroyale/chess";
import type { BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt, darkItem } from "../characters/power-art.ts";
import { HOLLOW_CAST_FROM } from "../characters/hollow.ts";
import { pickLine } from "../characters/boss-beats.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossEffect, BossMoment } from "./BossEffect.tsx";
import { Flight, at, onSquare, stageSince, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Hollow's powers on screen: his cover of the dark (his cast from the board's corner, the darkness pouring onto its
 * square, the square hidden while it lasts and thinning on its last turn, then lifting), a wrong move attempt into the
 * dark (DarkCost), his strand of bulbs by the boss bar (one lit for each of his moves until his next cover), and the
 * banner of his extra move after a failed Lights out. Lights out itself: LightsOut.tsx. His rules:
 * packages/chess/src/bosses/hollow.ts.
 */

/**
 * Hollow's cover of the dark: the banner, then (as it goes) his cast by the board's corner (`darkCast`, the darkness
 * leaving the void in his chest at its `cast` cue), the darkness pouring onto the square (`darkPour`), and the square
 * going dark (`darkSquare` gather, then dark).
 */
export const DARK = { pourAt: 1300, landAt: 1680 } as const;
/** Where Hollow casts from in a moment by the board's corner (% of the board): a box his frame's shape. */
export const HOLLOW_CASTER = { left: -9, top: -27, width: 30 } as const;
/** The void in his chest as he casts, on the board (%), where the darkness leaves from. */
export function hollowCastFrom(kit: BossKit | null): { x: number; y: number } {
  const w = kit?.ch.w ?? 104;
  const h = kit?.ch.h ?? 102;
  return { x: HOLLOW_CASTER.left + (HOLLOW_CAST_FROM[0] / w) * HOLLOW_CASTER.width, y: HOLLOW_CASTER.top + (HOLLOW_CAST_FROM[1] / h) * HOLLOW_CASTER.width * (h / w) };
}
const CLEAR_MS = animLength(EFFECTS.darkSquare.ch.anims.clear!);

/** The square a side's king stands on. */
function kingOn(fen: string, side: "w" | "b"): string | null {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const pc = pieceAt(fen, `${f}${r}`);
    if (pc?.type === "k" && pc.color === side) return `${f}${r}`;
  }
  return null;
}

/**
 * Your own move attempt into the dark that wasn't legal: the red-violet slash on the square it went for (`darkMiss`) and
 * a small "−5" rising off it. Only you see it.
 */
export function DarkCost({ square, since, now, orientation }: { square: string; since: number; now: number; orientation: "white" | "black" }) {
  if (now < since || now >= since + 1600) return null;
  return (
    <div class="power-board pw-dark-cost" aria-hidden="true">
      <span class="pw-dark-slash" style={at(square, orientation)}>
        <BossEffect name="darkMiss" since={since} id={`miss-${square}-${since}`} />
      </span>
      <span class="pw-cost" style={onSquare(square, orientation)} data-square={square}>
        −{BOSS_POWERS.darkTryCost}
      </span>
    </div>
  );
}

/** The strip relights this long after the last bulb goes out (his move shows, then the cast lands). */
const BULB_RELIGHT_MS = 1800 + DARK.landAt;
/** When this device saw Hollow's bulbs change, and from what (so the strip plays a bulb going out, or the relight). */
const bulbSeen = new Map<string, { n: number; from: number; at: number; relightAt?: number }>();
/**
 * Hollow's bulbs by the boss bar: the strip (`bulbStrand`), one lit for each of his moves until he covers another square
 * (the same count as on his strand). A bulb goes out as he moves; at the last he covers a square and they relight.
 * `moments`: the boss screen's moments (one of them may be a cover).
 */
function bulbStrip({ boss, moments }: { boss: BossView; moments: () => Moment[] }) {
  const n = boss.powers?.bulbs;
  if (n === undefined || boss.result) return null;
  // (On the boss screen that brings a cover: the strip relights as the darkness lands.)
  const cover = moments().find((m) => m.kind === "dark");
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const now = Date.now();
  let seen = bulbSeen.get(key);
  if (!seen) bulbSeen.set(key, (seen = { n, from: n, at: 0 }));
  else if (seen.n !== n) bulbSeen.set(key, (seen = { n, from: seen.n, at: now }));
  // Fewer: the bulb going out. More (he covered a square): the last going out with his move, then the relight as the
  // darkness lands.
  if (cover && seen.at && n > seen.from) seen.relightAt = cover.at + DARK.landAt;
  const relightAt = seen.relightAt ?? seen.at + BULB_RELIGHT_MS;
  const look = !seen.at
    ? { anim: `lit${Math.min(3, n)}`, since: 0 }
    : n < seen.from
      ? { anim: `out${Math.min(3, seen.from)}`, then: `lit${Math.min(3, n)}`, since: seen.at }
      : now < relightAt
        ? { anim: "out1", then: "lit0", since: seen.at }
        : { anim: "relight", then: "lit3", since: relightAt };
  return (
    <span class="bulb-strip" role="img" aria-label={`${n} ${n === 1 ? "bulb" : "bulbs"} lit`} data-bulbs={n}>
      <BossEffect name="bulbStrand" anim={look.anim} then={look.then} since={look.since} id={`bulbs-${key}-${look.anim}-${look.since}`} />
    </span>
  );
}

function darkMoment({ boss, moment, now, t, orientation, kit, banner, line: kitsLine }: MomentProps) {
  const cast = kit?.ch.anims.darkCast;
  const castSince = moment.at + DARK.pourAt - ((cast && cueAt(cast, "cast")) ?? 0);
  const fromPt = hollowCastFrom(kit);
  const line = kitsLine();
  return (
    <div class="power-moment pm-dark">
      {t < 1250 && banner("DARKNESS!", moment.square ? `Dark on ${moment.square}` : undefined, "dark")}
      {cast && now >= castSince && (
        <span class="pm-caster pm-hollow" style={{ aspectRatio: `${kit!.ch.w} / ${kit!.ch.h}` }}>
          {/* (His bulbs out as he casts: the last went out with his move.) */}
          <BossMoment boss={boss.name} anim="darkCast" since={castSince} then="idle" look="bulbs0" />
        </span>
      )}
      {moment.square && t >= DARK.pourAt && t < DARK.landAt && <Flight name="darkPour" square={moment.square} orientation={orientation} since={moment.at + DARK.pourAt} ms={DARK.landAt - DARK.pourAt} aim from={fromPt} />}
      {/* His words in his pixel text box as the darkness lands: his first cover's always, a taunt now and then. */}
      {line && t >= DARK.pourAt && (
        <div class="pm-line" role="status" aria-label={line}>
          {line.slice(0, Math.min(line.length, Math.floor((t - DARK.pourAt) / 28) + 1))}
        </div>
      )}
    </div>
  );
}

// Hollow moves twice (the crowd's find rate in Lights out was under lightsOutHold): his banner as it lands.
const extraMoment = ({ boss, t, banner }: MomentProps) => <div class="power-moment pm-extra">{t < 1800 && banner("TWICE!", `${boss.name.replace(/^The /, "")} moves again`, "dark")}</div>;

export const HOLLOW_UI = {
  id: "hollow",
  ultimate: { name: "Lights Out" },
  moments: {
    dark: {
      order: 0,
      kit: "power",
      appearAt: (m, square) => (m.square === square ? m.at + DARK.landAt : undefined),
      // His first cover of the dark always has his first-cover line; later ones a taunt now and then (his kit's chance).
      line: (kit, m) => (m.first ? (kit?.lines.darkFirst?.[0] ?? null) : kit ? pickLine(kit, "power", m.key) : null),
      view: darkMoment,
    },
    // His extra move, after a failed Lights out: its own moment, after the turn's others played with his move.
    extra: { order: 3, kit: "ultimateHit", own: (boss) => boss.powers?.lightsExtra === "played" && boss.powers.events.some((e) => e.kind === "extra"), view: extraMoment },
  },
  bar: bulbStrip,
  // The dark: each covered square hides its piece (forming as his cast lands, thinning on its last turn), and one that
  // has just cleared lifts; check still shows on a king in the dark.
  board: ({ boss, p, board, orientation, now, appearAt }) => {
    const darkNow = p.dark ?? [];
    const dark: { square: string; state: "new" | "dark" | "thin" | "clear"; since: number }[] = [
      ...darkNow.flatMap((d) => {
        const since = appearAt(d.square);
        if (now < since) return [];
        return [{ square: d.square, state: since ? ("new" as const) : d.until <= p.turn ? ("thin" as const) : ("dark" as const), since }];
      }),
      ...(p.cleared ?? []).flatMap((sq) => {
        const since = stageSince(`clear:${boss.id}:${sq}:${p.turn}`, now);
        return now < since + CLEAR_MS ? [{ square: sq, state: "clear" as const, since }] : [];
      }),
    ];
    const checked = darkNow.length && inCheck(board) ? kingOn(board, sideToMove(board)) : null;
    return {
      over: (
        <>
          {dark.length > 0 && <BoardEffects items={dark.map((d) => darkItem(d.square, d.state, d.since))} orientation={orientation} class="pw-fire-board pw-dark-board" />}
          {dark.map((d) => (
            <span key={`dark-${d.square}`} class={`pw-dark ${d.state}`} style={onSquare(d.square, orientation)} data-square={d.square} data-state={d.state} />
          ))}
          {checked && darkNow.some((d) => d.square === checked) && <span class="pw-dark-check" style={onSquare(checked, orientation)} data-square={checked} />}
        </>
      ),
    };
  },
} satisfies BossUi;
