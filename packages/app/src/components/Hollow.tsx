import { BOSS_POWERS } from "@chessroyale/core";
import { inCheck, pieceAt, sideToMove } from "@chessroyale/chess";
import type { BossKit } from "../characters/kits.ts";
import { EFFECTS, animLength, cueAt, darkItem } from "../characters/power-art.ts";
import { HOLLOW_CAST_FROM } from "../characters/hollow.ts";
import { pickLine } from "../characters/boss-beats.ts";
import type { BossView } from "../game.ts";
import { BoardEffects, BossEffect } from "./BossEffect.tsx";
import { Cast, Flight, at, onSquare, stageSince, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";
import { CRITICAL, NORMAL } from "../speech.tsx";
import { syncLights } from "../characters/lights.ts";
import { useFrameNow } from "./Countdown.tsx";

/**
 * Hollow's powers on screen: his cover of the dark (his cast from the board's corner, the darkness pouring onto its
 * square, the square hidden while it lasts and thinning on its last turn, then lifting), a wrong move attempt into the
 * dark (DarkCost), his strand of bulbs by the boss bar (one lit for each of his moves until his next cover), and the
 * banner of his extra move after a failed Lights out. Lights out itself: LightsOut.tsx. His rules:
 * packages/chess/src/bosses/hollow.ts.
 */

/**
 * Hollow's cover of the dark: the banner (to `bannerMs`), then (as it goes) his cast by the board's corner (`darkCast`,
 * the darkness leaving the void in his chest at its `cast` cue), the darkness pouring onto the square (`darkPour`), and
 * the square going dark (`darkSquare` gather, then dark).
 */
export const DARK = { bannerMs: 1250, pourAt: 1300, landAt: 1680 } as const;
/** Where Hollow casts from in a moment by the board's corner (% of the board): a box his frame's shape. */
export const HOLLOW_CASTER = { left: -9, top: -27, width: 30 } as const;
/** The void in his chest as he casts, on the board (%), where the darkness leaves from. */
export function hollowCastFrom(kit: BossKit | null): { x: number; y: number } {
  const w = kit?.ch.w ?? 104;
  const h = kit?.ch.h ?? 102;
  return { x: HOLLOW_CASTER.left + (HOLLOW_CAST_FROM[0] / w) * HOLLOW_CASTER.width, y: HOLLOW_CASTER.top + (HOLLOW_CAST_FROM[1] / h) * HOLLOW_CASTER.width * (h / w) };
}
const CLEAR_MS = () => animLength(EFFECTS.darkSquare.ch.anims.clear!);

/** The square a side's king stands on. */
function kingOn(fen: string, side: "w" | "b"): string | null {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const pc = pieceAt(fen, `${f}${r}`);
    if (pc?.type === "k" && pc.color === side) return `${f}${r}`;
  }
  return null;
}

/**
 * Your own move attempt into the dark that wasn't legal: the red-violet slash on the square it went for (`darkMiss`) and,
 * in a crowd, a small "−5" rising off it (Boss alone: a bulb of yours goes out instead, by the boss bar). Only you see it.
 */
export function DarkCost({ square, since, now, orientation, points = true }: { square: string; since: number; now: number; orientation: "white" | "black"; points?: boolean }) {
  if (now < since || now >= since + 1600) return null;
  return (
    <div class="power-board pw-dark-cost" aria-hidden="true">
      <span class="pw-dark-slash" style={at(square, orientation)}>
        <BossEffect name="darkMiss" since={since} id={`miss-${square}-${since}`} />
      </span>
      {points && (
        <span class="pw-cost" style={onSquare(square, orientation)} data-square={square}>
          −{BOSS_POWERS.darkTryCost}
        </span>
      )}
    </div>
  );
}

/**
 * The dark's move for you (Boss alone, the 3rd and 7th bulb out; Eric, Nov 5): a short dark flash over the board, the dark
 * closing in from its edges and lifting, while his line says it ("The dark moves for you."). DARK_FORCED.ms long; then
 * the move is played.
 */
export const DARK_FORCED = { ms: 1700, flashMs: 1300 } as const;
export function DarkForced({ since, now }: { since: number; now: number }) {
  if (now < since || now >= since + DARK_FORCED.flashMs) return null;
  return <div class="pw-dark-forced" aria-hidden="true" style={{ "--df-ms": `${DARK_FORCED.flashMs}ms` }} />;
}

/** His lines for Boss alone's bulbs: the dark's move for you, and the blackout (placeholders until Eric's own lines). */
export const HOLLOW_BULB_LINES = { forced: "The dark moves for you.", blackout: "Lights out. Forever." } as const;

/**
 * Total darkness (Boss alone, the 10th bulb out; Eric, Nov 5): the whole screen fades to black, your ten bulbs dark on
 * their wire, then his line types out, and a plain line says why ("Your last bulb went out."); then the loss screen.
 * BLACKOUT.ms long in all (the game's screens wait for it).
 */
export const BLACKOUT = { fadeMs: 1400, lineAt: 1500, whyAt: 2600, ms: 4600 } as const;
export function HollowBlackout({ since, boss }: { since: number; boss: BossView }) {
  const now = useFrameNow(true);
  if (now < since) return null;
  const t = now - since;
  const line = HOLLOW_BULB_LINES.blackout;
  const typed = t < BLACKOUT.lineAt ? 0 : Math.min(line.length, Math.floor((t - BLACKOUT.lineAt) / 45) + 1);
  return (
    <div class="hollow-blackout" role="alert" aria-label={`${boss.name}: ${line} Your last bulb went out.`} style={{ "--hb-fade": `${BLACKOUT.fadeMs}ms` }}>
      <div class="hb-inner">
        <span class="hb-strand">
          <BossEffect name="lifeStrand" anim="lit0" since={since} id={`blackout-${since}`} quiet />
        </span>
        <p class="hb-line" aria-hidden="true">
          <strong>{boss.name}</strong>
          <span>
            {line.slice(0, typed)}
            <span class="hb-rest">{line.slice(typed)}</span>
          </span>
        </p>
        <p class={`hb-why${t >= BLACKOUT.whyAt ? " on" : ""}`} aria-hidden="true">
          Your last bulb went out.
        </p>
      </div>
    </div>
  );
}

/**
 * His taunt on a misplay (a wrong move into the dark, alone or in a crowd; Eric, Nov 5): one of his kit's `misplay`
 * lines at random, never the one he said last (`last`), from `r` (0 to 1).
 */
export function nextTaunt(lines: readonly string[], last: string | null, r: number): string | null {
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : [...lines];
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(r * pool.length))]! : null;
}
let lastTaunt: string | null = null;
/** His next taunt (nextTaunt), remembered on this device so the one after it differs. */
export function hollowTaunt(lines: readonly string[] | undefined, r: number = Math.random()): string | null {
  const t = nextTaunt(lines ?? [], lastTaunt, r);
  if (t) lastTaunt = t;
  return t;
}

/** When this device saw your bulbs change, and from how many lit (so the strand plays a bulb going out). */
const lifeSeen = new Map<string, { lit: number; from: number; at: number }>();
/**
 * Your ten bulbs in Boss alone (Eric, Nov 5): his strand of lights in the boss bar's free room (BossUi.barProp), one lit
 * for each wrong move you have left before the dark takes the battle. A bulb goes out (its fizz) as a wrong move lands.
 */
function lifeStrip({ boss }: { boss: BossView }) {
  const s = boss.powers?.strand;
  if (!s) return null;
  syncLights(boss);
  const lit = Math.max(0, s.of - s.out);
  const key = `${boss.id}:${boss.startMove}:${boss.board.generation}`;
  const now = Date.now();
  let seen = lifeSeen.get(key);
  if (!seen) lifeSeen.set(key, (seen = { lit, from: lit, at: 0 }));
  else if (seen.lit !== lit) lifeSeen.set(key, (seen = { lit, from: seen.lit, at: now }));
  const going = seen.at && lit < seen.from;
  return (
    <span class="life-strip" role="img" aria-label={`Your bulbs: ${lit} of ${s.of} lit`} data-lit={lit} data-of={s.of}>
      <BossEffect name="lifeStrand" anim={going ? `out${seen.from}` : `lit${lit}`} then={going ? `lit${lit}` : undefined} since={going ? seen.at : 0} id={`life-${key}-${lit}-${seen.at}`} />
    </span>
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
  // (In the battle's lights: lights.ts.)
  syncLights(boss);
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

/** A block's banner (Eric, Nov 5): his 2 x 2 and his 3 x 3, with how long it lasts. */
export const blockBanner = (size: number): [string, string] =>
  size === 3 ? ["PITCH BLACK!", `3×3 dark for ${BOSS_POWERS.darkBigTurns} turns`] : ["DEEPER DARK!", `2×2 dark for ${BOSS_POWERS.darkBlockTurns} turns`];

function darkMoment({ boss, moment, now, t, orientation, kit, banner }: MomentProps) {
  const cast = kit?.ch.anims.darkCast;
  const castSince = moment.at + DARK.pourAt - ((cast && cueAt(cast, "cast")) ?? 0);
  const fromPt = hollowCastFrom(kit);
  const [title, sub] = moment.kind === "darkBlock" ? blockBanner(moment.size ?? 2) : ["DARKNESS!", moment.square ? `Dark on ${moment.square}` : undefined];
  return (
    <div class={`power-moment pm-dark${moment.kind === "darkBlock" ? ` pm-dark-block size${moment.size ?? 2}` : ""}`}>
      {banner(title, sub, "dark", DARK.bannerMs)}
      {/* (His strand lit in full as he casts, as in every pose: the strip by the bar counts down.) */}
      {cast && <Cast boss={boss.name} anim="darkCast" since={castSince} now={now} runKey={`${moment.key}:cast`} class="pm-hollow" style={{ aspectRatio: `${kit!.ch.w} / ${kit!.ch.h}` }} />}
      {moment.square && t >= DARK.pourAt && t < DARK.landAt && <Flight name="darkPour" square={moment.square} orientation={orientation} since={moment.at + DARK.pourAt} ms={DARK.landAt - DARK.pourAt} aim from={fromPt} />}
      {/* (His words as the darkness pours, his first cover's always and a taunt now and then, are in his text box.) */}
    </div>
  );
}

// Hollow moves twice (the crowd's find rate in Lights out was under lightsOutHold): his banner as it lands.
const extraMoment = ({ boss, banner }: MomentProps) => <div class="power-moment pm-extra">{banner("TWICE!", `${boss.name.replace(/^The /, "")} moves again`, "dark")}</div>;

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
      // Said as the darkness pours; his first cover's line says how the dark works, so it cuts in on any other.
      lineAt: DARK.pourAt,
      priority: (m) => (m.first ? CRITICAL : NORMAL),
      view: darkMoment,
    },
    // His block of the dark (Nov 5): a 2 x 2, or his 3 x 3 once a game; cast as a cover is, its new squares going dark as
    // it lands (a square already dark stays so). A taunt now and then.
    darkBlock: {
      order: 1,
      kit: "power",
      appearAt: (m, square) => (m.squares?.includes(square) ? m.at + DARK.landAt : undefined),
      line: (kit, m) => (kit ? pickLine(kit, "power", m.key) : null),
      lineAt: DARK.pourAt,
      priority: () => NORMAL,
      view: darkMoment,
    },
    // His extra move, after a failed Lights out: its own moment, after the turn's others played with his move.
    extra: { order: 3, kit: "ultimateHit", own: (boss) => boss.powers?.lightsExtra === "played" && boss.powers.events.some((e) => e.kind === "extra"), view: extraMoment },
  },
  bar: bulbStrip,
  // Boss alone: your ten bulbs, in the bar's free room.
  barProp: lifeStrip,
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
        return now < since + CLEAR_MS() ? [{ square: sq, state: "clear" as const, since }] : [];
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
