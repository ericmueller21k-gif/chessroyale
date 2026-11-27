import { pieceAt } from "@chessroyale/chess";
import { EFFECTS } from "../characters/power-art.ts";
import { BoardEffects, SpriteAnim } from "./BossEffect.tsx";
import { FREEZE } from "./Ginger.tsx";
import { FireBurn } from "./Grex.tsx";
import { Flight, PIECE_WORD, onSquare, type BossUi, type MomentProps } from "./PowerParts.tsx";

/**
 * The Stranger's powers on screen (his rules: packages/chess/src/bosses/stranger.ts). Reused, not new (Eric, Oct 14: simple beats
 * flashy): his Frostfire strike is Ginger's freeze on the piece (the banner, the ice bolt, the ice forming and shimmering through the
 * frozen turn), and its tile is Grex's fire tile, ablaze with its countdown on the flee turn, then Grex's burn as the crowd's move lands.
 * His own cast and swords are the characters lane's (claude/stranger-art); until they land, the shared cast.
 */

function strikeMoment({ boss, moment, t, orientation, banner, cast }: MomentProps) {
  const piece = moment.square ? pieceAt(boss.board.fen, moment.square) : null;
  return (
    <div class="power-moment pm-freeze pm-frostfire">
      {banner("FROSTFIRE!", piece ? `Your ${PIECE_WORD[piece.type]} is frozen, then its square burns` : undefined, "cold", FREEZE.boltAt)}
      {cast("frostfire", FREEZE.boltAt)}
      {moment.square && t >= FREEZE.boltAt && t < FREEZE.iceAt && <Flight name="iceBolt" square={moment.square} orientation={orientation} since={moment.at + FREEZE.boltAt} ms={FREEZE.iceAt - FREEZE.boltAt} aim />}
      {moment.square && t >= FREEZE.iceAt - 60 && t < FREEZE.iceAt + 900 && <span class="pw-frost" style={{ ...onSquare(moment.square, orientation), animationDelay: `${FREEZE.iceAt - 60 - t}ms` }} />}
    </div>
  );
}

function burnMoment({ moment, now, orientation }: MomentProps) {
  if (!moment.square) return null;
  const burnt = [{ square: moment.square, ...(moment.shape && !moment.fizzled?.length ? { piece: moment.shape } : {}), ...(moment.fizzled?.length ? { fizzled: true } : {}) }];
  return (
    <div class="power-moment pm-frostfire-burn">
      <FireBurn burnt={burnt} since={moment.at} now={now} orientation={orientation} />
    </div>
  );
}

export const STRANGER_UI = {
  id: "stranger",
  // (A placeholder until Eric's ultimate lands: the hook never fires, so its warning never shows.)
  ultimate: { name: "his ultimate" },
  moments: {
    frostfire: { order: 0, kit: "power", appearAt: (m, square) => (m.square === square ? m.at + FREEZE.iceAt : undefined), view: strikeMoment },
    frostfireBurn: { order: 0, kit: "power", dock: (m) => (m.fizzled?.length ? "The fire spared the piece there." : m.shape ? "The square burnt." : "The square burnt empty."), view: burnMoment },
  },
  // The frozen piece's ice (the characters' iceOverlay, as Ginger's freeze), and on the flee turn its tile ablaze, its countdown 1.
  board: ({ boss, p, board, orientation, now, appearAt }) => {
    const crowd = (sq: string) => pieceAt(board, sq)?.color === boss.crowdSide;
    const iced = p.iced.filter(crowd);
    const fx = EFFECTS.iceOverlay;
    const st = p.stranger?.strike ?? null;
    const flee = st && p.turn > st.frozenUntil && p.turn <= st.burnAt ? st.square : null;
    return {
      over: (
        <>
          {flee && <BoardEffects items={[{ square: flee, name: "fireTile", anim: "stage3", since: 0 }]} orientation={orientation} class="pw-fire-board" />}
          {flee && (
            <span key={`frostfire-${flee}`} class="pw-fire stage-3 pw-frostfire" style={onSquare(flee, orientation)} data-square={flee} data-stage={3}>
              <b class="pw-count">1</b>
            </span>
          )}
          {iced.map((sq) => {
            const t = appearAt(sq);
            if (now < t) return null;
            return (
              <span key={`ice-${sq}`} class="pw-ice" style={onSquare(sq, orientation)} data-square={sq}>
                <SpriteAnim ch={fx.ch} anim={fx.start!} then={fx.loop} since={t} sounds={fx.sounds} id={sq} />
              </span>
            );
          })}
        </>
      ),
    };
  },
} satisfies BossUi;
