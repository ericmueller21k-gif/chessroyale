import type { JSX } from "preact";
import { SUPER_FREEZE_BEATS, bannerLeadMs, pieceAt, powerFxMs, sideToMove, superBox, superFreezeLeadMs } from "@chessroyale/chess";
import { EFFECTS, animLength } from "../characters/power-art.ts";
import type { BossView } from "../game.ts";
import { MOO_CINEMATIC } from "@chessroyale/core";
import { GINGER_BATTLE } from "../characters/ginger-super.ts";
import { rejoinedAt } from "../characters/moo-state.ts";
import { onResetBeats } from "./boss-figure.ts";
import { BossEffect, SpriteAnim, prewarm, prewarmSprite } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, PIECE_WORD, onSquare, type BossUi, type Moment, type MomentProps } from "./PowerParts.tsx";

/**
 * Ginger's powers on screen: the freeze (his cast, the ice bolt to the piece, the ice forming on it and shimmering
 * while it lasts) and the blizzard (the storm bursting from his cane and sweeping the board, every crowd piece but the
 * one still free icing over as it passes; Eric, Oct 12: three turns, thawing). The pieces due to thaw next turn crack
 * and thin to dripping, nearly clear ice; as each later turn begins, a thaw: its banner names the pieces freed, and
 * their ice melts away. His Super Freeze (Nov 18, his second meter, the bar beside his rage meter): while he thinks, the SUPER
 * FREEZE! banner, his charge-up and blast (characters/ginger-super.ts), the ice bolt to the piece, and the block of ice growing
 * square by square over the 3 x 3 round it (characters/effects/ginger-superice.ts), then breaking into each frozen piece's own ice,
 * which lasts through the crowd's turn and melts as his next turn starts. His rules: packages/chess/src/bosses/ginger.ts.
 */

/** A freeze's beats: the banner, then (once it has gone) his cast, the ice bolt to the piece, the ice forming. */
export const FREEZE = { boltAt: 1500, iceAt: 1760 } as const;
/**
 * The blizzard's beats: the banner (gone as the storm comes), then the storm bursts from his cane and sweeps the board,
 * then the God King's line; then (once the last piece has iced over) the pieces due to thaw next turn crack (`crackAt`).
 */
export const BLIZZARD = {
  sweepAt: 1300,
  get sweepMs() {
    return animLength(EFFECTS.blizzardSweep.ch.anims.sweep!);
  },
  lineAt: 2800,
  crackAt: 3050,
} as const;
/**
 * A thaw's beats (each later turn of the blizzard): its banner naming the pieces freed, gone as (`meltAt`) their ice
 * melts away and he has his say; the God King's line (`lineAt`); then the pieces due to thaw next turn crack
 * (`crackAt`).
 */
export const THAW = { meltAt: 1300, lineAt: 1700, crackAt: 1750 } as const;
/** How long the ice takes to melt away (iceOverlay's thaw; it ends empty). */
export const MELT_MS = () => animLength(EFFECTS.iceOverlay.ch.anims.thaw!);

function freezeMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  return (
    <div class="power-moment pm-freeze">
      {banner("FREEZE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen` : undefined, "cold", FREEZE.boltAt)}
      {cast("freeze", FREEZE.boltAt)}
      {moment.square && t >= FREEZE.boltAt && t < FREEZE.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + FREEZE.boltAt} ms={FREEZE.iceAt - FREEZE.boltAt} aim />}
      {moment.square && t >= FREEZE.iceAt - 60 && t < FREEZE.iceAt + 900 && <span class="pw-frost" style={{ ...onSquare(moment.square, orientation), animationDelay: `${FREEZE.iceAt - 60 - t}ms` }} />}
    </div>
  );
}

function blizzardMoment({ boss, moment, t, banner, cast }: MomentProps) {
  // (Its one free piece, at random: named in the banner, since it's no longer always the queen.)
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  return (
    <div class="power-moment pm-blizzard">
      {banner("BLIZZARD!", piece ? `Only your ${PIECE_WORD[piece.type]} on ${moment.square} moves` : undefined, "cold", BLIZZARD.sweepAt)}
      {cast("blizzard", BLIZZARD.sweepAt)}
      {t >= BLIZZARD.sweepAt && t < BLIZZARD.sweepAt + BLIZZARD.sweepMs && (
        <span class="pw-clip">
          <span class="pw-sweep">
            <BossEffect name="blizzardSweep" since={moment.at + BLIZZARD.sweepAt} />
          </span>
        </span>
      )}
    </div>
  );
}

const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const BY_VALUE = ["q", "r", "b", "n", "p", "k"] as const;

/**
 * The thaw's banner line: the pieces it frees, by kind, most valuable first ("Your knight and two pawns are free"); more
 * than three kinds, how many ("Four more of your pieces are free").
 */
export function thawLine(fen: string, squares: readonly string[]): string | undefined {
  const kinds = new Map<string, number>();
  for (const sq of squares) {
    const type = pieceAt(fen, sq)?.type;
    if (type) kinds.set(type, (kinds.get(type) ?? 0) + 1);
  }
  const total = [...kinds.values()].reduce((a, b) => a + b, 0);
  if (!total) return undefined;
  if (kinds.size > 3) return `${(COUNT[total] ?? String(total)).replace(/^./, (c) => c.toUpperCase())} more of your pieces are free`;
  const words = BY_VALUE.filter((k) => kinds.has(k)).map((k) => (kinds.get(k) === 1 ? PIECE_WORD[k]! : `${COUNT[kinds.get(k)!] ?? kinds.get(k)} ${PIECE_WORD[k]}s`));
  const list = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0]!;
  return `Your ${list} ${total === 1 ? "is" : "are"} free`;
}

/** The ice is gone after this thaw: nothing is left to thaw next turn. */
export const thawOver = (boss: Pick<MomentProps["boss"], "powers">): boolean => !boss.powers?.thaw?.length;

function thawMoment({ boss, moment, banner }: MomentProps) {
  const over = thawOver(boss);
  return (
    <div class="power-moment pm-thaw pm-stay">
      {banner(over ? "THAWED!" : "THAWING!", over ? "The ice is gone: every piece moves" : thawLine(boss.board.fen, moment.squares ?? []), "cold thaw", THAW.meltAt)}
    </div>
  );
}

// ---------------- The Super Freeze ----------------

const SF = SUPER_FREEZE_BEATS;

/** The 3 x 3 on the board, three squares a side round its middle square (cut at the board's edge by the clip round it). */
const superBlockStyle = (target: string, orientation: "white" | "black") => onSquare(target, orientation);

function superFreezeMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  const n = moment.squares?.length ?? 0;
  return (
    <div class="power-moment pm-superfreeze">
      {banner("SUPER FREEZE!", piece ? (n > 1 ? `Your ${PIECE_WORD[piece.type]} and ${n - 1} more are frozen` : `Your ${PIECE_WORD[piece.type]} is frozen`) : undefined, "cold", SF.chargeAt)}
      {cast("blast", SF.boltAt)}
      {moment.square && t >= SF.boltAt && t < SF.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + SF.boltAt} ms={SF.flyMs} aim />}
    </div>
  );
}

/** When this device first saw each Super Freeze (a screen drawn again carries on: it doesn't start over). */
const superSeen = new Map<string, number>();
const seenAt = (key: string, now: number): number => {
  let t = superSeen.get(key);
  if (t === undefined) {
    superSeen.set(key, (t = now));
    if (superSeen.size > 20) superSeen.delete(superSeen.keys().next().value!);
  }
  return t;
};

/**
 * His Super Freeze, the moment of his thinking screen (it comes as your move lands, at the start of his turn; his move waits for it:
 * gingerTurnMs), from when this device first saw it (after QUEEN SLAIN! if his queen just fell), with its banner's hold. None for
 * another boss, or once its turn has gone.
 */
export function gingerMoments(boss: BossView, now = Date.now()): Moment[] {
  const p = boss.powers;
  if (boss.id !== "gingerbread" || !p) return [];
  const e = p.events.find((x) => x.kind === "superFreeze" && x.turn === p.turn);
  if (!e) return [];
  const key = `${boss.id}:superFreeze:${e.turn}`;
  const lead = bannerLeadMs("superFreeze");
  // (First seen just as this device rejoined, the round resent with his thinking under way: skipped, its pieces iced at once, as
  // his move would cut it off; Moo's Full Moon's rule, MOO_CINEMATIC.rejoinMs.)
  const seenKey = `${boss.startMove}:${key}`;
  if (!superSeen.has(seenKey) && now - rejoinedAt() < MOO_CINEMATIC.rejoinMs) superSeen.set(seenKey, -Infinity);
  const first = seenAt(seenKey, now);
  if (first === -Infinity) return [];
  const seen = first + superFreezeLeadMs(boss);
  return [{ kind: "superFreeze", key, at: seen + lead, ms: powerFxMs({ kind: "superFreeze" }) - lead, lead, ...(e.square ? { square: e.square } : {}), ...(e.squares ? { squares: [...e.squares] } : {}) }];
}

/** When the Super Freeze's pieces began to melt on this device (as his turn after their turn starts). */
const meltSeen = new Map<string, number>();
// A new battle forgets both (a rematch's Super Freeze on the same turn plays again).
onResetBeats(() => {
  superSeen.clear();
  meltSeen.clear();
});

/**
 * His Super Freeze's meter, beside his rage meter (Eric, Nov 18: "another ult meter bar"): a small ice-blue bar filling a step each
 * crowd move, greyed until it's full (nothing hidden: Eric's rule), lit and glowing when it comes as your move lands; empty and greyed
 * for good once both have come.
 */
function SuperMeter({ boss }: { boss: BossView }) {
  const sf = boss.powers?.superFreeze;
  if (!sf || boss.result) return null;
  const spent = sf.used >= sf.max;
  const full = !spent && sf.meter >= 1;
  const pct = Math.round(Math.max(0, Math.min(1, sf.meter)) * 100);
  const left = sf.max - sf.used;
  return (
    <span
      class={`gs-meter${full ? " full" : " dim"}${spent ? " spent" : ""}`}
      role="meter"
      aria-label={spent ? "Super Freeze: none left this battle" : full ? "Super Freeze ready: it comes as your move lands" : `Super Freeze ${pct}%, ${left} left`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-pct={pct}
      data-used={sf.used}
    >
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

let warmed = false;
/** His ice's frames drawn ahead (its crack, thin ice and thaw too), a slice a frame, as his battle starts. */
export function prewarmGinger(): void {
  if (warmed) return;
  warmed = true;
  prewarm("iceOverlay", Object.entries(EFFECTS.iceOverlay.ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

let superWarmed = false;
/**
 * His Super Freeze drawn ahead, a slice a frame, once his meter is half full: his cast's frames (the charge, the held charge, the
 * blast), then the ice block's (grow, hold, settle). Its first showing is then no stall on a phone (LESSONS: "A stall the first
 * time an effect shows").
 */
export function prewarmSuperIce(): void {
  if (superWarmed) return;
  superWarmed = true;
  prewarmSprite(GINGER_BATTLE, GINGER_BATTLE.anims.superFreeze!.frames, undefined, () =>
    prewarm("superIce", Object.entries(EFFECTS.superIce.ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const))),
  );
}

export const GINGER_UI = {
  id: "gingerbread",
  ultimate: { name: "the Blizzard" },
  moments: {
    freeze: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: freezeMoment },
    // The blizzard's sweep crosses the board left to right; each piece ices over as it passes.
    blizzard: { order: 2, kit: "ultimate", appearAt: (m, square, orientation) => m.at + BLIZZARD.sweepAt + (squareXY(square, orientation).x / 800) * BLIZZARD.sweepMs, view: blizzardMoment },
    // Each later turn of it: the pieces freed thaw (and he grumbles as their ice melts).
    thaw: { order: 2, kit: "ultimateHit", lineAt: THAW.meltAt, view: thawMoment },
    // His Super Freeze, while he thinks (gingerMoments): each frozen piece's own ice shows as the big block breaks into it.
    superFreeze: { order: 0, kit: "superFreeze", appearAt: (m, square) => (m.square && superBox(m.square).includes(square) ? m.at + SF.settleAt : undefined), view: superFreezeMoment },
  },
  // His Super Freeze's meter beside the rage meter (its own bar: greyed until full).
  ultBar: ({ boss }) => {
    if ((boss.powers?.superFreeze?.meter ?? 0) >= 0.5) prewarmSuperIce();
    return <SuperMeter boss={boss} />;
  },
  // Ice over iced pieces (the characters' iceOverlay: it forms, then shimmers while it lasts; due to thaw next turn, it
  // cracks and thins to dripping, nearly clear ice; as it thaws, it melts away): one block the shape of the square,
  // the same on every square whatever the piece, placed on the board's own square (eighths of --board-size).
  board: ({ boss, p, board, orientation, moments, now, appearAt }) => {
    const crowd = (sq: string) => pieceAt(board, sq)?.color === boss.crowdSide;
    const iced = p.iced.filter(crowd);
    const due = new Set(p.thaw ?? []);
    const blizzard = moments.find((m) => m.kind === "blizzard");
    const thaw = moments.find((m) => m.kind === "thaw");
    // When the pieces due to thaw next turn crack on this screen (0: they're simply cracked), and when the freed melt.
    const crackAt = blizzard ? blizzard.at + BLIZZARD.crackAt : thaw ? thaw.at + THAW.crackAt : 0;
    const meltAt = thaw ? thaw.at + THAW.meltAt : 0;
    const melting = (thaw?.squares ?? []).filter((sq) => crowd(sq) && !iced.includes(sq) && now < meltAt + MELT_MS());
    // (Several crack or melt at once: one crackle for them all, the first's.)
    const firstCrack = iced.find((sq) => due.has(sq));
    const fx = EFFECTS.iceOverlay;
    // His Super Freeze: the block growing over the 3 x 3 (the moment's), its pieces' own ice from its settle (no crackle of
    // their own: the block's is theirs); and as his turn after their turn starts, their ice melting.
    const sup = moments.find((m) => m.kind === "superFreeze");
    const supSquares = new Set(sup?.square ? superBox(sup.square) : []);
    const sf = p.superFreeze;
    const hisTurn = sideToMove(board) !== boss.crowdSide;
    const meltKey = sf && sf.at !== null && hisTurn && sf.held.length && p.turn === sf.at + 1 ? `${boss.startMove}:${sf.at}` : "";
    const supMeltAt = meltKey ? (meltSeen.get(meltKey) ?? (meltSeen.set(meltKey, now), now)) : 0;
    if (meltSeen.size > 20) meltSeen.delete(meltSeen.keys().next().value!);
    const supMelting = meltKey ? sf!.held.filter((sq) => crowd(sq) && !iced.includes(sq) && now < supMeltAt + MELT_MS()) : [];
    const block = (sq: string, anim: JSX.Element, state = "") => (
      <span key={`ice-${sq}`} class={`pw-ice${state}`} style={onSquare(sq, orientation)} data-square={sq}>
        {anim}
      </span>
    );
    const supBlock =
      sup?.square && now >= sup.at + SF.iceAt && now < sup.at + SF.total ? (
        <span key="superice" class="pw-clip pw-superclip">
          <span class="pw-superice" style={superBlockStyle(sup.square, orientation)} data-square={sup.square}>
            <SpriteAnim
              ch={EFFECTS.superIce.ch}
              anim={now < sup.at + SF.settleAt ? "grow" : "settle"}
              then={now < sup.at + SF.settleAt ? "hold" : undefined}
              since={now < sup.at + SF.settleAt ? sup.at + SF.iceAt : sup.at + SF.settleAt}
              sounds={EFFECTS.superIce.sounds}
              id={`superice-${sup.key}`}
            />
          </span>
        </span>
      ) : null;
    return {
      over: [
        supBlock,
        ...iced.map((sq) => {
          const t = appearAt(sq);
          if (now < t) return null;
          // (The Super Freeze's pieces: the block's breaking is their freezing.)
          if (sup && supSquares.has(sq)) return block(sq, <SpriteAnim ch={fx.ch} anim={fx.loop!} since={t} id={sq} />);
          if (due.has(sq) && now >= crackAt) return block(sq, <SpriteAnim ch={fx.ch} anim="crack" then="thinning" since={crackAt} sounds={sq === firstCrack ? fx.sounds : {}} id={sq} />, " thawing");
          // (In the blizzard a dozen pieces ice over at once: the sweep's wind is their sound, not a dozen crackles.)
          return block(sq, <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={blizzard ? {} : fx.sounds} id={sq} />);
        }),
        ...supMelting.map((sq) => block(sq, <SpriteAnim ch={fx.ch} anim={fx.end!} since={supMeltAt} sounds={sq === supMelting[0] ? fx.sounds : {}} id={sq} />, " melting")),
        ...melting.map((sq) =>
          block(sq, now < meltAt ? <SpriteAnim ch={fx.ch} anim="thinning" since={0} id={sq} /> : <SpriteAnim ch={fx.ch} anim={fx.end!} since={meltAt} sounds={sq === melting[0] ? fx.sounds : {}} id={sq} />, now < meltAt ? " thawing" : " melting"),
        ),
      ],
    };
  },
} satisfies BossUi;
