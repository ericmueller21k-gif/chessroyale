import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_ADMIN_FIRST, DEFAULT_SETTINGS, RAID_SETTINGS, SOLO_ABANDON, ownMoves, type Settings } from "@chessroyale/core";
import { MatchRunner, dodgeArena, dodgeTimeline, legalMoves, lightsOutTimeline, rushTimeline, type UciEngine } from "@chessroyale/chess";
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
      expect(k.kept.moment!.ms).toBeGreaterThanOrEqual(closed);
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
      expect(k.kept).toMatchObject({ moment: { ms: into, mine: square } });
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

  // (The third review of #885, E1: two windows side by side, both visible, so nothing hides; the other window's Resume took the game over
  // from the first one's last keep, round 1's close, and opened round 2 before the teleports the first had shown, its safe square known.
  // The review's case (review-885-delta-2.test.ts), flipped: every teleport is kept as it shows (keep before show: SoloMatch.keep).)
  it("two windows, Chandy's Dodge: the other window's Resume opens the round at or after every teleport the first has shown", async () => {
    const admins = BOSS_ADMIN_FIRST as string[];
    const at = admins.indexOf("chandy");
    if (at >= 0) admins.splice(at, 1);
    try {
      let lostA = 0;
      const a = new SoloMatch([engine], "Ann", { ...ALONE, bossId: "chandy", bossPowerTest: "dodge" } as Settings, false, false);
      a.kept = new SoloKeep({ at: Date.now(), bots: false, settings: () => a.settings, facts: () => FACTS, boss: () => a.runner?.boss?.id ?? null, lost: () => (lostA++, a.dispose()) });
      a.kept.ready("u", GAME, null);
      a.start();
      const dodge = (x: SoloMatch) => x.runner?.state.boss?.powers?.chandy?.dodge ?? null;
      const view = (x: SoloMatch) => (x.phase as { dodge?: { at: number; round: number } }).dodge ?? null;
      for (let i = 0; i < 6000 && !(dodge(a) && dodge(a)!.results.length === 1 && view(a)); i++) {
        if (yourTurn(a)) pick(a);
        await step();
      }
      expect(dodge(a)?.results.length, "round 1 closed in A").toBe(1);
      const r2 = dodgeTimeline().rounds[1]!;
      // (A shows round 2 past its last teleport, not closed yet, nothing hidden.)
      await step(view(a)!.at + r2.teleports.at(-1)! + 200 - Date.now());
      const shown = Date.now() - view(a)!.at;
      expect(shown).toBeLessThan(r2.closeAt);
      // Window B: its card's Resume, claimed (as another tab's: both windows run in this one module).
      const k = takeKeptSolo(loadKeptSolo()!) as KeptSolo;
      store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, tab: "tab-b" }));
      // (What B resumes from: A's last keep, its last teleport's, kept a little ahead of it, as at it.)
      expect(k.kept.moment!.ms).toBeGreaterThanOrEqual(r2.teleports.at(-1)!);
      const b = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, false);
      void b.resume(k.kept);
      await until(b, () => !!view(b), "B's Dodge");
      // B is in round 2 at or after every teleport A showed (its vote with no more time left than A's).
      expect(view(b)!.round).toBe(1);
      expect(Date.now() - view(b)!.at).toBeGreaterThanOrEqual(r2.teleports.at(-1)!);
      expect(Date.now() - view(b)!.at).toBeLessThanOrEqual(shown);
      // (A stops at its next keep, writing nothing.)
      await until(b, () => dodge(b)!.results.length === 2, "B's round 2 closed");
      expect(lostA).toBe(1);
      expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
      b.dispose();
    } finally {
      if (at >= 0) admins.splice(at, 0, "chandy");
    }
  }, 120_000);

  // Keep before show (the third review of #885). Every finding of the first two (I2, I3, D1, D2, D4, D5; then E1, and the Rush and Lights
  // out seen in passing) was one bug: the battle showed something before the kept game held it, so a reload, a crash or another tab
  // resumed from before it was seen. The rule, walked: every timed power and moment, in Boss alone and a Solo raid, checked at every update
  // that reaches the screen, and at every beat a timed moment shows by the clock alone, against the kept game as a rejoin would read it.
  for (const bots of [false, true])
    for (const [bossId, power] of [["chandy", "dodge"], ["dash", "rush"], ["hollow", "lightsout"]] as const)
      it(`keep before show: ${bots ? "a Solo raid" : "Boss alone"} against ${bossId}, its ${power}, the King's call, a power-up${bots ? ", the bots' picks" : ""}: every update kept before it shows, and a rejoin mid-${power} opens it there`, async () => {
        const admins = BOSS_ADMIN_FIRST as string[];
        const was = admins.indexOf(bossId);
        if (was >= 0) admins.splice(was, 1);
        try {
          // (No strikes: a bot's death or yours would end the walk early. A rejoin's due strike has its own check.)
          const m = battle({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId, bossFixedElo: 1600, bossPowerTest: power, bossNoStrikes: true, ...(bots ? {} : { bossAloneClock: true }) } as Settings, bots);
          const problems: string[] = [];
          const seen = new Set<string>();
          let checks = 0;
          const note = (ok: boolean, what: string, tick = false) => void (!ok && problems.length < 6 && problems.push(`${what} (${tick ? "a tick" : "an update"}: ${m.phase.kind}, move ${m.moves.length})`));
          type Moment = { kind: "dodge"; at: number; mine?: string } | { kind: "rush"; at: number; places: Record<string, string> } | { kind: "lights"; at: number; rounds: { ms: number; endedAt?: number; answers?: string[] }[] };
          const momentOf = (x: SoloMatch): Moment | null => {
            const p = x.phase as { kind: string; dodge?: { at: number; mine?: string }; rush?: { at: number; places: Record<string, string> }; lights?: { at: number; rounds: { ms: number; endedAt?: number; answers?: string[] }[] } };
            if (p.kind !== "boss") return null;
            return p.dodge ? { kind: "dodge", ...p.dodge } : p.rush ? { kind: "rush", ...p.rush } : p.lights ? { kind: "lights", ...p.lights } : null;
          };
          // (What each screen shows by the clock alone, with no update: the Dodge's lines and teleports, the Rush's sweep, each Lights out
          // round's targets: ms from the moment's start.)
          const beats = (v: Moment): number[] => {
            if (v.kind === "dodge") return [dodgeTimeline().volley.at, ...dodgeTimeline().rounds.flatMap((r) => [r.voteAt, ...r.teleports])];
            if (v.kind === "rush") return [rushTimeline().scatterAt, rushTimeline().placeAt];
            return lightsOutTimeline(v.rounds, m.settings.lateGraceMs).rounds.map((r) => r.at);
          };
          const check = (tick: boolean) => {
            const k = loadKeptSolo();
            if (!k || !m.runner?.boss || m.runner.boss.result || m.decided) return;
            const v = momentOf(m);
            const km = k.kept.moment;
            // (Between updates only what the clock shows: the runner may hold his move while his thinking still shows.)
            if (tick) {
              const beat = v && beats(v).filter((b) => b <= Date.now() - v.at).at(-1);
              if (v && beat !== undefined) note((km?.ms ?? -1) >= beat, "a beat the moment shows by the clock kept", true);
              return;
            }
            checks++;
            note(JSON.stringify(k.kept.snapshot) === JSON.stringify(m.runner.snapshot()), "the board and powers on screen kept");
            note(JSON.stringify(k.kept.moves) === JSON.stringify(m.moves), "the moves kept");
            const ph = m.phase;
            const pending = k.kept.pending;
            if (ph.kind === "scoring") {
              seen.add("scoring");
              note(pending?.move === ph.move, "the move being scored kept");
              if (m.kingCalled) seen.add("king"), note(pending?.king === true, "the King's call kept");
              if (m.hint !== null) note(pending?.powerUp === true, "the power-up kept with the move");
              // (The bots' picks given to the screen, each shown at its time.)
              const shown = (m.livePicks() ?? []).filter((x) => x.playerId !== HUMAN);
              if (shown.length) seen.add("picks"), note(shown.every((x) => new Map(pending?.picks).get(x.playerId) === x.move), "the bots' picks on screen kept");
            } else note(pending === undefined, "nothing kept as being scored");
            if (ph.kind === "play" && m.hint !== null) seen.add("powerUp"), note(k.kept.powerUp === true, "the power-up used kept");
            note(!!v === !!km, "the timed moment on screen kept");
            if (!v || !km) return;
            seen.add(v.kind);
            const into = Date.now() - v.at;
            note(km.ms >= into, "the time into the moment kept as it shows");
            const beat = beats(v).filter((b) => b <= into).at(-1);
            if (beat !== undefined) seen.add(`${v.kind} beat`), note(km.ms >= beat, "a beat the moment shows by the clock kept");
            const mine = km.mine as { places?: unknown; endedAt?: unknown[] } | string | undefined;
            if (v.kind === "dodge") note(mine === v.mine, "the Dodge's vote kept");
            if (v.kind === "rush") note(JSON.stringify((mine as { places?: unknown })?.places ?? {}) === JSON.stringify(v.places), "the Rush's placements kept");
            if (v.kind === "lights") note(((mine as { endedAt?: unknown[] })?.endedAt?.length ?? 0) === v.rounds.filter((r) => r.answers).length, "Lights out's rounds over kept");
          };
          m.subscribe(() => check(false));
          m.start();
          await until(m, () => yourTurn(m), "your first turn");
          // (One power-up, as the God King's Last Stand gives.)
          const st = m.runner.state;
          (m.runner as unknown as { state: typeof st }).state = { ...st, players: st.players.map((x) => (x.id === HUMAN ? { ...x, powerUps: 1 } : x)) };
          let acted = -1;
          let turns = 0;
          let pickAt = 0;
          let probed = false;
          const tapped = new Set<string>();
          for (let i = 0; i < 9000 && m.phase.kind !== "results" && !(seen.has(power === "lightsout" ? "lights" : power) && !momentOf(m) && turns >= 5); i++) {
            const ph = m.phase as { kind: string; startsAt?: number };
            const v = momentOf(m);
            if (ph.kind === "play" && Date.now() >= ph.startsAt! && acted !== m.moves.length) {
              if (pickAt && Date.now() >= pickAt) {
                pickAt = 0;
                acted = m.moves.length;
                turns++;
                pick(m);
              } else if (!pickAt) {
                // (Kept from your first move: the power-up on your second turn, the King's call on your third.)
                if (turns === 1 && m.powerUpsLeft() > 0) {
                  m.usePowerUp();
                  pickAt = Date.now() + 400;
                } else if (turns === 2 && (m.runner.boss?.kingCharges ?? 0) > 0) {
                  acted = m.moves.length;
                  turns++;
                  m.callKing();
                } else pickAt = Date.now();
              }
            }
            // (Your inputs in each moment: a vote each round (its safe square: the battle goes on), a piece put back, a tap a round.)
            if (v?.kind === "dodge") {
              const d = m.runner.state.boss!.powers!.chandy!.dodge!;
              const r = dodgeTimeline().rounds[d.results.length];
              const t = Date.now() - v.at;
              if (r && t >= r.voteAt && t < r.voteEnd - 300 && !v.mine) m.dodgeVote(d.rounds[d.results.length]!.safe);
            }
            if (v?.kind === "rush" && Object.keys(v.places).length === 0 && Date.now() - v.at >= rushTimeline().placeAt + 500) {
              const first = m.runner.state.boss!.powers!.dash!.rush!.moves[0]!;
              m.rushPlace(first.from, first.from);
            }
            if (v?.kind === "lights") {
              const tl = lightsOutTimeline(v.rounds, m.settings.lateGraceMs);
              const k = tl.rounds.findIndex((r, j) => !v.rounds[j]!.answers && Date.now() - v.at >= r.at + 300);
              const sq = k >= 0 ? m.runner.state.boss!.powers!.lightsOut!.rounds[k]!.answers[0] : undefined;
              if (sq && !tapped.has(`${k}`)) tapped.add(`${k}`), m.lightsTap(sq);
            }
            // A rejoin from the kept game while the moment is under way, past one of its beats: it opens it there, never before.
            if (v && !probed && seen.has(`${v.kind} beat`) && Date.now() - v.at > beats(v)[1]!) {
              probed = true;
              const k = loadKeptSolo()!;
              const into = Date.now() - v.at;
              const r = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, k.bots);
              void r.resume(k.kept);
              await until(r, () => !!momentOf(r) || r.phase.kind === "results", "the rejoin's moment");
              const rv = momentOf(r)!;
              note(rv?.kind === v.kind, "the rejoin opens the same moment");
              const rInto = Date.now() - rv.at;
              note(rInto >= k.kept.moment!.ms && rInto >= (beats(v).filter((b) => b <= into).at(-1) ?? 0), "the rejoin opens it at or after what was shown");
              note(rInto < into + 400, "the rejoin opens it where it was");
              r.dispose();
            }
            check(true);
            await step();
          }
          const wanted = [power === "lightsout" ? "lights" : power, `${power === "lightsout" ? "lights" : power} beat`, "scoring", "powerUp", ...(bots ? ["picks"] : [])];
          expect(problems).toEqual([]);
          expect(wanted.filter((w) => !seen.has(w)), `walked: ${[...seen].join(", ")}`).toEqual([]);
          expect(probed, "a rejoin mid-moment").toBe(true);
          expect(checks).toBeGreaterThan(10);
          m.dispose();
        } finally {
          if (was >= 0) admins.splice(was, 0, bossId);
        }
      }, 120_000);

  // (The third review of #885, EN1: a rejoin's keeps before its first round (his brain's loading step, Maia's) wrote no time into the
  // Dodge, so a crash then reopened the round due, its teleports seen. Until its first round, a rejoin keeps what it was kept with.)
  it("a rejoin mid-Dodge, his brain loading first: kept as it was meanwhile (its time and your vote), then on from there", async () => {
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
      const r2 = dodgeTimeline().rounds[1]!;
      await step(view(m)!.at + r2.voteAt + 300 - Date.now());
      m.dodgeVote(dodgeArena(dodge(m)!.center)[0]!);
      const k = loadKeptSolo()!;
      expect(k.kept.moment).toMatchObject({ mine: dodgeArena(dodge(m)!.center)[0] });
      m.dispose();
      // (His brain's loading step, as Maia's shows it, before the first round.)
      const r = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, false);
      r.kept = new SoloKeep({ at: k.at, bots: false, settings: () => r.settings, facts: () => FACTS, boss: () => r.runner?.boss?.id ?? null });
      r.kept.ready(k.user, k.game, k.battle);
      const self = r as unknown as { startBrain: (next: () => void) => void; set: (p: unknown) => void; bossSnapshot: () => unknown };
      vi.spyOn(self, "startBrain").mockImplementation((next) => {
        self.set({ kind: "boss", boss: self.bossSnapshot(), until: 0, intro: true, loading: true });
        setTimeout(next, 3_000);
      });
      void r.resume(k.kept);
      await step(1_000);
      expect(r.phase).toMatchObject({ loading: true });
      expect(loadKeptSolo()!.kept.moment).toEqual(k.kept.moment);
      await until(r, () => !!view(r), "the Dodge, resumed after the load");
      expect(view(r)!.mine).toBe(k.kept.moment!.mine);
      expect(Date.now() - view(r)!.at).toBeLessThan(k.kept.moment!.ms + 300);
      r.dispose();
    } finally {
      if (at >= 0) admins.splice(at, 0, "chandy");
    }
  }, 120_000);

  // (Keep before show keeps the moments the old keeps skipped: a rejoin now plays what was due at each. The dark's move: kept as it flashes,
  // before the dark has picked it.)
  it("Hollow alone, the dark about to play your move (a 3rd bulb out), a reload: the rejoin plays the dark's move, never yours", async () => {
    const m = battle({ ...ALONE, bossId: "hollow", bossPowerTest: undefined } as Settings);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    // (The 3rd bulb just out, as darkTry leaves it: the dark plays this turn's move.)
    const st = m.runner.state;
    const boss = st.boss!;
    (m.runner as unknown as { state: typeof st }).state = { ...st, boss: { ...boss, powers: { ...boss.powers!, strand: { out: 3 }, forced: { turn: boss.crowdMoves + 1, at: 3 } } } };
    expect(m.runner.darkForcedDue()).toBe(true);
    const self = m as unknown as { darkNote: unknown; darkForcedTurn: () => Promise<void> };
    self.darkNote = { move: "e2e4", at: Date.now(), tries: 3, out: true, bulbs: 3, forced: true };
    void self.darkForcedTurn();
    const k = loadKeptSolo()!;
    expect(k.kept.pending).toBeUndefined();
    m.dispose();
    const r = resumed(k);
    // (Nothing picked here: the dark's move is the turn's, as played through.)
    await until(r, () => r.moves.length === 2, "the dark's move, resumed");
    expect(r.darkNote).toMatchObject({ forced: true });
    expect(r.moves[1]!.move).toBe(r.runner.state.boss!.powers!.forced!.move);
    r.dispose();
  }, 120_000);

  it("a Solo raid kept on the crowd's move, its strike due: the rejoin strikes first, before his reply, as it would have", async () => {
    const m = battle({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossFixedElo: 1600 } as Settings, true);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    for (let i = 0; i < 100 && Date.now() < (m.phase as { startsAt: number }).startsAt; i++) await step();
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    for (let i = 0; i < 100 && Date.now() < (m.phase as { startsAt: number }).startsAt; i++) await step();
    pick(m);
    // (The crowd's move revealed, his reply not yet: what's kept.)
    await until(m, () => m.phase.kind === "reveal", "the crowd's move revealed");
    const k = loadKeptSolo()!;
    const ply = k.kept.snapshot.boards[0]!.history.length;
    m.dispose();
    // (A strike due after that move: stubbed, as the stand-in engine's equal losses leave no clear worst.)
    const due = vi.spyOn(MatchRunner.prototype, "bossKillDue").mockReturnValue(true);
    let struckAt: number | null = null;
    const kill = vi.spyOn(MatchRunner.prototype, "bossKill").mockImplementation(function (this: MatchRunner) {
      due.mockReturnValue(false);
      struckAt = this.boards.get(this.state.boards[0]!)!.history.length;
      return null;
    });
    try {
      const r = resumed(k);
      await until(r, () => yourTurn(r) && r.moves.length === 2, "your third turn, resumed");
      expect(kill).toHaveBeenCalledTimes(1);
      expect(struckAt, "struck before his reply").toBe(ply);
      r.dispose();
    } finally {
      due.mockRestore();
      kill.mockRestore();
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
    keep.keep(game(4));
    expect(lost).toHaveBeenCalledTimes(1);
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
    expect(keptMoves(loadKeptSolo()!)).toBe(2);
    // (Its end leaves the other tab's be.)
    keep.end();
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
    // Taken over since its last keep, then its own line ends with no keep between (the battle's end: its result's update keeps nothing, as
    // the game is no longer one to resume; the step before it kept): the other tab's is left be (DN4). (A resign keeps first: EN2's case.)
    ({ keep, lost } = keeper());
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, tab: "tab-b" }));
    keep.end();
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b" });
    // (Held: its end clears it.)
    ({ keep, lost } = keeper());
    keep.end();
    expect(loadKeptSolo()).toBeNull();
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

  // (The third review of #885, EN2: a resign was the one end with no keep before it, so a tab whose game another had taken over recorded
  // a loss for a game played on there, and that tab played on a game already recorded.)
  it("a resign in a tab whose game another tab took over: it stops there, \"Played in another tab.\", and records nothing", async () => {
    let lost = 0;
    const m = new SoloMatch([engine], "Ann", ALONE, false, false);
    m.kept = new SoloKeep({ at: Date.now(), bots: false, settings: () => m.settings, facts: () => FACTS, boss: () => m.runner?.boss?.id ?? null, lost: () => (lost++, m.dispose()) });
    m.kept.ready("u", GAME, "battle1");
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    pick(m);
    await until(m, () => yourTurn(m) && m.moves.length === 1, "your second turn");
    store.set("brc.soloKept", JSON.stringify({ ...loadKeptSolo()!, tab: "tab-b" }));
    m.resign();
    expect(lost).toBe(1);
    expect(m.phase.kind).not.toBe("results");
    expect(m.decided).toBeNull();
    expect(loadKeptSolo()).toMatchObject({ tab: "tab-b", game: GAME });
  }, 120_000);

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
