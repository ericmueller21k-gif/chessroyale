import type { JSX } from "preact";
import { pieceAt } from "@chessroyale/chess";
import { EFFECTS, animLength } from "../characters/power-art.ts";
import { BossEffect, SpriteAnim, prewarm } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, PIECE_WORD, onSquare, type BossUi, type MomentProps } from "./PowerParts.tsx";

/**
 * Ginger's powers on screen: the freeze (her cast, the ice bolt to the piece, the ice forming on it and shimmering
 * while it lasts) and the blizzard (the storm bursting from her cane and sweeping the board, every crowd piece but the
 * one still free icing over as it passes; Eric, Oct 12: three turns, thawing). The pieces due to thaw next turn crack
 * and thin to dripping, nearly clear ice; as each later turn begins, a thaw: its banner names the pieces freed, and
 * their ice melts away. Her rules: packages/chess/src/bosses/ginger.ts.
 */

/** A freeze's beats: the banner, then (once it has gone) his cast, the ice bolt to the piece, the ice forming. */
export const FREEZE = { boltAt: 1500, iceAt: 1760 } as const;
/**
 * The blizzard's beats: the banner (gone as the storm comes), then the storm bursts from his cane and sweeps the board,
 * then the God King's line; then (once the last piece has iced over) the pieces due to thaw next turn crack (`crackAt`).
 */
export const BLIZZARD = { sweepAt: 1300, sweepMs: animLength(EFFECTS.blizzardSweep.ch.anims.sweep!), lineAt: 2800, crackAt: 3050 } as const;
/**
 * A thaw's beats (each later turn of the blizzard): its banner naming the pieces freed, gone as (`meltAt`) their ice
 * melts away and she has her say; the God King's line (`lineAt`); then the pieces due to thaw next turn crack
 * (`crackAt`).
 */
export const THAW = { meltAt: 1300, lineAt: 1700, crackAt: 1750 } as const;
/** How long the ice takes to melt away (iceOverlay's thaw; it ends empty). */
export const MELT_MS = animLength(EFFECTS.iceOverlay.ch.anims.thaw!);

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

let warmed = false;
/** Her ice's frames drawn ahead (its crack, thin ice and thaw too), a slice a frame, as her battle starts. */
export function prewarmGinger(): void {
  if (warmed) return;
  warmed = true;
  prewarm("iceOverlay", Object.entries(EFFECTS.iceOverlay.ch.anims).flatMap(([a, an]) => an.frames.map((_, i) => [a, i] as const)));
}

export const GINGER_UI = {
  id: "gingerbread",
  ultimate: { name: "the Blizzard" },
  moments: {
    freeze: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: freezeMoment },
    // The blizzard's sweep crosses the board left to right; each piece ices over as it passes.
    blizzard: { order: 2, kit: "ultimate", appearAt: (m, square, orientation) => m.at + BLIZZARD.sweepAt + (squareXY(square, orientation).x / 800) * BLIZZARD.sweepMs, view: blizzardMoment },
    // Each later turn of it: the pieces freed thaw (and she grumbles as their ice melts).
    thaw: { order: 2, kit: "ultimateHit", lineAt: THAW.meltAt, view: thawMoment },
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
    const melting = (thaw?.squares ?? []).filter((sq) => crowd(sq) && !iced.includes(sq) && now < meltAt + MELT_MS);
    // (Several crack or melt at once: one crackle for them all, the first's.)
    const firstCrack = iced.find((sq) => due.has(sq));
    const fx = EFFECTS.iceOverlay;
    const block = (sq: string, anim: JSX.Element, state = "") => (
      <span key={`ice-${sq}`} class={`pw-ice${state}`} style={onSquare(sq, orientation)} data-square={sq}>
        {anim}
      </span>
    );
    return {
      over: [
        ...iced.map((sq) => {
          const t = appearAt(sq);
          if (now < t) return null;
          if (due.has(sq) && now >= crackAt) return block(sq, <SpriteAnim ch={fx.ch} anim="crack" then="thinning" since={crackAt} sounds={sq === firstCrack ? fx.sounds : {}} id={sq} />, " thawing");
          // (In the blizzard a dozen pieces ice over at once: the sweep's wind is their sound, not a dozen crackles.)
          return block(sq, <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={blizzard ? {} : fx.sounds} id={sq} />);
        }),
        ...melting.map((sq) =>
          block(sq, now < meltAt ? <SpriteAnim ch={fx.ch} anim="thinning" since={0} id={sq} /> : <SpriteAnim ch={fx.ch} anim={fx.end!} since={meltAt} sounds={sq === melting[0] ? fx.sounds : {}} id={sq} />, now < meltAt ? " thawing" : " melting"),
        ),
      ],
    };
  },
} satisfies BossUi;
