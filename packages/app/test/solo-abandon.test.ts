import { describe, expect, it, vi } from "vitest";
import { SOLO_ABANDON } from "@chessroyale/core";

/**
 * A solo game left after SOLO_ABANDON.minMoves of your own moves counts as a loss (Eric, Nov 22; server/xp.ts): the app tells the
 * server once, at that move (as XP counts your moves: a missed turn isn't one), and notes on the device that a tab is playing it until
 * it ends. Never for a game it isn't asked to watch (a Battle Tower floor, a test game). A new game's start waits for the last result.
 */

const calls: string[] = [];
let resultDone: () => void = () => undefined;
/** The server's answers to the next marks: true answered (a refusal too), false to send again (account.ts markSoloGameReal). */
const markAnswers: (boolean | Promise<boolean>)[] = [];
vi.mock("../src/account.ts", () => ({
  startSoloGame: async () => (calls.push("start"), `game${calls.filter((c) => c === "start").length}`),
  markSoloGameReal: async (game: string, facts: { mode: string }) => (calls.push(`real ${game} ${facts.mode}`), markAnswers.shift() ?? true),
  keepSoloLive: (game: string) => void calls.push(`live ${game}`),
  endSoloLive: (game: string) => void calls.push(`end ${game}`),
  onlineGameXp: async () => null,
  refreshProfile: async () => undefined,
}));
vi.mock("../src/boss-tokens.ts", () => ({ accountReady: async () => true }));
vi.mock("../src/test-switches.ts", () => ({ testParams: () => new URLSearchParams() }));

const { noteFloorGame, noteSoloGame, postingSoloResult, soloGameId } = await import("../src/xp.ts");

/** A solo game as the app's SoloMatch shows it to the watch: its record of your turns, updates, and its phase. */
function game() {
  const listeners = new Set<() => void>();
  const g = {
    moves: [] as { move: string | null; abstained?: boolean }[],
    over: false,
    turn(move: string | null, abstained = false) {
      g.moves = [...g.moves, { move, abstained }];
      for (const f of [...listeners]) f();
    },
    end() {
      g.over = true;
      for (const f of [...listeners]) f();
    },
    watch: {
      get moves() {
        return g.moves;
      },
      subscribe: (f: () => void) => (listeners.add(f), () => void listeners.delete(f)),
      over: () => g.over,
      facts: () => ({ mode: "boss" as const, players: 1, team: null, bossId: "gingerbread", bossElo: 1600 }),
    },
    listeners,
  };
  return g;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("a solo game's SOLO_ABANDON.minMoves-th own move", () => {
  it("tells the server once, at that move (a missed turn isn't one, a turn the God King played for you is), then notes each turn until it ends", async () => {
    calls.length = 0;
    const g = game();
    noteSoloGame(g, g.watch);
    expect(await soloGameId(g)).toBe("game1");
    for (let i = 0; i < SOLO_ABANDON.minMoves - 2; i++) g.turn("e4");
    g.turn(null);
    g.turn(null, true);
    await settle();
    expect(calls).toEqual(["start"]);
    g.turn("d4");
    await settle();
    expect(calls).toEqual(["start", "live game1", "real game1 boss"]);
    g.turn("c4");
    g.turn(null);
    await settle();
    g.end();
    await settle();
    expect(calls).toEqual(["start", "live game1", "real game1 boss", "live game1", "live game1", "end game1"]);
    expect(g.listeners.size).toBe(0);
  });

  it("a mark the server didn't answer (offline, a server error) is sent again at each later turn, one at a time, until it's answered", async () => {
    calls.length = 0;
    markAnswers.push(false, false);
    const g = game();
    noteSoloGame(g, g.watch);
    await soloGameId(g);
    for (let i = 0; i < SOLO_ABANDON.minMoves; i++) g.turn("e4");
    await settle();
    expect(calls.filter((c) => c.startsWith("real"))).toHaveLength(1);
    g.turn("e4");
    await settle();
    expect(calls.filter((c) => c.startsWith("real"))).toHaveLength(2);
    // (Answered at the third: no more.)
    g.turn(null);
    g.turn("e4");
    g.turn("e4");
    await settle();
    expect(calls.filter((c) => c.startsWith("real"))).toEqual(["real game1 boss", "real game1 boss", "real game1 boss"]);
    // (Turns while one is on its way: still one mark at a time; sent again at the turn after it failed.)
    calls.length = 0;
    let fail: (ok: boolean) => void = () => undefined;
    markAnswers.push(new Promise<boolean>((r) => (fail = r)));
    const slow = game();
    noteSoloGame(slow, slow.watch);
    await soloGameId(slow);
    for (let i = 0; i < SOLO_ABANDON.minMoves + 2; i++) slow.turn("e4");
    await settle();
    expect(calls.filter((c) => c.startsWith("real"))).toEqual(["real game1 boss"]);
    fail(false);
    await settle();
    slow.turn("e4");
    await settle();
    expect(calls.filter((c) => c.startsWith("real"))).toEqual(["real game1 boss", "real game1 boss"]);
  });

  it("under minMoves: nothing; a game not watched (a tower floor, a test game) never tells the server", async () => {
    calls.length = 0;
    const short = game();
    noteSoloGame(short, short.watch);
    for (let i = 0; i < SOLO_ABANDON.minMoves - 1; i++) short.turn("e4");
    short.end();
    const test = game();
    noteSoloGame(test);
    const floor = game();
    noteFloorGame(floor, null, () => undefined);
    for (let i = 0; i < SOLO_ABANDON.minMoves + 5; i++) (test.turn("e4"), floor.turn("e4"));
    await settle();
    expect(calls.filter((c) => c !== "start")).toEqual([]);
  });

  it("a new game's start waits for the last result's post (a start records the open game as left if it's real)", async () => {
    calls.length = 0;
    postingSoloResult(new Promise<void>((r) => (resultDone = r)).then(() => void calls.push("result")));
    const next = game();
    noteSoloGame(next, next.watch);
    await settle();
    expect(calls).toEqual([]);
    resultDone();
    await soloGameId(next);
    expect(calls).toEqual(["result", "start"]);
  });
});
