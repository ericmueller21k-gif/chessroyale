import { pieceAt } from "@chessroyale/chess";
import { EFFECTS, animLength } from "../characters/power-art.ts";
import { BossEffect, SpriteAnim } from "./BossEffect.tsx";
import { squareXY } from "./GodKing.tsx";
import { Flight, PIECE_WORD, at, type BossUi, type MomentProps } from "./PowerParts.tsx";

/**
 * Ginger's powers on screen: the freeze (her cast, the ice bolt to the piece, the ice forming on it and shimmering
 * while it lasts) and the blizzard (the storm bursting from her cane and sweeping the board, every crowd piece but the
 * one still free icing over as it passes). Her rules: packages/chess/src/bosses/ginger.ts.
 */

/** A freeze's beats: the banner, then (once it has gone) his cast, the ice bolt to the piece, the ice forming. */
export const FREEZE = { boltAt: 1500, iceAt: 1760 } as const;
/** The blizzard's beats: the banner, then the storm bursts from his cane and sweeps the board, then the God King's line. */
export const BLIZZARD = { sweepAt: 1300, sweepMs: animLength(EFFECTS.blizzardSweep.ch.anims.sweep!), lineAt: 2800 } as const;

function freezeMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  return (
    <div class="power-moment pm-freeze">
      {t < 1500 && banner("FREEZE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen` : undefined, "cold")}
      {cast("freeze", FREEZE.boltAt)}
      {moment.square && t >= FREEZE.boltAt && t < FREEZE.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + FREEZE.boltAt} ms={FREEZE.iceAt - FREEZE.boltAt} aim />}
      {moment.square && t >= FREEZE.iceAt - 60 && t < FREEZE.iceAt + 900 && <span class="pw-frost" style={{ ...at(moment.square, orientation), animationDelay: `${FREEZE.iceAt - 60 - t}ms` }} />}
    </div>
  );
}

function blizzardMoment({ moment, t, banner, cast }: MomentProps) {
  return (
    <div class="power-moment pm-blizzard">
      {t < 1500 && banner("BLIZZARD!", undefined, "cold")}
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

export const GINGER_UI = {
  id: "gingerbread",
  ultimate: { name: "the Blizzard" },
  moments: {
    freeze: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: freezeMoment },
    // The blizzard's sweep crosses the board left to right; each piece ices over as it passes.
    blizzard: { order: 2, kit: "ultimate", appearAt: (m, square, orientation) => m.at + BLIZZARD.sweepAt + (squareXY(square, orientation).x / 800) * BLIZZARD.sweepMs, view: blizzardMoment },
  },
  // Ice over frozen pieces (the characters' iceOverlay: it forms, then shimmers while it lasts).
  board: ({ boss, p, board, orientation, moments, now, appearAt }) => {
    const iced = p.iced.filter((sq) => pieceAt(board, sq)?.color === boss.crowdSide);
    const blizzard = moments.some((m) => m.kind === "blizzard");
    return {
      over: iced.map((sq) => {
        const t = appearAt(sq);
        if (now < t) return null;
        const fx = EFFECTS.iceOverlay;
        return (
          <span key={`ice-${sq}`} class="pw-ice" style={at(sq, orientation)}>
            {/* (In the blizzard a dozen pieces ice over at once: the sweep's wind is their sound, not a dozen crackles.) */}
            <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={blizzard ? {} : fx.sounds} id={sq} />
          </span>
        );
      }),
    };
  },
} satisfies BossUi;
