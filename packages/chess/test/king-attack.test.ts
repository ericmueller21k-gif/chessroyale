import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import {
  KING_ATTACK,
  KING_ATTACKERS,
  LAST_STAND,
  LAST_STAND_MS,
  MATE_TEST_MOVES,
  MatchRunner,
  bossShowMs,
  bossTurnShowMs,
  crowdMated,
  fenAfter,
  gameEnd,
  hasKingAttack,
  kingAttackHits,
  lastStandAttackHits,
  legalMoves,
  mateAttackDue,
  powerMomentMs,
  sanLineToUci,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

// A boss's attack on a king (Hollow's first; Eric, Oct 10): its beats, where it fits in the God King's Last Stand, how
// long a mate holds the screen for it (solo and the server agree through bossTurnShowMs), and the mate test switch.

describe("the attack's beats (KING_ATTACK)", () => {
  it("drops in, lashes ten times, leaps off: in about 2.5 to 3 s", () => {
    const hits = kingAttackHits();
    expect(hits).toHaveLength(KING_ATTACK.lashes);
    expect(hits[0]).toBe(KING_ATTACK.lashAt);
    expect(KING_ATTACK.lashAt).toBeGreaterThan(KING_ATTACK.landAt);
    hits.forEach((t, i) => i && expect(t - hits[i - 1]!).toBe(KING_ATTACK.lashEveryMs));
    expect(hits.at(-1)! + KING_ATTACK.lashEveryMs).toBeLessThanOrEqual(KING_ATTACK.leaveAt);
    expect(KING_ATTACK.leaveAt).toBeLessThan(KING_ATTACK.ms);
    expect(KING_ATTACK.ms).toBeGreaterThanOrEqual(2500);
    expect(KING_ATTACK.ms).toBeLessThanOrEqual(3000);
  });

  it("fits the Last Stand without making it longer: from the slide back to the stagger", () => {
    expect(LAST_STAND_MS).toBe(LAST_STAND.endMs);
    expect(LAST_STAND.attackAt).toBeGreaterThanOrEqual(LAST_STAND.slideAt);
    expect(LAST_STAND.attackAt).toBeGreaterThan(LAST_STAND.bannerAt + LAST_STAND.bannerMs);
    const hits = lastStandAttackHits();
    expect(hits[0]).toBe(LAST_STAND.attackAt + KING_ATTACK.lashAt);
    expect(hits.at(-1)!).toBeLessThan(LAST_STAND.staggerAt);
    // He leaps off as the God King starts to stagger, gone before he collapses.
    expect(LAST_STAND.attackAt + KING_ATTACK.leaveAt).toBeLessThanOrEqual(LAST_STAND.staggerAt);
    expect(LAST_STAND.attackAt + KING_ATTACK.ms).toBeLessThan(LAST_STAND.collapseAt);
  });

  it("at a mate: the king topples at the last lash, and the result waits for all of it", () => {
    expect(KING_ATTACK.toppleAt).toBeGreaterThanOrEqual(kingAttackHits().at(-1)!);
    expect(KING_ATTACK.toppleAt + KING_ATTACK.toppleMs).toBeLessThanOrEqual(KING_ATTACK.ms);
    expect(KING_ATTACK.mateHoldMs).toBeGreaterThanOrEqual(KING_ATTACK.mateAt + KING_ATTACK.ms + 300);
  });
});

describe("how long the boss's move holds the screen (bossTurnShowMs)", () => {
  const MATED = fenAfter(MATE_TEST_MOVES.concat("d8h4"));
  const notMated = fenAfter(MATE_TEST_MOVES.concat("d8e7"));
  const view = (id: string, fen: string, extra: object = {}) => ({ id, crowdSide: "w" as const, board: { fen }, lastMove: {} as { captured?: string }, ...extra });

  it("reads a mate of the crowd from the board", () => {
    expect(gameEnd(MATED, [])).toBe("checkmate");
    expect(crowdMated(MATED, "w")).toBe(true);
    expect(crowdMated(MATED, "b")).toBe(false);
    expect(crowdMated(notMated, "w")).toBe(false);
  });

  it("holds for the attack at a mate by a boss that has one (Hollow), the same alone or in a raid", () => {
    expect(KING_ATTACKERS).toEqual(["hollow"]);
    expect(hasKingAttack("hollow")).toBe(true);
    expect(mateAttackDue(view("hollow", MATED))).toBe(true);
    expect(bossTurnShowMs(view("hollow", MATED))).toBe(KING_ATTACK.mateHoldMs);
    expect(bossTurnShowMs(view("hollow", MATED), true)).toBe(KING_ATTACK.mateHoldMs);
  });

  it("keeps today's hold for every other boss, and for any move that isn't a mate", () => {
    for (const id of ["gingerbread", "clown", "grex", "bigboy"]) {
      expect(hasKingAttack(id)).toBe(false);
      expect(bossTurnShowMs(view(id, MATED))).toBe(bossShowMs({}));
      expect(bossTurnShowMs(view(id, MATED), true)).toBe(bossShowMs({}, true));
    }
    expect(bossTurnShowMs(view("hollow", notMated))).toBe(bossShowMs({}));
    const events = [{ kind: "dark" as const, turn: 3 }];
    expect(bossTurnShowMs(view("hollow", notMated, { powers: { events } }))).toBe(bossShowMs({}) + powerMomentMs(events));
    expect(bossTurnShowMs(view("hollow", notMated, { lastMove: { captured: "q" } }))).toBe(bossShowMs({ captured: "q" }));
  });
});

describe("the mate test switch (settings.bossMateTest, ?mate=1 in solo)", () => {
  /** An engine that must not be asked: the switch plays the mate itself. */
  const engine: EngineLike = {
    topMoves: async (fen, n) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
    scoreMoves: async (_fen, moves) => moves.map((move) => ({ move, expected: 0.5 })),
    playAtElo: async () => {
      throw new Error("the engine was asked");
    },
  };
  const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
  const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: LINE, namedPlies: LINE.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };
  const raid = (bossId: string, mate = true) =>
    new MatchRunner({
      settings: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1500, bossId, ...(mate ? { bossMateTest: true } : {}) } as Settings,
      rng: mulberry32(3),
      engines: [engine],
      library: [opening],
      entrants: [{ id: "h0", name: "H", isBot: false }],
    });

  it("starts after 1.f3 e5 2.g4 with the crowd White and the boss to move; the boss mates at once", async () => {
    for (const id of ["hollow", "bigboy", "gingerbread"]) {
      const r = raid(id);
      expect(r.boards.get(0)!.history).toEqual(MATE_TEST_MOVES);
      expect(r.boss!.crowdSide).toBe("w");
      expect(r.bossView()!.powers?.claimed).toBeUndefined();
      expect(r.bossToMove()).toBe(true);
      expect(await r.playBoss()).toBe("d8h4");
      const view = r.bossView()!;
      expect(crowdMated(view.board.fen, "w")).toBe(true);
      expect(mateAttackDue(view)).toBe(id === "hollow");
      expect(r.stageComplete() || r.isOver()).toBe(true);
    }
  });

  it("changes nothing without it", () => {
    const r = raid("hollow", false);
    expect(r.boards.get(0)!.history).toEqual([]);
    expect(r.bossToMove()).toBe(false);
  });
});
