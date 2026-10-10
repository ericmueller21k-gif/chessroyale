/**
 * Ginger, the Freeze boss (BOSS_ROSTER "gingerbread"): her rules. Her passive, the freeze, ices one of the crowd's
 * pieces that matters for a couple of turns, every few turns; her ultimate, the blizzard, leaves only the queen free to
 * move for one turn (no queen, or she can't: the king). Numbers: BOSS_POWERS.freeze*. Her art and moments are the
 * app's (characters/gingerbread.ts, the ice and the blizzard in characters/effects/).
 */
import type { BossState } from "@chessroyale/core";
import { legalMoves, pieceAt } from "../rules.ts";
import { VALUE, bossPowers, from, powerRoll, to, turnOf, warnThenUnleash, type BossRules, type Side } from "./base.ts";

/** How long each of her moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const GINGER_FX = { freeze: 2300, blizzard: 3600 } as const;

/**
 * Freeze: the piece to ice, one that matters (the most valuable and mobile of the crowd's pieces: a pick from the
 * top three), never the king, never a piece without a move, and never one whose freeze leaves no other legal move.
 */
export function chooseFreeze(fen: string, crowdSide: Side, seed: number, turn: number, pie?: string | null): { square: string; piece: string } | null {
  const legal = legalMoves(fen).filter((m) => to(m) !== pie);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  const options = [...moves.entries()]
    .map(([square, n]) => ({ square, n, piece: pieceAt(fen, square) }))
    .filter((o) => o.piece && o.piece.color === crowdSide && o.piece.type !== "k" && legal.length - o.n > 0)
    // Pieces before pawns; then the most valuable and mobile. Ties by square, so every device ranks alike.
    .map((o) => ({ ...o, score: (o.piece!.type === "p" ? 0 : 100) + VALUE[o.piece!.type]! * 3 + o.n }))
    .sort((a, b) => b.score - a.score || (a.square < b.square ? -1 : 1));
  if (!options.length) return null;
  const top = options.slice(0, 3);
  const pick = top[Math.floor(powerRoll(seed, "freeze", turn) * top.length)]!;
  return { square: pick.square, piece: pick.piece!.type };
}

/** This turn is the blizzard's. */
export const blizzardNow = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && bossPowers(boss)?.ultimate === "blizzard" && boss.powers.ultAt === turnOf(boss);

/** Ginger: a frozen piece every few turns (the freeze), and for one turn only the queen moves (the blizzard). */
export const GINGER: BossRules = {
  id: "gingerbread",
  wearOff(next, t) {
    // The ice after its turns (or once its piece is gone).
    if (next.frozen) {
      const piece = pieceAt(t.fen, next.frozen.square);
      if (next.frozen.until < t.turn || piece?.color !== t.crowd || piece.type !== next.frozen.piece) next.frozen = null;
    }
  },
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) t.events.push({ kind: "blizzard", turn: t.turn });
    return now;
  },
  passive(next, t) {
    if (t.turn < next.nextPassive) return;
    const pick = chooseFreeze(t.fen, t.crowd, t.seed, t.turn, next.pie?.square);
    if (pick) {
      next.frozen = { ...pick, until: t.turn + t.s.freezeTurns - 1 };
      t.events.push({ kind: "freeze", turn: t.turn, square: pick.square });
      const [lo, hi] = t.s.freezeEvery;
      next.nextPassive = t.turn + lo + Math.floor(powerRoll(t.seed, "every", t.turn) * (hi - lo + 1));
    } else next.nextPassive = t.turn + 1;
  },
  // Frozen pieces can't move; in the blizzard only the queen moves (no queen, or she can't: the king).
  crowdFilter(allowed, boss, fen) {
    if (blizzardNow(boss)) {
      const queen = allowed.filter((m) => pieceAt(fen, from(m))?.type === "q");
      const king = allowed.filter((m) => pieceAt(fen, from(m))?.type === "k");
      return queen.length ? queen : king.length ? king : allowed;
    }
    const frozen = boss.powers!.frozen;
    return frozen ? allowed.filter((m) => from(m) !== frozen.square) : allowed;
  },
  powerTurn: (boss) => !!boss.powers!.frozen || blizzardNow(boss),
  // The frozen piece; in the blizzard every crowd piece but the one(s) still free to move.
  iced(boss, fen, crowdAllowed) {
    const p = boss.powers!;
    if (blizzardNow(boss)) {
      const free = new Set((crowdAllowed({ ...boss, barred: undefined }, fen) ?? []).map(from));
      const out: string[] = [];
      for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
        const sq = `${f}${r}`;
        const piece = pieceAt(fen, sq);
        if (piece?.color === boss.crowdSide && !free.has(sq)) out.push(sq);
      }
      return out;
    }
    return p.frozen ? [p.frozen.square] : [];
  },
};
