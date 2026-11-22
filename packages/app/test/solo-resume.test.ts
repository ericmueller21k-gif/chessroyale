import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_ADMIN_FIRST, DEFAULT_SETTINGS, RAID_SETTINGS, SOLO_ABANDON, ownMoves, type Settings } from "@chessroyale/core";
import { dodgeArena, dodgeTimeline, legalMoves, type UciEngine } from "@chessroyale/chess";
import { KEPT_ENDED, account, askForfeitFirst, forfeitKeptSolo, keptSoloOpen, loadAccount, offerKeptSolo, reofferKeptSolo, takeKeptSolo } from "../src/account.ts";
import { HUMAN, loadOpenings, SoloMatch } from "../src/solo.ts";
import { SoloKeep, forfeitAsk, keptMoves, keptSoloFor, loadKeptSolo, type KeptSolo } from "../src/solo-kept.ts";
import { readKept } from "../src/tower.ts";

/**
 * Step 2 of solo games left (Eric, Nov 22: "when you come back to Boss Battle with a game in progress: You have a game in progress,
 * Resume or Forfeit?"; docs/decisions/2026-11-22-solo-resume.md). A solo boss battle is kept on the device after every step, as a
 * Battle Tower floor is (the runner's snapshot, your moves, the time used on your turn), tagged with the account and the server's game;
 * Resume plays it on exactly where it was; Forfeit is a loss past SOLO_ABANDON.minMoves and nothing under it; the load's settle never
 * records a game the device can resume (unless stale); another account's is never offered; another start asks first.
 */

beforeAll(() => loadOpenings());

/** A stand-in engine: its searches answer at once with the first legal moves. */
const engine = {
  topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
  topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen: string) => legalMoves(fen)[0]!,
} as unknown as UciEngine;

/** The same, its answers `slow` ms late (a phone's engine, or the server's recheck): a move scored live waits that long. */
let slow = 0;
const later = <T>(v: T): Promise<T> => (slow ? new Promise((r) => setTimeout(() => r(v), slow)) : Promise.resolve(v));
const slowEngine = {
  topMoves: async (fen: string, n: number) => later(legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 }))),
  scoreMoves: async (_fen: string, moves: string[]) => later(moves.map((move) => ({ move, expected: 0.5 }))),
  topMovesAt: async (fen: string) => later(legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 }))),
  playAtElo: async (fen: string) => later(legalMoves(fen)[0]!),
} as unknown as UciEngine;

const GAME = "0123456789abcdef01";
const FACTS = { mode: "boss" as const, players: 1, team: null, bossId: "hopper", bossElo: 1600 };
/** Boss alone against Chub & Chirp, his Carrot Patch due at once (the test switch's setting), on Boss Battle's clock (10 + 10). */
const ALONE = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "hopper", bossFixedElo: 1600, bossAloneClock: true, bossPowerTest: "carrotpatch" } as Settings;

const page = { visibilityState: "visible" as "visible" | "hidden", listeners: new Map<string, () => void>() };
const setVisible = (v: "visible" | "hidden") => {
  page.visibilityState = v;
  page.listeners.get("visibilitychange")?.();
};
let store = new Map<string, string>();

const step = (ms = 100) => vi.advanceTimersByTimeAsync(ms);
async function until(m: SoloMatch, ok: () => boolean, what: string) {
  for (let i = 0; i < 3000 && !ok(); i++) await step();
  expect(ok(), what).toBe(true);
}
const yourTurn = (m: SoloMatch) => m.phase.kind === "play";
const board = (m: SoloMatch) => m.runner.boards.get(m.runner.state.boards[0]!)!;
const pick = (m: SoloMatch) => {
  const fen = (m.phase as { board: { fen: string } }).board.fen;
  m.submit((m.runner.crowdAllowed() ?? legalMoves(fen))[0]!);
};

/** A solo boss battle as the app starts it (App.tsx keepSolo): kept after every step once the server's ids are in. */
function battle(settings: Settings, bots = false, at = Date.now(), engines = [engine]): SoloMatch {
  const m = new SoloMatch(engines, "Ann", settings, false, bots);
  m.kept = new SoloKeep({ at, bots, settings: () => m.settings, facts: () => FACTS, boss: () => m.runner?.boss?.id ?? null });
  m.kept.ready("u", GAME, "battle1");
  return m;
}
/** The kept game resumed as the app's Resume does (App.tsx resumeKept). */
function resumed(k: KeptSolo, engines = [engine]): SoloMatch {
  const r = new SoloMatch(engines, "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, k.bots);
  r.kept = new SoloKeep({ at: k.at, bots: k.bots, settings: () => r.settings, facts: () => k.facts, boss: () => r.runner?.boss?.id ?? null });
  r.kept.ready(k.user, k.game, k.battle);
  r.resume(k.kept);
  return r;
}
/** What must come back the same: the board, the boss's powers (his carrots among them), the clocks, his count of your moves, your moves. */
const facts = (m: SoloMatch) => ({
  fen: board(m).fen,
  history: board(m).history,
  boss: m.runner.state.boss,
  banks: m.runner.state.players.map((p) => [p.id, p.bankMs]),
  round: m.runner.state.round,
  moves: m.moves,
});

describe("a solo boss battle kept on the device, resumed (step 2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
    store = new Map();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    page.visibilityState = "visible";
    page.listeners.clear();
    slow = 0;
    vi.stubGlobal("document", {
      get visibilityState() {
        return page.visibilityState;
      },
      addEventListener: (t: string, f: () => void) => void page.listeners.set(t, f),
      removeEventListener: (t: string) => void page.listeners.delete(t),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("kept from your first move, with the account, its game and battle; resumed: the same position, powers, carrots, clocks and moves", async () => {
    const m = battle(ALONE);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    // (Nothing kept before your first move.)
    expect(loadKeptSolo()).toBeNull();
    for (let i = 0; i < 4; i++) {
      pick(m);
      await until(m, () => yourTurn(m) && m.moves.length === i + 1, `your turn ${i + 2}`);
    }
    // (His Carrot Patch is on the board: its carrots are part of what comes back.)
    expect(JSON.stringify(m.runner.state.boss?.powers ?? {})).toContain("carrot");
    await step(7_000);
    setVisible("hidden");
    const k = loadKeptSolo()!;
    expect(k).toMatchObject({ v: 1, user: "u", game: GAME, battle: "battle1", bots: false, boss: "hopper", facts: FACTS });
    expect(keptMoves(k)).toBe(4);
    expect(k.kept.turnMs).toBeGreaterThanOrEqual(7_000);
    const before = facts(m);
    const p0 = m.phase as { startsAt: number; deadline: number };
    m.dispose();
    // A reload an hour later: no time passed while away; the same battle, on your turn, the 7 s you'd used given back as used.
    await step(3_600_000);
    setVisible("visible");
    const r = resumed(k);
    await until(r, () => yourTurn(r), "your turn, resumed");
    expect(facts(r)).toEqual(before);
    const p1 = r.phase as { startsAt: number; deadline: number };
    expect(p1.deadline - p1.startsAt).toBe(p0.deadline - p0.startsAt);
    expect(Date.now() - p1.startsAt).toBeGreaterThanOrEqual(7_000);
    expect(Date.now() - p1.startsAt).toBeLessThan(7_200);
    // Played on: kept again, the same game and ids; decided, it's gone.
    pick(r);
    await until(r, () => yourTurn(r) && r.moves.length === 5, "your 6th turn");
    expect(loadKeptSolo()).toMatchObject({ game: GAME, battle: "battle1", at: k.at });
    expect(keptMoves(loadKeptSolo()!)).toBe(5);
    r.resign();
    expect(r.phase.kind).toBe("results");
    expect(loadKeptSolo()).toBeNull();
    r.dispose();
  }, 120_000);

  it("kept with your move in: a reload before his reply never takes it back (his reply is played on the rejoin)", async () => {
    // (Ginger, no power's test switch: his first turn is a move.)
    const m = battle({ ...ALONE, bossId: "gingerbread", bossPowerTest: undefined } as Settings);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    // (The dealt opening's moves come first: Boss Battle replays it.)
    const h0 = board(m).history.length;
    pick(m);
    // (Your move on the board, his reply still being thought of.)
    for (let i = 0; i < 500 && !(m.phase.kind === "boss" && m.phase.thinking); i++) await step(5);
    expect(m.phase.kind === "boss" && m.phase.thinking, "his thinking").toBe(true);
    const k = loadKeptSolo()!;
    expect(k.kept.snapshot.boards[0]!.history).toHaveLength(h0 + 1);
    // (His move may already be in the runner while his thinking still shows, never in what's kept before it's shown.)
    expect(k.kept.snapshot.boards[0]!.history).toEqual(board(m).history.slice(0, h0 + 1));
    m.dispose();
    const r = resumed(k);
    await until(r, () => yourTurn(r), "your turn after his reply, resumed");
    // (His reply played on the rejoin; your move stands.)
    expect(board(r).history).toHaveLength(h0 + 2);
    expect(board(r).history.slice(0, h0 + 1)).toEqual(k.kept.snapshot.boards[0]!.history);
    expect(ownMoves(r.moves)).toBe(1);
    r.dispose();
  }, 120_000);

  // (The review of #885, I2: kept only after the judge's answer, so a reload while your move was scored took it back.)
  it("kept with your move as it's accepted, before it's scored: a reload while the judge thinks plays that move on the rejoin", async () => {
    slow = 0;
    const m = battle({ ...ALONE, bossId: "gingerbread", bossPowerTest: undefined } as Settings, false, Date.now(), [slowEngine]);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    const h1 = board(m).history.length;
    const choices = m.runner.crowdAllowed() ?? legalMoves(board(m).fen);
    // (A move outside the judge's top moves, cached at the turn's start: scored now, for 2 s.)
    slow = 2_000;
    const mine = choices.at(-1)!;
    await step(1_500);
    m.submit(mine);
    await step(300);
    expect(m.phase.kind).toBe("scoring");
    const k = loadKeptSolo()!;
    expect(k.kept.pending).toMatchObject({ move: mine });
    expect(k.kept.pending!.thinkMs).toBeGreaterThanOrEqual(1_500);
    m.dispose();
    const r = resumed(k, [slowEngine]);
    // (Once his brain is back, straight to its scoring, the judge slow again: another move tried meanwhile isn't taken.)
    await until(r, () => r.phase.kind === "scoring", "the kept move scored, resumed");
    expect((r.phase as { move: string | null }).move).toBe(mine);
    r.submit(choices.at(-2)!);
    slow = 0;
    await until(r, () => yourTurn(r) && r.moves.length === 2, "your third turn, resumed");
    expect(r.moves[1]!.move).toBe(mine);
    expect(board(r).history.slice(0, h1 + 1)).toEqual([...board(m).history.slice(0, h1), board(r).history[h1]]);
    expect(board(r).history.length).toBe(h1 + 2);
    // (Kept again with nothing pending once it's scored.)
    expect(loadKeptSolo()!.kept.pending).toBeUndefined();
    r.dispose();
    // A Battle Tower floor's kept game carries it too.
    const floor = readKept(JSON.stringify({ v: 1, fight: "f", floor: 1, bosses: ["hopper"], settings: {}, beaten: [], game: k.kept }));
    expect(floor!.game!.pending).toEqual(k.kept.pending);
  }, 120_000);

  // (The review of #885, I3: Dodge's rounds weren't kept, so a reload replayed it from round 1, the answers known, a hit taken back.)
  it("Chandy's Dodge: each round kept as it closes; resumed, it goes on from the round due, never from round 1 again", async () => {
    // (Chandy is admins-first: met here as an admin's ?boss=chandy&power=dodge meets him.)
    const admins = BOSS_ADMIN_FIRST as string[];
    const at = admins.indexOf("chandy");
    if (at >= 0) admins.splice(at, 1);
    try {
      const m = battle({ ...ALONE, bossId: "chandy", bossPowerTest: "dodge" } as Settings);
      m.start();
      const dodge = (x: SoloMatch) => x.runner?.state.boss?.powers?.chandy?.dodge ?? null;
      for (let i = 0; i < 6000 && !(dodge(m) && dodge(m)!.results.length >= 1); i++) {
        if (yourTurn(m)) pick(m);
        await step();
      }
      const results = dodge(m)!.results;
      expect(results.length, "a Dodge round closed").toBeGreaterThanOrEqual(1);
      const k = loadKeptSolo()!;
      const kept = (k.kept.snapshot.state as { boss?: { powers?: { chandy?: { dodge?: { results: unknown[] } } } } }).boss?.powers?.chandy?.dodge;
      expect(kept?.results).toEqual(results);
      m.dispose();
      const r = resumed(k);
      await until(r, () => r.phase.kind === "boss" && !!(r.phase as { dodge?: unknown }).dodge, "the Dodge, resumed");
      expect(dodge(r)!.results).toEqual(results);
      // (Its screen where it was as that round closed (the time into the Dodge kept with it: D2), not the scope-in: the round due's vote
      // next, in its own time.)
      const d = (r.phase as { dodge: { round: number; at: number } }).dodge;
      expect(d.round).toBe(results.length);
      const closed = dodgeTimeline().rounds[results.length - 1]!.closeAt;
      expect(k.kept.dodgeMs).toBeGreaterThanOrEqual(closed);
      expect(Date.now() - d.at).toBeGreaterThanOrEqual(closed);
      expect(Date.now() - d.at).toBeLessThan(closed + 300);
      await until(r, () => dodge(r)!.results.length > results.length || r.phase.kind === "results", "the next round closed");
      expect(dodge(r)!.results.slice(0, results.length)).toEqual(results);
      r.dispose();
    } finally {
      if (at >= 0) admins.splice(at, 0, "chandy");
    }
  }, 120_000);

  // (The delta review of #885, D2: a round was kept only as it closed, so a reload after its teleports reopened it in full, the final safe
  // square known; every round could be made safe and his ultimate never landed. The director's call: the time into the Dodge is kept as
  // the page goes, and the rejoin carries the round on from there.)
  it("Chandy's Dodge, the page hidden mid-round past its last teleport, your vote in: resumed there, your vote kept, the round closing in its own time", async () => {
    const admins = BOSS_ADMIN_FIRST as string[];
    const at = admins.indexOf("chandy");
    if (at >= 0) admins.splice(at, 1);
    try {
      const m = battle({ ...ALONE, bossId: "chandy", bossPowerTest: "dodge" } as Settings);
      m.start();
      const dodge = (x: SoloMatch) => x.runner?.state.boss?.powers?.chandy?.dodge ?? null;
      const view = (x: SoloMatch) => (x.phase as { dodge?: { at: number; round: number; mine?: string } }).dodge ?? null;
      for (let i = 0; i < 6000 && !(dodge(m) && dodge(m)!.results.length === 1 && view(m)); i++) {
        if (yourTurn(m)) pick(m);
        await step();
      }
      expect(dodge(m)?.results.length, "round 1 closed").toBe(1);
      const r2 = dodgeTimeline().rounds[1]!;
      // (Into round 2 past its last teleport, before it closes: where the safe square ends up is on screen. Your vote in.)
      await step(view(m)!.at + r2.teleports.at(-1)! + 200 - Date.now());
      const square = dodgeArena(dodge(m)!.center).find((sq) => sq !== dodge(m)!.rounds[1]!.safe)!;
      m.dodgeVote(square);
      expect(view(m)!.mine).toBe(square);
      const into = Date.now() - view(m)!.at;
      expect(into).toBeLessThan(r2.voteEnd);
      expect(dodge(m)!.results.length).toBe(1);
      setVisible("hidden");
      const k = loadKeptSolo()!;
      expect(k.kept).toMatchObject({ dodgeMs: into, dodgeVote: square });
      m.dispose();
      setVisible("visible");
      const r = resumed(k);
      await until(r, () => !!view(r), "the Dodge, resumed");
      // (Round 2 on from where it was, its teleports already shown, your vote in it: not reopened.)
      expect(view(r)!.round).toBe(1);
      expect(view(r)!.mine).toBe(square);
      const now = Date.now() - view(r)!.at;
      expect(now).toBeGreaterThanOrEqual(into);
      expect(now).toBeLessThan(into + 300);
      // (It closes when it would have, with your vote: the square you chose.)
      await until(r, () => dodge(r)!.results.length === 2, "round 2 closed, resumed");
      expect(Date.now() - view(r)!.at).toBeLessThan(r2.closeAt + 300);
      expect(dodge(r)!.results[1]).toMatchObject({ placed: square, hit: true });
      expect(dodge(r)!.results[1]!.random).toBeUndefined();
      r.dispose();
    } finally {
      if (at >= 0) admins.splice(at, 0, "chandy");
    }
  }, 120_000);

  // (The review of #885, N3: only the resume's first, synchronous part was inside App.tsx's catch.)
  it("a resume whose first round fails, after his brain's load, rejects: the app's Resume drops it with a plain line, never a stuck screen", async () => {
    const m = battle({ ...ALONE, bossId: "gingerbread", bossPowerTest: undefined } as Settings);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    const k = loadKeptSolo()!;
    m.dispose();
    const r = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, false);
    vi.spyOn(r as unknown as { nextRound: () => void }, "nextRound").mockImplementation(() => {
      throw new Error("no first round");
    });
    let outcome: string | null = null;
    void r.resume(k.kept).then(
      () => void (outcome = "resumed"),
      (e: Error) => void (outcome = e.message),
    );
    for (let i = 0; i < 300 && outcome === null; i++) await step();
    expect(outcome).toBe("no first round");
    r.dispose();
  }, 120_000);

  it("a Solo raid (bots in the crowd): kept with the crowd's move in from its reveal; resumed the same, its bots back in their seats (its Again is a Solo raid's)", async () => {
    const raid = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600 } as Settings;
    const m = battle(raid, true);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    const h0 = board(m).history.length;
    pick(m);
    // (The crowd's move revealed: kept with it in, so a reload on the reveal can't pick again.)
    for (let i = 0; i < 500 && m.phase.kind !== "reveal"; i++) await step(5);
    expect(m.phase.kind).toBe("reveal");
    expect(loadKeptSolo()!.kept.snapshot.boards[0]!.history).toHaveLength(h0 + 1);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your 2nd turn");
    const k = loadKeptSolo()!;
    expect(k.bots).toBe(true);
    const before = facts(m);
    m.dispose();
    const r = resumed(k);
    await until(r, () => yourTurn(r), "your turn, resumed");
    expect({ ...facts(r), banks: [] }).toEqual({ ...before, banks: [] });
    expect(r.runner.state.players.map((p) => p.id)).toEqual(m.runner.state.players.map((p) => p.id));
    expect(r.players.length).toBe(r.runner.state.players.length);
    expect(r.players[0]!.id).toBe(HUMAN);
    r.dispose();
  }, 120_000);

  // (The delta review of #885, D1: only your move was kept as it was accepted; the bots' picks, on screen from your pick on, were drawn
  // again on the rejoin, so a crowd about to play a blunder could be re-rolled by a reload. Both orders: the bots' plan in before your
  // pick, and landing while it's scored. What's checked: the kept game at the moment the picks first show, and the rejoin's votes.)
  for (const late of [false, true]) {
    it(`a Solo raid, a reload while your move is scored: the rejoin plays the bots' picks already on screen (their plan ${late ? "landing while it's scored" : "in before your pick"})`, async () => {
      const m = battle({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600 } as Settings, true, Date.now(), [slowEngine]);
      m.start();
      await until(m, () => yourTurn(m), "your first turn");
      for (let i = 0; i < 100 && Date.now() < (m.phase as { startsAt: number }).startsAt; i++) await step();
      pick(m);
      if (late) slow = 8_000;
      await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
      for (let i = 0; i < 100 && Date.now() < (m.phase as { startsAt: number }).startsAt; i++) await step();
      slow = 8_000;
      // (As the screen hears it: the kept game at the moment the bots' picks first show.)
      let seen: { shown: Map<string, string>; kept: KeptSolo } | null = null;
      m.subscribe(() => {
        const bots = m.phase.kind === "scoring" ? (m.livePicks() ?? []).filter((p) => p.playerId !== HUMAN) : [];
        if (!seen && bots.length > 10) seen = { shown: new Map(bots.map((p) => [p.playerId, p.move])), kept: loadKeptSolo()! };
      });
      pick(m);
      expect(loadKeptSolo()!.kept.pending?.picks === undefined, "kept at your pick without the bots' picks: their plan is still on its way").toBe(late);
      await until(m, () => !!seen, "the bots' picks on screen");
      const { shown, kept: k } = seen!;
      expect(k.kept.pending?.move).toBeTruthy();
      expect(new Map(k.kept.pending?.picks)).toEqual(shown);
      m.dispose();
      const r = resumed(k, [slowEngine]);
      // (The rejoin's round, as it's revealed: every bot's vote as kept, and yours.)
      await until(r, () => r.phase.kind === "reveal", "the kept move's reveal, resumed");
      expect(r.moves).toHaveLength(2);
      const votes = (r.phase as unknown as { mine: { result: { players: { playerId: string; move: string | null }[] } } }).mine.result.players;
      expect(new Map(votes.filter((p) => p.playerId !== HUMAN).map((p) => [p.playerId, p.move]))).toEqual(shown);
      expect(votes.find((p) => p.playerId === HUMAN)?.move).toBe(k.kept.pending!.move);
      r.dispose();
    }, 120_000);
  }

  // (The delta review of #885, D5: the King's call wasn't kept with the move, so the rejoin scored his turn as no move in time, his
  // charge kept and the turn not the one you chose.)
  it("the God King called to play your move, a reload while it's scored: the rejoin plays it as his move, a charge spent, as played through", async () => {
    const m = battle({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600, bossAloneClock: true } as Settings, false, Date.now(), [slowEngine]);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    // (The judge slow, as a phone's engine or the server's recheck can be: the King's move waits on the next turn's search.)
    slow = 2_000;
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    const charges = m.runner.boss!.kingCharges ?? 0;
    expect(charges, "the God King has a charge").toBeGreaterThan(0);
    m.callKing();
    await step(300);
    expect(m.phase.kind).toBe("scoring");
    const k = loadKeptSolo()!;
    expect(k.kept.pending).toEqual({ move: null, thinkMs: expect.any(Number), king: true });
    // (Played through: his move played, a charge spent, your turn abstained.)
    await until(m, () => yourTurn(m) && m.moves.length === 2, "your third turn");
    expect(m.moves[1]!.abstained).toBe(true);
    expect(m.runner.boss!.kingCharges).toBe(charges - 1);
    m.dispose();
    slow = 0;
    const r = resumed(k, [slowEngine]);
    await until(r, () => yourTurn(r) && r.moves.length === 2, "your third turn, resumed");
    expect(r.moves[1]).toMatchObject({ move: m.moves[1]!.move, abstained: true });
    expect(r.runner.boss!.kingCharges).toBe(charges - 1);
    r.dispose();
  }, 120_000);

  // (The delta review of #885, D4: a power-up's hints showed at once, but it was spent only as the move was scored and its use kept
  // nowhere, so a reload gave it back: the engine's top 3 on every move, a reload each.)
  it("a power-up used, its hints seen, then a reload: resumed with it spent and its hints fetched again; spent once as your move is scored", async () => {
    const m = battle({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600, bossAloneClock: true } as Settings);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    // (One power-up, as the God King's Last Stand gives: lastStandPowerUps for each charge he leaves.)
    const st = m.runner.state;
    (m.runner as unknown as { state: typeof st }).state = { ...st, players: st.players.map((p) => (p.id === HUMAN ? { ...p, powerUps: 1 } : p)) };
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    expect(m.powerUpsLeft()).toBe(1);
    m.usePowerUp();
    // (Kept as it's used, before its hints show: a page killed now, with no event, can't give it back either.)
    expect(loadKeptSolo()!.kept.powerUp).toBe(true);
    await step(100);
    expect(m.hint?.length, "the engine's top moves on screen").toBeGreaterThan(0);
    setVisible("hidden");
    const k = loadKeptSolo()!;
    expect(k.kept).toMatchObject({ powerUp: true, turnMs: expect.any(Number) });
    // (A tower floor's kept game carries it too: the same reader, the same rejoin.)
    expect(readKept(JSON.stringify({ v: 1, fight: "f", floor: 1, bosses: ["gingerbread"], settings: {}, beaten: [], game: k.kept }))!.game!.powerUp).toBe(true);
    m.dispose();
    setVisible("visible");
    const r = resumed(k);
    await until(r, () => yourTurn(r) && !!r.hint?.length, "your turn, resumed, its hints back");
    expect((r.phase as { board: { fen: string } }).board.fen).toBe((m.phase as { board: { fen: string } }).board.fen);
    expect(r.powerUpsLeft()).toBe(0);
    // (Reloaded again before your move: still spent.)
    expect(loadKeptSolo()!.kept.powerUp).toBe(true);
    pick(r);
    await until(r, () => yourTurn(r) && r.moves.length === 2, "your third turn, resumed");
    expect(r.runner.state.players.find((p) => p.id === HUMAN)!.powerUps).toBe(0);
    expect(r.powerUpsLeft()).toBe(0);
    expect(loadKeptSolo()!.kept.powerUp).toBeUndefined();
    r.dispose();
  }, 120_000);

  // (The review of #885, I4: only a resign's end (emit) cleared it; a battle played to its end (set) stayed kept, and the next start
  // asked "Forfeit your game in progress?" about the game just finished.)
  for (const bossId of ["gingerbread", "hollow", "hopper"]) {
    it(`played to its end on its own (not a resign), against ${bossId}: the kept game is gone by the result screen`, async () => {
      const m = battle({ ...ALONE, bossId, bossPowerTest: undefined } as Settings);
      m.start();
      for (let i = 0; i < 6000 && m.phase.kind !== "results"; i++) {
        if (yourTurn(m)) pick(m);
        await step();
      }
      expect(m.phase.kind).toBe("results");
      expect(ownMoves(m.moves)).toBeGreaterThan(0);
      const k = loadKeptSolo();
      expect(k ? `kept at move ${keptMoves(k)}, ${m.runner.boss?.result}` : null).toBeNull();
      m.dispose();
    }, 120_000);
  }

  it("a tab whose kept game another tab took over (its Resume), ended or replaced stops at its next keep, never writing it back", async () => {
    const game = (n: number) => ({ snapshot: { state: {}, boards: [], groups: [], usedFamilies: [], retired: [] } as never, moves: Array.from({ length: n }, () => ({ move: "e4" })) as never, intro: true });
    const keeper = () => {
      const lost = vi.fn();
      const keep = new SoloKeep({ at: Date.now(), bots: false, settings: () => ALONE, facts: () => FACTS, boss: () => "hopper", lost });
      keep.ready("u", GAME, null);
      keep.keep(game(1));
      keep.keep(game(2));
      expect(keptMoves(loadKeptSolo()!)).toBe(2);
      return { keep, lost };
    };
    // Taken over: another tab's Resume claimed it.
    let { keep, lost } = keeper();
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, tab: "tab-b" }));
    keep.keep(game(3));
    keep.keepTurn(5_000);
    expect(lost).toHaveBeenCalledTimes(1);
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
    expect(keptMoves(loadKeptSolo()!)).toBe(2);
    // (Its end leaves the other tab's be.)
    keep.end();
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
    // Forfeited in another tab (none kept), or another game kept there since.
    ({ keep, lost } = keeper());
    store.delete("brc.soloKept");
    keep.keep(game(3));
    expect(lost).toHaveBeenCalledTimes(1);
    expect(loadKeptSolo()).toBeNull();
    ({ keep, lost } = keeper());
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, game: "another-game-0123", tab: "tab-b" }));
    keep.keep(game(3));
    expect(lost).toHaveBeenCalledTimes(1);
    // A Resume's claim, then the resumed game's keeper: it holds it, and plays on.
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, game: GAME, tab: "tab-b" }));
    const k = takeKeptSolo(loadKeptSolo()!) as KeptSolo;
    const resumedLost = vi.fn();
    const r = new SoloKeep({ at: k.at, bots: false, settings: () => ALONE, facts: () => FACTS, boss: () => "hopper", lost: resumedLost });
    r.ready(k.user, k.game, k.battle);
    r.keep(game(3));
    expect(resumedLost).not.toHaveBeenCalled();
    expect(keptMoves(loadKeptSolo()!)).toBe(3);
  });

  // (The delta review of #885, DN2: the tab stopped at a keep carried on with the step that found it: the boss's search, his reply's timer.)
  it("a match stopped at a keep (another tab claimed its game while your move was scored) ends there: no search or timer after it", async () => {
    let calls = 0;
    const counted = Object.fromEntries(
      (["topMoves", "scoreMoves", "topMovesAt", "playAtElo"] as const).map((f) => [f, (...a: unknown[]) => (calls++, (slowEngine[f] as (...a: unknown[]) => unknown)(...a))]),
    ) as unknown as UciEngine;
    const m = new SoloMatch([counted], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600, bossAloneClock: true } as Settings, false, false);
    let stoppedAt: number | null = null;
    m.kept = new SoloKeep({ at: Date.now(), bots: false, settings: () => m.settings, facts: () => FACTS, boss: () => m.runner?.boss?.id ?? null, lost: () => ((stoppedAt = calls), m.dispose()) });
    m.kept.ready("u", GAME, "battle1");
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    // (The judge slow from the second turn's search on, and the God King called: his move waits on it, so it's scored a while.)
    slow = 2_000;
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    m.callKing();
    await step(300);
    expect(m.phase.kind).toBe("scoring");
    // (Another tab's Resume claims it now; this tab finds out at its next keep, as the judge answers.)
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, tab: "tab-b" }));
    await step(3_000);
    expect(stoppedAt, "stopped at its next keep").not.toBeNull();
    await step(30_000);
    expect(calls, "nothing searched after the stop").toBe(stoppedAt);
    expect(vi.getTimerCount(), "no timer of the match's left").toBe(0);
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
  }, 120_000);

  it("never the Hidden Boss (his forms and phase 2 aren't in the snapshot): his battle isn't kept", async () => {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "recluse", bossHidden: true, bossFixedElo: 1600 } as Settings, false, true);
    // (As App.tsx's keepSolo: the boss's id only when it isn't him.)
    m.kept = new SoloKeep({ at: Date.now(), bots: true, settings: () => m.settings, facts: () => FACTS, boss: () => (m.runner?.boss?.id === "recluse" ? null : (m.runner?.boss?.id ?? null)) });
    m.kept.ready("u", GAME, null);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your 2nd turn");
    expect(loadKeptSolo()).toBeNull();
    m.dispose();
  }, 120_000);
});

describe("the card's answers and the load (step 2)", () => {
  const PROFILE = { user: { id: "u", name: "P", icon: "", signedIn: true, email: null, google: false }, stats: {}, rating: null, recent: [] };
  const CONFIG = { accounts: true, google: false, email: false };
  const kept = (over: Partial<KeptSolo> = {}, moves = SOLO_ABANDON.minMoves): KeptSolo => ({
    v: 1,
    user: "u",
    game: GAME,
    battle: null,
    at: Date.now() - 60_000,
    settings: ALONE,
    bots: false,
    boss: "hopper",
    facts: FACTS,
    kept: { snapshot: { state: {}, boards: [], groups: [], usedFamilies: [], retired: [] } as never, moves: Array.from({ length: moves }, () => ({ move: "e4" })) as never, intro: true },
    ...over,
  });
  /** The device holding `k`; the server answering `/api/me` with `open` (soloOpen) when it's named, noting every request. */
  function device(k: KeptSolo | null, open = true) {
    store = new Map(k ? [["brc.soloKept", JSON.stringify(k)]] : []);
    vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, v: string) => void store.set(key, v), removeItem: (key: string) => void store.delete(key) });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${path}${init?.body ? ` ${String(init.body)}` : ""}`);
      if (path.startsWith("/api/auth/config")) return Response.json(CONFIG);
      if (path.startsWith("/api/xp/solo/forfeit")) return Response.json({ lost: true });
      return Response.json({ ...PROFILE, ...(path.includes("resume=") ? { soloOpen: open } : {}) });
    });
    return { calls, me: () => calls.find((c) => c.startsWith("GET /api/me"))!, held: () => store.has("brc.soloKept") };
  }
  beforeEach(() => vi.stubEnv("DEV", false));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    offerKeptSolo(null);
  });

  it("the load's settle names the game it can resume, so it's never recorded as left; open, its card is offered (this account's)", async () => {
    const d = device(kept());
    await loadAccount();
    expect(d.me()).toBe(`GET /api/me?settle=1&resume=${GAME}`);
    expect(account().soloKept).toMatchObject({ game: GAME, user: "u" });
    // (The answer's soloOpen never stays on the profile.)
    expect(account().profile).not.toHaveProperty("soloOpen");
  });

  it("not open any more (recorded, finished, or replaced by another device's start): dropped, no card", async () => {
    const d = device(kept(), false);
    await loadAccount();
    expect(account().soloKept).toBeNull();
    expect(d.held()).toBe(false);
  });

  it("stale (SOLO_ABANDON.staleHours since it began): not named, so the settle records it as left; dropped, no card", async () => {
    const d = device(kept({ at: Date.now() - SOLO_ABANDON.staleHours * 3_600_000 }));
    await loadAccount();
    expect(d.me()).toBe("GET /api/me?settle=1");
    expect(account().soloKept).toBeNull();
    expect(d.held()).toBe(false);
  });

  it("another account's kept game is never offered (left on the device), nor asked about at a start, nor offered as Boss Battle opens", async () => {
    const d = device(kept({ user: "someone-else" }));
    await loadAccount();
    expect(account().soloKept).toBeNull();
    expect(d.held()).toBe(true);
    expect(keptSoloFor("u")).toBeNull();
    expect(await askForfeitFirst("u")).toBe(true);
    expect(forfeitAsk()).toBeNull();
    reofferKeptSolo();
    expect(account().soloKept).toBeNull();
  });

  // (The delta review of #885, D3: a live note gated the card and refused Resume and Forfeit, so one tab whose page the phone killed
  // without `pagehide` read its own dead page's note as another tab's: no card, and every solo start's Forfeit refused, for up to
  // SOLO_ABANDON.liveMinutes. A Resume's claim makes a takeover safe; a Forfeit is an explicit loss.)
  it("one tab, its page killed without pagehide (its live note left behind): the card is offered, and the start's Forfeit goes through", async () => {
    const d = device(kept({ tab: "the-page-that-died", at: Date.now() - 10 * 60_000 }, 14));
    // (Its last turn's note, 2 minutes ago: then the phone killed the page in the background, no pagehide.)
    store.set("brc.soloLive", JSON.stringify({ game: GAME, at: Date.now() - 2 * 60_000 }));
    await loadAccount();
    expect(account().soloKept).toMatchObject({ game: GAME });
    offerKeptSolo(null);
    reofferKeptSolo();
    expect(account().soloKept).toMatchObject({ game: GAME });
    // (Play, a Solo raid or a tower floor: the question, and its Forfeit (GameInProgress.tsx onGo) is a loss, then the start goes on.)
    const ask = askForfeitFirst("u");
    const q = forfeitAsk()!;
    expect(q.kept.game).toBe(GAME);
    expect(await forfeitKeptSolo(q.kept)).toBeNull();
    q.answer(true);
    expect(await ask).toBe(true);
    expect(d.held()).toBe(false);
    expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([`POST /api/xp/solo/forfeit ${JSON.stringify({ game: GAME, real: FACTS })}`]);
  });

  it(`Forfeit past ${SOLO_ABANDON.minMoves} moves: a loss now (its facts sent, in case its mark never landed); under it, just dropped, nothing sent`, async () => {
    let d = device(kept());
    await loadAccount();
    await forfeitKeptSolo(account().soloKept!);
    expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([`POST /api/xp/solo/forfeit ${JSON.stringify({ game: GAME, real: FACTS })}`]);
    expect(d.held()).toBe(false);
    expect(account().soloKept).toBeNull();
    d = device(kept({}, SOLO_ABANDON.minMoves - 1));
    await loadAccount();
    expect(account().soloKept).not.toBeNull();
    await forfeitKeptSolo(account().soloKept!);
    expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([]);
    expect(d.held()).toBe(false);
    expect(account().soloKept).toBeNull();
  });

  it("another start with one kept asks first: Cancel starts nothing and keeps it; Forfeit forfeits it, then the start goes on", async () => {
    const d = device(kept());
    await loadAccount();
    const first = askForfeitFirst("u");
    expect(forfeitAsk()?.kept.game).toBe(GAME);
    forfeitAsk()!.answer(false);
    expect(await first).toBe(false);
    expect(d.held()).toBe(true);
    const second = askForfeitFirst("u");
    const ask = forfeitAsk()!;
    // (As the ask's Forfeit button does: the forfeit, then the answer.)
    await forfeitKeptSolo(ask.kept);
    ask.answer(true);
    expect(await second).toBe(true);
    expect(forfeitAsk()).toBeNull();
    expect(d.held()).toBe(false);
    expect(d.calls.some((c) => c.startsWith("POST /api/xp/solo/forfeit"))).toBe(true);
    // (None kept: no question.)
    expect(await askForfeitFirst("u")).toBe(true);
    expect(forfeitAsk()).toBeNull();
  });

  it("its game ended, its result kept unsent (I4): no card at the load, dropped, and that result sent", async () => {
    const d = device(kept());
    store.set("brc.soloUnsent", JSON.stringify({ user: "u", result: { placement: 1, players: 1, mode: "boss", won: true, game: GAME } }));
    await loadAccount();
    expect(account().soloKept).toBeNull();
    expect(d.held()).toBe(false);
    await vi.waitFor(() => expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([`POST /api/results ${JSON.stringify({ placement: 1, players: 1, mode: "boss", won: true, game: GAME, resent: true })}`]));
  });

  it("its game ended after the card was offered (its result kept unsent): Forfeit posts no loss over it, sends the result; no ask, no Resume", async () => {
    const d = device(kept());
    await loadAccount();
    const card = account().soloKept!;
    expect(card.game).toBe(GAME);
    const unsent = JSON.stringify({ user: "u", result: { placement: 1, players: 1, mode: "boss", won: true, game: GAME } });
    store.set("brc.soloUnsent", unsent);
    // (Resume's check: not open, without asking the server.)
    expect(await keptSoloOpen(card)).toBe(false);
    expect(d.held()).toBe(false);
    // (Kept again, as a stale copy might be: neither a start's question nor a Forfeit counts it as a game in progress.)
    store.set("brc.soloKept", JSON.stringify(card));
    store.set("brc.soloUnsent", unsent);
    expect(await askForfeitFirst("u")).toBe(true);
    expect(forfeitAsk()).toBeNull();
    store.set("brc.soloKept", JSON.stringify(card));
    await forfeitKeptSolo(card);
    expect(d.held()).toBe(false);
    expect(d.calls.some((c) => c.startsWith("POST /api/xp/solo/forfeit"))).toBe(false);
    await vi.waitFor(() => expect(d.calls.some((c) => c.startsWith("POST /api/results"))).toBe(true));
  });

  // (The review of #885, I1: the card's Resume and Forfeit acted on the copy taken as the card came, so a second tab's card played the
  // game again from where it stood then, and a loss kept unsent by one tab was replaced by the other tab's result.)
  it("two tabs: Resume plays the kept game as it is at the tap (moves another tab played on stay), and claims it for this tab", async () => {
    device(kept({ tab: "tab-a" }, 12));
    await loadAccount();
    const card = account().soloKept!;
    expect(keptMoves(card)).toBe(12);
    // (Tab A resumed and played on to move 15, then was closed.)
    store.set("brc.soloKept", JSON.stringify(kept({ tab: "tab-a" }, 15)));
    const k = takeKeptSolo(card);
    expect(typeof k).toBe("object");
    expect(keptMoves(k as KeptSolo)).toBe(15);
    // (This tab's now: tab A, still open somewhere, stops at its next keep.)
    const now = loadKeptSolo()!;
    expect(now.tab).toBeDefined();
    expect(now.tab).not.toBe("tab-a");
    expect(keptMoves(now)).toBe(15);
  });

  it("two tabs: a loss one tab kept unsent (offline) is never replaced from the other's card: Resume refused, that result sent", async () => {
    const d = device(kept());
    await loadAccount();
    const card = account().soloKept!;
    // (Tab A lost while offline: its kept game dropped, its result kept unsent with no post on its way.)
    store.delete("brc.soloKept");
    const loss = { placement: 2, players: 1, mode: "boss", won: false, game: GAME };
    store.set("brc.soloUnsent", JSON.stringify({ user: "u", result: loss }));
    expect(takeKeptSolo(card)).toBe(KEPT_ENDED);
    expect(JSON.parse(store.get("brc.soloUnsent")!).result).toMatchObject({ game: GAME, won: false });
    await vi.waitFor(() => expect(d.calls).toContain(`POST /api/results ${JSON.stringify({ ...loss, resent: true })}`));
  });

  it("two tabs: while another tab plays it (its live note), Resume claims it (that tab stops at its next keep) and Forfeit goes through", async () => {
    const d = device(kept({ tab: "tab-a" }));
    await loadAccount();
    const card = account().soloKept!;
    store.set("brc.soloLive", JSON.stringify({ game: GAME, at: Date.now() - 60_000 }));
    const k = takeKeptSolo(card);
    expect(typeof k).toBe("object");
    expect(loadKeptSolo()!.tab).not.toBe("tab-a");
    expect(await forfeitKeptSolo(card)).toBeNull();
    expect(d.held()).toBe(false);
    expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([`POST /api/xp/solo/forfeit ${JSON.stringify({ game: GAME, real: FACTS })}`]);
    // (Gone or replaced since the card came: there's nothing of it to forfeit.)
    d.calls.length = 0;
    store.set("brc.soloKept", JSON.stringify(kept({ game: "another-game-0123" })));
    expect(await forfeitKeptSolo(card)).toBe(KEPT_ENDED);
    expect(takeKeptSolo(card)).toBe(KEPT_ENDED);
    expect(d.calls.filter((c) => c.startsWith("POST"))).toEqual([]);
  });

  it("a card on screen follows another tab (a storage event): its move number as played on there; taken off once it's forfeited there", async () => {
    const heard = new Map<string, (e: { key: string | null }) => void>();
    vi.stubGlobal("addEventListener", (t: string, f: (e: { key: string | null }) => void) => void heard.set(t, f));
    device(kept({}, 12));
    await loadAccount();
    expect(keptMoves(account().soloKept!)).toBe(12);
    store.set("brc.soloKept", JSON.stringify(kept({ tab: "tab-a" }, 14)));
    heard.get("storage")!({ key: "brc.soloKept" });
    expect(keptMoves(account().soloKept!)).toBe(14);
    // (Its live note doesn't take the card off (D3): a Resume here would claim it.)
    store.set("brc.soloLive", JSON.stringify({ game: GAME, at: Date.now() }));
    heard.get("storage")!({ key: "brc.soloLive" });
    expect(keptMoves(account().soloKept!)).toBe(14);
    store.delete("brc.soloKept");
    heard.get("storage")!({ key: "brc.soloKept" });
    expect(account().soloKept).toBeNull();
    // (No card on screen: nothing is offered by another tab's writes.)
    store.set("brc.soloKept", JSON.stringify(kept({ tab: "tab-a" }, 15)));
    heard.get("storage")!({ key: "brc.soloKept" });
    expect(account().soloKept).toBeNull();
  });

  it("Resume checks it with the server first: still open, resumed; recorded or replaced since the load, dropped", async () => {
    let d = device(kept());
    await loadAccount();
    expect(await keptSoloOpen(kept())).toBe(true);
    expect(d.calls.at(-1)).toBe(`GET /api/me?resume=${GAME}`);
    d = device(kept(), false);
    expect(await keptSoloOpen(kept())).toBe(false);
    expect(d.held()).toBe(false);
  });
});
