import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { legalMoves, phase2Numbers, type MoveScore } from "@chessroyale/chess";
import { PHASE_CHANGE, Phase2Game, Talk, phase2Follows, phase2Mates, talkStage } from "../src/recluse-phase2.ts";
import { ON_BOARD_ANIMS, RECLUSE, RECLUSE_BUST } from "../src/characters/recluse.ts";
import { CHATTER, LOW, Voice } from "../src/speech.tsx";
import { KING_VS_RECLUSE, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { animLength } from "../src/characters/power-art.ts";

// The Hidden Boss's phase 2 on this device (recluse-phase2.ts): the phase change's beats, and the four boards driven
// with pretend engines and a pretend clock. Its rules: packages/chess/test/recluse-phase2.test.ts.

describe("when phase 2 follows, and who plays it beside you", () => {
  const won = { bossId: "recluse", result: "crowd" };
  it("after phase 1 won against him: alone (Boss alone) and in a solo Crowd's boss final (Oct 14); never a Solo raid, another boss, or a loss", () => {
    expect(phase2Follows({ ...won, raid: true, raidBots: false, crowdFinal: false })).toBe(true);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: true })).toBe(true);
    expect(phase2Follows({ ...won, raid: true, raidBots: true, crowdFinal: false })).toBe(false);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: false })).toBe(false);
    for (const result of ["boss", "draw", null]) expect(phase2Follows({ ...won, result, raid: false, raidBots: false, crowdFinal: true })).toBe(false);
    expect(phase2Follows({ ...won, bossId: "clown", raid: false, raidBots: false, crowdFinal: true })).toBe(false);
  });

  it("the other boards: the finalists who fought beside you, then fresh bots for any left (Boss alone: all fresh), one a board", () => {
    const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Fresh ${i}` }));
    const boards = RECLUSE_PHASE2.boards;
    const finalists = [{ id: "bot7", name: "Ann" }, { id: "bot0", name: "Bo" }, { id: "bot3", name: "Cy" }];
    expect(phase2Mates(finalists, boards, fresh)).toEqual(finalists);
    expect(phase2Mates([], boards, fresh)).toEqual(fresh(boards - 1));
    expect(phase2Mates([...finalists, { id: "bot9", name: "Di" }], boards, fresh)).toEqual(finalists);
    // One short (somebody struck): a fresh bot, under an id of its own.
    const two = phase2Mates(finalists.slice(0, 2), boards, fresh);
    expect(two).toHaveLength(boards - 1);
    expect(new Set(two.map((b) => b.id)).size).toBe(boards - 1);
    expect(two.slice(0, 2)).toEqual(finalists.slice(0, 2));
  });
});

describe("the phase change", () => {
  it("is about 10 to 12 s after a short fall, its beats in order: rage, leap, the book thrown down, the chant, the split, the book back, the leap back", () => {
    const C = PHASE_CHANGE;
    expect(C.fallMs).toBeGreaterThanOrEqual(1500);
    expect(C.fallMs).toBeLessThanOrEqual(2000);
    expect(C.total).toBeGreaterThanOrEqual(10_000);
    expect(C.total).toBeLessThanOrEqual(12_000);
    const order = [0, C.leapAt, C.upAt, C.landAt, C.dropAt, C.thudAt, C.chantAt, C.crackAt, C.partAt, C.growAt, C.growAt + C.growMs, C.pickupAt, C.catchAt, C.backAt, C.homeAt, C.bannerAt, C.total];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // He gets up where he stands, then the board takes him over; the light is up through the cracks and the split.
    expect(C.leapAt).toBe(animLength(RECLUSE.anims.rage!));
    expect(C.chantAt + C.lightMs).toBeLessThanOrEqual(C.crackAt);
    // (The pieces fly to their Chess960 squares as the book comes back to him, and land before "PHASE 2".)
    expect(C.shuffleAt).toBeGreaterThanOrEqual(C.pickupAt);
    expect(C.shuffleAt + C.shuffleMs).toBeLessThanOrEqual(C.bannerAt);
    // (Phase 2's frames, all drawn: his idle, his slam and laugh, the placeholder's glow.)
    for (const a of ["idle2", "slam2", "laugh2", "spellbook2", "spellLoop2", "collapseLoop"]) expect(RECLUSE.anims[a], a).toBeDefined();
  });

  it("one book on screen: his own, in his frames; the board draws his whole figure (a phone too), his place only his rage", () => {
    for (const a of ON_BOARD_ANIMS) {
      expect(RECLUSE.anims[a], a).toBeDefined();
      expect(RECLUSE_BUST.anims[a], `${a} (the bust)`).toBeUndefined();
    }
    for (const ch of [RECLUSE, RECLUSE_BUST]) expect(ch.anims.rage!.frames.at(-1)!.layers.some((l) => l.part.startsWith("book:")), ch.id).toBe(true);
    // In every frame of it, the book is drawn once: held, falling, lying open, or flying back up.
    for (const a of ["rage", ...ON_BOARD_ANIMS]) RECLUSE.anims[a]!.frames.forEach((f, i) => expect(f.layers.filter((l) => l.part.startsWith("book:")), `${a} ${i}`).toHaveLength(1));
    // He leaps with no shadow under him, and lands in a cloud of dust.
    const leap = RECLUSE.anims.leap!.frames;
    expect(leap.some((f) => !f.layers.some((l) => l.part === "shadow"))).toBe(true);
    expect(leap.find((f) => f.cue === "land")!.specks?.length).toBeGreaterThan(0);
  });
});

describe("his phase 2 lines", () => {
  it("has a line for each moment, his and the God King's", () => {
    for (const k of ["revive", "phase2", "boardWon", "boardLost", "beaten2", "chant"] as const) expect(RECLUSE_LINES[k].length, k).toBeGreaterThan(0);
    for (const k of ["early", "middle", "late"] as const) expect(RECLUSE_LINES.collusion[k].length, k).toBeGreaterThan(0);
    for (const k of ["phase2", "boardWon", "boardLost", "victory2"] as const) expect(KING_VS_RECLUSE[k].length, k).toBeGreaterThan(0);
  });

  it("names his rivals but never their country or its people (Eric, Oct 14); his own words from the article word for word", () => {
    const all = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === "object" ? Object.values(o).flatMap(all) : []);
    for (const line of all(RECLUSE_LINES)) expect(line, line).not.toMatch(/soviet|russia/i);
    expect(RECLUSE_LINES.chant.some((l) => /Petrosian/.test(l) && /Keres/.test(l) && /Geller/.test(l))).toBe(true);
    // (Verified on the printed pages of his Sports Illustrated article, Aug 20, 1962: never altered.)
    expect(RECLUSE_LINES.chant).toContain("They worked as a team.");
    expect(RECLUSE_LINES.collusion.middle).toEqual(expect.arrayContaining(["They consulted during the games.", "They would openly analyze my game while I was still playing it.", "They agreed ahead of time to draw the games they played against each other."]));
    expect(RECLUSE_LINES.collusion.late).toEqual(expect.arrayContaining(["They worked as a team.", "It made me mad that they thought they could get away with it.", "I will never again play in one of these tournaments."]));
    // (Korchnoi only among the names, never with a word about a game he played.)
    for (const line of all(RECLUSE_LINES).filter((l) => /Korchnoi/.test(l))) expect(line.replace(/[.\s]/g, "")).toMatch(/^(Petrosian|Keres|Geller|Tal|Korchnoi)+$/);
  });
});

describe("his collusion lines in phase 2", () => {
  it("picks the stage by his moves so far: early, middle from talkMiddleFrom, late from talkLateFrom", () => {
    const { talkMiddleFrom: mid, talkLateFrom: late } = RECLUSE_PHASE2;
    expect(talkStage(0)).toBe("early");
    expect(talkStage(mid - 1)).toBe("early");
    expect(talkStage(mid)).toBe("middle");
    expect(talkStage(late - 1)).toBe("middle");
    expect(talkStage(late)).toBe("late");
    expect(talkStage(10_000)).toBe("late");
  });

  it("speaks every talkEvery of his moves, give or take talkJitter, each stage's lines in turn", () => {
    const { talkEvery, talkJitter } = RECLUSE_PHASE2;
    for (const r of [0, 0.5, 0.999]) {
      const talk = new Talk(() => r);
      const at: number[] = [];
      const said: string[] = [];
      for (let n = 1; n <= 200; n++) {
        const line = talk.lineAfter(n, false);
        if (line) at.push(n), said.push(line);
      }
      const gaps = at.slice(1).map((n, i) => n - at[i]!);
      expect(at[0]!).toBeGreaterThanOrEqual(talkEvery - talkJitter);
      for (const g of gaps) expect(g).toBeGreaterThanOrEqual(talkEvery - talkJitter), expect(g).toBeLessThanOrEqual(talkEvery + talkJitter);
      // Each line from its stage's pool, in turn.
      at.forEach((n, i) => expect(RECLUSE_LINES.collusion[talkStage(n)]).toContain(said[i]));
      const pool = RECLUSE_LINES.collusion.early;
      const early = said.filter((_, i) => talkStage(at[i]!) === "early");
      expect(early).toEqual(early.map((_, i) => pool[i % pool.length]));
    }
  });

  it("is the lowest priority: skipped (not queued) while anything is being said; anything he says cuts in on it", () => {
    const talk = new Talk(() => 0.5);
    const due = RECLUSE_PHASE2.talkEvery;
    // A line is up (a slow move's): this one is skipped, and the next comes a few moves later.
    expect(talk.lineAfter(due, true)).toBeNull();
    expect(talk.lineAfter(due + 1, false)).toBeNull();
    expect(talk.lineAfter(due * 2, false)).not.toBeNull();
    // In the voice: chatter is cut by any other line of his (a slow move's is LOW), and never cuts one in turn.
    const voice = new Voice();
    voice.say("Who told you that move?", "talk", CHATTER, 1000);
    voice.say("Still thinking? Move!", "slow", LOW, 1500);
    expect(voice.line(1500)?.text).toBe("Still thinking? Move!");
    voice.say("Who told you that move?", "talk2", CHATTER, 1600);
    expect(voice.line(1700)?.text).toBe("Still thinking? Move!");
    // (Chatter said over chatter waits its turn, as any other line.)
    const v2 = new Voice();
    v2.say("A", "a", CHATTER, 0);
    v2.say("B", "b", CHATTER, 10);
    expect(v2.line(20)?.text).toBe("A");
  });
});

/** Pretend engines: his plays the first legal move (sorted), and counts what it's asked; the bots' the same. */
function engines() {
  const asked: { fen: string; elo: number; nodes?: number; moveMs?: number }[] = [];
  const first = (fen: string) => [...legalMoves(fen)].sort()[0]!;
  const boss = {
    playAtElo: (fen: string, elo: number, nodes?: number, moveMs?: number) => {
      asked.push({ fen, elo, nodes, moveMs });
      return Promise.resolve(first(fen));
    },
  };
  const bots = {
    playAtElo: (fen: string) => Promise.resolve(first(fen)),
    topMoves: (fen: string): Promise<MoveScore[]> => Promise.resolve(legalMoves(fen).includes("h5f7") ? [{ move: "h5f7", expected: 1 }] : [{ move: first(fen), expected: 0.5 }]),
  };
  return { boss, bots, asked };
}

describe("phase 2's four boards on this device", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (over: Partial<ConstructorParameters<typeof Phase2Game>[0]> = {}) => {
    const e = engines();
    const done = vi.fn();
    const results: string[] = [];
    const g = new Phase2Game({
      players: ["you", "b1", "b2", "b3"],
      numbers: phase2Numbers(5),
      human: "you",
      boss: e.boss,
      bots: e.bots,
      rng: () => 0.5,
      onChange: () => undefined,
      onResult: (b) => results.push(`${b.id}:${b.result!.winner}:${b.result!.how}`),
      onDone: done,
      ...over,
    });
    return { g, e, done, results };
  };

  it("the test switch: the bots mate at once, your Qxf7 mates too, and all four won beat him", async () => {
    const { g, done, results } = make({ win: true });
    g.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(g.outcome).toMatchObject({ won: 3, decided: false });
    g.move(0, "h5f7");
    await vi.advanceTimersByTimeAsync(10);
    expect(g.outcome).toMatchObject({ won: 4, beaten: true, decided: true });
    expect(done).toHaveBeenCalledTimes(1);
    expect(results.sort()).toEqual(["0:crowd:mate", "1:crowd:mate", "2:crowd:mate", "3:crowd:mate"]);
  });

  it("he answers on every board with Stockfish at his strength and budget only; your move is yours alone", async () => {
    const moved: number[] = [];
    const { g, e } = make({ onBossMove: (n) => moved.push(n) });
    g.start();
    // (Your move on a bot's board, or an illegal one, does nothing.)
    g.move(1, legalMoves(g.board(1)!.board.fen)[0]!);
    expect(g.board(1)!.board.history).toHaveLength(0);
    g.move(0, [...legalMoves(g.board(0)!.board.fen)].sort()[0]!);
    await vi.advanceTimersByTimeAsync(3000);
    expect(g.board(0)!.board.history.length).toBe(2);
    for (const b of g.state.boards) expect(b.board.history.length).toBeGreaterThanOrEqual(2);
    expect(e.asked.length).toBeGreaterThanOrEqual(4);
    for (const a of e.asked) expect(a).toMatchObject({ elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    // (Each of his moves counted, on all the boards together: what his collusion lines go by.)
    const his = g.state.boards.reduce((n, b) => n + Math.floor(b.board.history.length / 2), 0);
    expect(moved).toEqual(Array.from({ length: his }, (_, i) => i + 1));
    expect(g.bossMoves).toBe(his);
    g.stop();
  });

  it("your clock runs out: your board is lost on time; the others played on", async () => {
    const { g, results } = make();
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.bankSeconds * 1000 + 400);
    expect(results).toContain("0:boss:time");
    expect(g.board(0)!.result).toEqual({ winner: "boss", how: "time" });
    // (The bots moved all along, each on its own clock: their boards went on after yours stopped.)
    expect(g.state.boards.slice(1).every((b) => b.board.history.length > 2)).toBe(true);
    g.stop();
  });

  it("his ultimate (the admins' trigger): from then on, out of your few seconds, a random legal move is played for you (no loss)", async () => {
    const ult = vi.fn();
    const { g } = make({ onUlt: ult });
    g.start();
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.ultAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.ultMoveSeconds * 1000 + 300);
    expect(g.board(0)!.result).toBeNull();
    expect(g.board(0)!.board.history.length).toBeGreaterThanOrEqual(1);
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    g.stop();
  });

  it("slow moves count for the team, yours and the bots' (now and then a bot thinks past slowMoveSeconds), each on its board; the 10th brings his ultimate", async () => {
    const slow: [number, boolean][] = [];
    const ult = vi.fn();
    // (rng 0.05: every bot's move is a slow one.)
    const { g } = make({ onSlow: (id, u) => slow.push([id, u]), onUlt: ult, rng: () => 0.05 });
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.botSlowMs[1] + 500);
    expect(g.state.slow).toBeGreaterThanOrEqual(3);
    expect(ult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4 * RECLUSE_PHASE2.botSlowMs[1]);
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt);
    // One call a slow move, naming its board (the bots' here, never yours: you haven't moved); the last one brought it.
    expect(slow).toHaveLength(RECLUSE_PHASE2.slowMovesForUlt);
    for (const [id] of slow) expect([1, 2, 3]).toContain(id);
    expect(slow.map(([, u]) => u)).toEqual([...Array(RECLUSE_PHASE2.slowMovesForUlt - 1).fill(false), true]);
    g.stop();
  });

  it("resigning your board: lost; the battle ends only once every board is decided", async () => {
    const { g, done } = make();
    g.start();
    g.resign(0);
    expect(g.board(0)!.result?.how).toBe("resign");
    expect(done).not.toHaveBeenCalled();
    g.stop();
  });
});
