import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, legalMoves, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

/**
 * Every boss's ultimate, again and again (Eric, Oct 11: a rage meter that fills again after each one). Each boss is
 * played through a long raid with an admin pulling the test trigger whenever it may be pulled: each ultimate comes
 * several times, one never overlaps another (the trigger and the meter wait for its effect to be over), the crowd is
 * never left without a move, and each repeat is a fresh one (its own turn's squares, pieces, test).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const isKnight = (fen: string, m: string) => new Chess(fen).get(m.slice(0, 2) as never)?.type === "n";
const empty = (fen: string, m: string) => !new Chess(fen).get(m.slice(2, 4) as never);
/** A stand-in engine; the boss shuffles a knight onto an empty square when it can (the game lasts), else any move. */
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    // (A position's worth at a budget, as the bounce and Wrangler's searches ask: quick, a hash of the position.)
    topMovesAt: async (fen) => [{ move: "0000", expected: 0.3 + 0.4 * hash(fen) }],
    playAtElo: async (fen) => {
      const all = legalMoves(fen).sort();
      return all.find((m) => isKnight(fen, m) && empty(fen, m)) ?? all[0]!;
    },
  };
}
const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

/** Each boss's ultimate and the moment that shows it has come. */
const ULTIMATES = { gingerbread: "blizzard", clown: "funhouse", grex: "candle", hollow: "lightsout", bigboy: "bounce", sawyer: "boardsaw", pig: "showdown" } as const;

describe("every boss's ultimate, again and again", () => {
  for (const [id, ult] of Object.entries(ULTIMATES)) {
    it(`${id}: its ${ult} comes again and again, never two at once, never leaving the crowd without a move`, async () => {
      // (Wrangler's showdown searches its line-ups for real, under a second a try: a shorter battle keeps the test quick.)
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: id, lastStandFrom: 999, bossMaxMoves: id === "pig" ? 45 : 90 } as Settings;
      const r = new MatchRunner({ settings, rng: mulberry32(9), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
      // (turn, ultAt) as each crowd turn begins: an ultimate's ultAt only ever follows a turn with none under way.
      const seen: { turn: number; ultAt: number | undefined }[] = [];
      const tests: { at: number; seed?: number }[] = [];
      // The turn each ultimate came on, as the count goes up.
      const came: number[] = [];
      const look = () => {
        const p = r.boss!.powers!;
        if (seen.at(-1)?.turn !== p.turn) seen.push({ turn: p.turn, ultAt: p.ultAt });
        if ((p.ults ?? 0) > came.length) came.push(p.ultAt!);
      };
      look();
      for (let i = 0; i < 400 && !r.stageComplete(); i++) {
        // An admin pulls the trigger whenever it may be: never while one is under way.
        const underWay = r.boss!.powers!.ultAt !== undefined;
        const pulled = r.triggerUltimate();
        if (underWay) expect(pulled).toBe(false);
        if (r.bossToMove()) {
          if (r.lightsOutDue()) {
            const test = r.startLightsOut();
            tests.push({ at: test.at, seed: test.seed });
            r.finishLightsOut({});
          }
          if (r.bounceDue()) await r.playBounce();
          look();
          await r.playBoss();
          look();
          continue;
        }
        if (r.extraMoveDue()) {
          await r.playExtraMove();
          continue;
        }
        if (r.funhouseDue()) {
          await r.playFunhouse();
          continue;
        }
        r.deal();
        const fen = r.boards.get(0)!.fen;
        const allowed = r.crowdAllowed() ?? legalMoves(fen);
        expect(allowed.length).toBeGreaterThan(0);
        // The crowd shuffles a knight too when it may (the game lasts), else the first allowed move.
        const move = [...allowed].sort().find((m) => isKnight(fen, m) && empty(fen, m)) ?? [...allowed].sort()[0]!;
        await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
      }
      const p = r.boss!.powers!;
      expect(p.ults ?? 0).toBeGreaterThanOrEqual(3);
      // Never two at once: a new ultimate's turn only after a turn with none under way.
      for (let k = 1; k < seen.length; k++) {
        const [a, b] = [seen[k - 1]!, seen[k]!];
        if (b.ultAt !== undefined && a.ultAt !== undefined) expect(b.ultAt).toBe(a.ultAt);
      }
      // Each repeat is fresh: Hollow's later tests each have a seed of their own; the others' ultimates came on
      // distinct turns.
      if (id === "hollow") {
        expect(tests.length).toBe(p.ults);
        expect(tests[0]!.seed).toBeUndefined();
        expect(new Set(tests.slice(1).map((t) => t.seed)).size).toBe(tests.length - 1);
      }
      expect(came.length).toBe(p.ults);
      expect(new Set(came).size).toBe(came.length);
    }, 60_000);
  }
});
