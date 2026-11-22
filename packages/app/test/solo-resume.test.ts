import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, SOLO_ABANDON, ownMoves, type Settings } from "@chessroyale/core";
import { legalMoves, type UciEngine } from "@chessroyale/chess";
import { account, askForfeitFirst, forfeitKeptSolo, keptSoloOpen, loadAccount, offerKeptSolo, reofferKeptSolo } from "../src/account.ts";
import { HUMAN, loadOpenings, SoloMatch } from "../src/solo.ts";
import { SoloKeep, forfeitAsk, keptMoves, keptSoloFor, loadKeptSolo, type KeptSolo } from "../src/solo-kept.ts";

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
function battle(settings: Settings, bots = false, at = Date.now()): SoloMatch {
  const m = new SoloMatch([engine], "Ann", settings, false, bots);
  m.kept = new SoloKeep({ at, bots, settings: () => m.settings, facts: () => FACTS, boss: () => m.runner?.boss?.id ?? null });
  m.kept.ready("u", GAME, "battle1");
  return m;
}
/** The kept game resumed as the app's Resume does (App.tsx resumeKept). */
function resumed(k: KeptSolo): SoloMatch {
  const r = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...k.settings }, false, k.bots);
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

  it("being played in another tab of this device (its live note): no card at the load", async () => {
    device(kept());
    store.set("brc.soloLive", JSON.stringify({ game: GAME, at: Date.now() - 60_000 }));
    await loadAccount();
    expect(account().soloKept).toBeNull();
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
