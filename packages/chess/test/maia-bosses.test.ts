import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { BOSS_BRAIN, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, legalMoves, pullOptions, sanLineToUci, type BrainNote, type EngineLike, type HumanAnswer, type HumanEngineLike, type Opening } from "../src/index.ts";

/**
 * Every boss on the Maia path (DECISIONS.md, "Every boss on Maia", Oct 12): each playable boss is played through a long
 * Boss alone battle with every power (an admin pulling the test trigger whenever it may be pulled) with Maia as its
 * brain. Maia here is a stand-in that names a move a power forbids first whenever there is one (the real box is asked
 * for the allowed moves only): the boss never plays it. Its normal moves are Maia's; the King's strike, Boingo's
 * funhouse move for the crowd, Hollow's extra move, Big Boy's bounce and Wrangler's long pull (his drag and showdown
 * aren't moves) keep their own engine picks (Maia isn't asked).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const isKnight = (fen: string, m: string) => new Chess(fen).get(m.slice(0, 2) as never)?.type === "n";
const empty = (fen: string, m: string) => !new Chess(fen).get(m.slice(2, 4) as never);

/** A stand-in Stockfish (as rage.test.ts's): scores from a hash, its limited-strength move a knight's shuffle. */
function fakeEngine(): EngineLike & { elo: number } {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  const e = {
    elo: 0,
    topMoves: async (fen: string, n: number) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen: string, moves: readonly string[]) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen: string) => {
      e.elo++;
      const all = legalMoves(fen).sort();
      return all.find((m) => isKnight(fen, m) && empty(fen, m)) ?? all[0]!;
    },
  };
  return e;
}

/**
 * A stand-in Maia: ready at once; it names a forbidden move first whenever a power forbids one (ignoring the
 * searchmoves it was sent), then a few allowed ones, and draws the forbidden one. Every ask is kept.
 */
function adversarialMaia(): HumanEngineLike & { asks: { fen: string; rating: number; allowed: readonly string[] | null }[] } {
  const asks: { fen: string; rating: number; allowed: readonly string[] | null }[] = [];
  return {
    asks,
    ready: () => true,
    candidates: async (fen, rating, allowed): Promise<HumanAnswer> => {
      asks.push({ fen, rating, allowed });
      const legal = legalMoves(fen).sort((a, b) => hash(fen + a) - hash(fen + b));
      const forbidden = allowed ? legal.filter((m) => !allowed.includes(m)) : [];
      const ok = allowed ? legal.filter((m) => allowed.includes(m)) : legal;
      const moves = [...forbidden.slice(0, 2), ...ok.slice(0, 3)].map((move, k) => ({ move, p: 0.5 / (k + 1) }));
      return { best: moves[0]?.move ?? null, moves, ms: 5 };
    },
  };
}

const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });
const PLAYABLE = BOSS_ROSTER.filter(isPlayable).map((b) => b.id);

describe("every boss on the Maia path", () => {
  it("the roster's playable bosses are the six this test was written for (a new one is covered by the loop)", () => {
    expect(PLAYABLE).toEqual(expect.arrayContaining(["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer", "pig"]));
  });

  for (const id of PLAYABLE) {
    it(`${id}: Maia plays its normal moves within every power's limits; its special moves keep their own picks`, async () => {
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1800, bossId: id, lastStandFrom: 999, bossMaxMoves: 60 } as Settings;
      const engine = fakeEngine();
      const r = new MatchRunner({ settings, rng: mulberry32(11), engines: [engine], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
      expect(r.boss!.id).toBe(id);
      // The game's own rule for an admin's battle: Maia, no guard, at the boss's strength's rating (no crowd margin alone).
      const plan = r.bossBrainPlan("", true)!;
      expect(plan).toEqual({ brain: "maia-raw", rating: expect.any(Number), stockfishShare: 0 });
      const maia = adversarialMaia();
      const notes: BrainNote[] = [];
      r.humanBrain = { brain: plan.brain, rating: plan.rating!, engine: maia };
      const played = { maia: 0, limited: 0, special: 0, strike: 0 };
      const asksDuring = async (f: () => Promise<unknown>) => {
        const before = maia.asks.length;
        await f();
        return maia.asks.length - before;
      };
      let struck = false;
      for (let i = 0; i < 400 && !r.stageComplete(); i++) {
        // (Wrangler's showdown searches its line-ups for real, a second or so each try: his trigger once, mid-battle.)
        if (id !== "pig" || r.boss!.crowdMoves === 6) r.triggerUltimate();
        if (r.bossToMove()) {
          if (r.lightsOutDue()) {
            r.startLightsOut();
            r.finishLightsOut({});
          }
          if (r.bounceDue()) {
            expect(await asksDuring(() => r.playBounce())).toBe(0);
            played.special++;
          }
          const fen = r.boards.get(0)!.fen;
          const allowed = r.bossAllowed();
          const staggered = !!r.boss!.staggerNext;
          const asked = maia.asks.length;
          const move = await r.playBoss();
          // Wrangler's long pull: his engine's own pick (three squares: not a chess move), Maia not asked.
          if (id === "pig" && pullOptions(fen).includes(move)) {
            expect(maia.asks.length).toBe(asked);
            played.special++;
            continue;
          }
          const note = r.brainNote!;
          notes.push(note);
          // Never a move a power forbids, though Maia named one first.
          expect(allowed ?? legalMoves(fen)).toContain(move);
          if (staggered) {
            // The King's strike: Stockfish's own step back; Maia wasn't asked.
            expect(note.why).toBe("strike");
            played.strike++;
          } else {
            expect(note.by).toBe("maia");
            expect(maia.asks.at(-1)!.fen).toBe(fen);
            // (Maia was sent exactly the moves the powers leave the boss.)
            expect(maia.asks.at(-1)!.allowed).toEqual(allowed);
            played.maia++;
            if (allowed && allowed.length < legalMoves(fen).length) played.limited++;
          }
          continue;
        }
        if (r.extraMoveDue()) {
          expect(await asksDuring(() => r.playExtraMove())).toBe(0);
          played.special++;
          continue;
        }
        if (r.funhouseDue()) {
          expect(await asksDuring(() => r.playFunhouse())).toBe(0);
          played.special++;
          continue;
        }
        r.deal();
        // (Once, mid-battle: the God King's strike.)
        if (!struck && r.boss!.crowdMoves === 6) struck = r.callStrike("h0").struck;
        const fen = r.boards.get(0)!.fen;
        const allowed = r.crowdAllowed() ?? legalMoves(fen);
        const move = [...allowed].sort().find((m) => isKnight(fen, m) && empty(fen, m)) ?? [...allowed].sort()[0]!;
        await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
      }
      expect(played.maia).toBeGreaterThan(20);
      expect(played.strike).toBe(1);
      // Today's Stockfish move (its limited-strength search) was never needed: Maia always had an allowed move.
      expect(engine.elo).toBe(0);
      // Each boss's own special moment came and kept its own pick.
      if (id === "clown" || id === "hollow" || id === "bigboy") expect(played.special).toBeGreaterThan(0);
      // Powers that limit the boss's moves did, and Maia stayed within them.
      if (id === "clown" || id === "bigboy" || id === "sawyer") expect(played.limited).toBeGreaterThan(0);
      // Sawyer's first move is a pawn's: Maia was asked for pawn moves only.
      if (id === "sawyer") {
        const first = maia.asks[0]!;
        expect(first.allowed!.every((m) => new Chess(first.fen).get(m.slice(0, 2) as never)?.type === "p")).toBe(true);
      }
    }, 60_000);
  }
});

describe("the bridge band and the top, in a battle", () => {
  const battle = (elo: number, crowd = false, engine = fakeEngine()) => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: elo, bossId: "gingerbread", lastStandFrom: 999 } as Settings;
    const entrants = [{ id: "h0", name: "H", isBot: false }, ...(crowd ? [{ id: "h1", name: "I", isBot: false }] : [])];
    return new MatchRunner({ settings, rng: mulberry32(3), engines: [engine], library: [opening(RUY)], entrants });
  };

  it("below the band: Maia, no guard; in it the light, then the strict guard (by the level) with a growing share of Stockfish (by the strength); Stockfish from its top", () => {
    const { bridgeFrom: from, bridgeStrictFrom: strict, bridgeShareFrom: shareFrom, stockfishFrom: top, crowdMargin: margin } = BOSS_BRAIN;
    // (Ginger's offset is −100: her strength is the tier less 100. Alone, the level is the strength.)
    expect(battle(from - 50).bossBrainPlan("", true)).toMatchObject({ brain: "maia-raw", stockfishShare: 0 });
    expect(battle(from + 100).bossBrainPlan("", true)).toMatchObject({ brain: "maia-light" });
    expect(battle(Math.min(shareFrom, from) + 100).bossBrainPlan("", true)!.stockfishShare).toBe(0);
    // (A crowd: the level is the strength plus the margin, so it meets the strict guard at a lower strength.)
    const crowdStrict = battle(strict - margin + 100, true).bossBrainPlan("", true)!;
    expect(crowdStrict.brain).toBe(strict - margin < top ? "maia-strict" : "stockfish");
    expect(battle(top - 50).bossBrainPlan("", true)!.stockfishShare).toBeGreaterThan(0);
    expect(battle(top + 100).bossBrainPlan("", true)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
    // A player while it's off for them: Stockfish everywhere.
    expect(battle(1600).bossBrainPlan("", false)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
  });

  it("a crowd (more than one picking the moves) meets Maia its margin higher than one player does", () => {
    const alone = battle(1800).bossBrainPlan("", true)!.rating!;
    const crowd = battle(1800, true).bossBrainPlan("", true)!.rating!;
    expect(crowd).toBeGreaterThanOrEqual(alone);
    if (BOSS_BRAIN.crowdMargin > 0) expect(crowd).toBeGreaterThan(alone);
  });

  it("the bridge's share of moves is today's Stockfish move: Maia isn't asked for those", async () => {
    const engine = fakeEngine();
    const r = battle(1800, false, engine);
    const maia = adversarialMaia();
    r.humanBrain = { brain: "maia-strict", rating: 2600, stockfishShare: 1, engine: maia };
    // (The crowd is White: its move first.)
    r.deal();
    await r.score(new Map([["h0", { move: "c2c3", thinkMs: 1000 }]]));
    await r.playBoss();
    expect(maia.asks).toEqual([]);
    expect(r.brainNote).toMatchObject({ by: "stockfish", why: "share", share: 1 });
    expect(engine.elo).toBe(1);
  });
});
