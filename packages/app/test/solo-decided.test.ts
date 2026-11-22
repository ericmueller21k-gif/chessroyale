import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, RECLUSE_PHASE2, finishBoss, type Settings } from "@chessroyale/core";
import { RECLUSE_FALL_MS, START_FEN, legalMoves, type UciEngine } from "@chessroyale/chess";
import { HUMAN, loadOpenings, SoloMatch, type Results } from "../src/solo.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

/** An admin's profile (the boss battle's "Win this match", to beat a boss in one move). */
vi.mock("../src/account.ts", async (orig) => {
  const real = await orig<typeof import("../src/account.ts")>();
  return { ...real, account: () => ({ ...real.account(), profile: { admin: true } as never }) };
});

/**
 * A solo game's result from the moment it's decided (SoloMatch.decided; the review of #881, P1): the app keeps it on the device then
 * (xp.ts), so a page closed or reloaded in an end moment (a beaten boss's fall, the final's last move held, the Hidden Boss's reaction
 * to phase 2's end) still sends it, and a win is never recorded as left (SOLO_ABANDON). One check per end moment, and one that an end
 * moment added later can't open the gap again.
 */
describe("a solo game's result, known as it's decided (SOLO_ABANDON)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A stand-in engine: its searches answer at once with the first legal moves. */
  const quick = {
    topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
    scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
    topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
    playAtElo: async (fen: string) => legalMoves(fen)[0]!,
  } as unknown as UciEngine;
  const raid = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, ...patch }) as Settings;
  /** A Solo raid (bots beside you) against the Hidden Boss's adult form: beaten, his 4.5 s fall, then the results (no phase 2). */
  async function toPlay() {
    const m = new SoloMatch([quick], "Ann", raid({ bossId: "recluse", bossHidden: true }), false, true);
    m.start();
    for (let i = 0; i < 200 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    expect(m.phase.kind).toBe("play");
    return m;
  }
  const play = (m: SoloMatch) => m.submit(legalMoves((m.phase as { board: { fen: string } }).board.fen)[0]!);
  const until = async (m: SoloMatch, done: () => boolean, ms = 100) => {
    for (let i = 0; i < 400 && !done(); i++) await vi.advanceTimersByTimeAsync(ms);
    expect(done()).toBe(true);
  };
  const falling = (m: SoloMatch) => m.phase.kind === "boss" && !!m.phase.fall;

  it("the Hidden Boss's fall: the result from its first frame (a win), the same the result screen then shows", async () => {
    const m = await toPlay();
    // (Every update the app hears: whether the result was known by then.)
    const heard: [string, Results | null][] = [];
    m.subscribe(() => heard.push([m.phase.kind + (falling(m) ? " fall" : ""), m.decided]));
    m.winForm();
    play(m);
    await until(m, () => falling(m));
    const fall = heard.find(([k]) => k === "boss fall")!;
    expect(fall[1]).toMatchObject({ kind: "results", bossResult: "crowd" });
    // (Never before he was beaten: every update until his fall had none.)
    expect(heard.slice(0, heard.indexOf(fall)).every(([, d]) => d === null)).toBe(true);
    const decided = m.decided;
    await vi.advanceTimersByTimeAsync(RECLUSE_FALL_MS - 200);
    expect(falling(m)).toBe(true);
    await until(m, () => m.phase.kind === "results");
    expect(m.phase).toEqual(decided);
    expect(m.decided).toBe(m.phase);
    m.dispose();
  }, 60_000);

  it("the page going on the reveal of the move that beat him: it ends now (the fall starts, the result known); any other reveal plays on", async () => {
    const m = await toPlay();
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    m.endOnHide();
    expect(m.phase.kind).toBe("reveal");
    await until(m, () => m.phase.kind === "play", 500);
    m.winForm();
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    expect(m.decided).toBeNull();
    m.endOnHide();
    expect(falling(m)).toBe(true);
    expect(m.decided).toMatchObject({ kind: "results", bossResult: "crowd" });
    m.dispose();
  }, 60_000);

  /** A strike due after every crowd move (bossKillDue and bossKill stubbed, a bot struck; everything else real). */
  const strikesDue = (m: SoloMatch) => {
    const bot = m.runner.alive().find((p) => p.id !== HUMAN)!.id;
    const kill = vi.fn(() => bot);
    Object.assign(m.runner, { bossKillDue: () => true, bossKill: kill });
    return kill;
  };
  const striking = (m: SoloMatch) => m.phase.kind === "boss" && !m.phase.fall && m.phase.until > Date.now();

  it("a Solo raid's last move with a strike due (the second delta review, I1): the page going on its reveal or its strike plays the strike out and ends the battle, the result known", async () => {
    // (Beaten: the page goes on the last move's reveal. Before that, a strike mid-battle plays on, on its reveal and in the strike.)
    let m = await toPlay();
    let kill = strikesDue(m);
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    m.endOnHide();
    expect(m.phase.kind).toBe("reveal");
    m.skipReveal();
    expect(striking(m)).toBe(true);
    m.endOnHide();
    expect(striking(m)).toBe(true);
    expect(m.decided).toBeNull();
    await until(m, () => m.phase.kind === "play", 500);
    m.winForm();
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    expect(m.runner.stageComplete()).toBe(true);
    expect(m.decided).toBeNull();
    m.endOnHide();
    expect(kill).toHaveBeenCalledTimes(2);
    expect(falling(m)).toBe(true);
    expect(m.decided).toMatchObject({ kind: "results", bossResult: "crowd" });
    // (The fall then plays once to the result screen: the strike's timer is gone, so nothing runs the next round again.)
    const decided = m.decided;
    await until(m, () => m.phase.kind === "results");
    expect(m.phase).toEqual(decided);
    expect(kill).toHaveBeenCalledTimes(2);
    m.dispose();
    // (The move cap (bossMaxMoves) on the crowd's first move: the page goes during the strike that follows it.)
    m = new SoloMatch([quick], "Ann", raid({ bossId: "recluse", bossHidden: true, bossMaxMoves: 1 }), false, true);
    m.start();
    await until(m, () => m.phase.kind === "play", 500);
    kill = strikesDue(m);
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    m.skipReveal();
    expect(striking(m)).toBe(true);
    expect(m.runner.stageComplete()).toBe(true);
    expect(m.decided).toBeNull();
    m.endOnHide();
    expect(kill).toHaveBeenCalledTimes(1);
    expect(m.decided).toMatchObject({ kind: "results" });
    expect(m.decided?.bossResult).toBeDefined();
    m.dispose();
  }, 60_000);

  it("the same shape elsewhere: the battle over as the boss's own move shows (a mate, his last carrot): the page going ends it; while he thinks, nothing", async () => {
    const m = await toPlay();
    play(m);
    await until(m, () => m.phase.kind === "reveal");
    m.skipReveal();
    await until(m, () => m.phase.kind === "boss" && !!m.phase.thinking, 10);
    // (His move on its way: the runner says it's over (stubbed), but no step is shown yet, so nothing changes.)
    const complete = vi.spyOn(m.runner, "stageComplete").mockReturnValue(true);
    m.endOnHide();
    expect(m.phase.kind === "boss" && m.phase.thinking).toBe(true);
    expect(m.decided).toBeNull();
    complete.mockRestore();
    await until(m, () => striking(m) && !(m.phase.kind === "boss" && m.phase.thinking), 10);
    vi.spyOn(m.runner, "stageComplete").mockReturnValue(true);
    m.endOnHide();
    expect(m.decided).toMatchObject({ kind: "results" });
    m.dispose();
  }, 60_000);

  type Inside = {
    runner: { state: Parameters<typeof finishBoss>[0]; isOver(): boolean; stageComplete(): boolean; afterFinalTurn(): string[]; finishFinal(): void; finalView(): unknown };
    createRunner(): void;
    set(p: object): void;
    phase2: unknown;
    phase: { kind: string };
    phase2Done(): void;
    showFinalMove(report: unknown): void;
  };

  it("phase 2's end: his reaction holds the boards (RECLUSE_PHASE2.endMs), the result known from its start", () => {
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as SoloMatch & Inside;
    m.createRunner();
    m.runner.state = finishBoss(m.runner.state, () => 0.5, "crowd");
    m.phase2 = { stop() {}, outcome: { won: 4, of: 4, beaten: true, decided: true }, state: { boards: [] } };
    m.phase = { kind: "simul", at: 0 } as never;
    m.phase2Done();
    expect(m.phase.kind).toBe("simul");
    expect(m.decided).toMatchObject({ kind: "results", placement: 1, bossResult: "crowd", simul: { won: 4, of: 4 } });
    const decided = m.decided;
    vi.advanceTimersByTime(RECLUSE_PHASE2.endMs);
    expect(m.phase).toEqual(decided);
    m.dispose();
  });

  it("Classic's final: its last move places the finalists as it's played, so the result is known while the move is shown (FINAL_SHOW_MS)", () => {
    const m = new SoloMatch([], "Ann", DEFAULT_SETTINGS) as unknown as SoloMatch & Inside;
    m.createRunner();
    // (The final's last move, its step done: a pretend runner from here, placing everyone as core finishFinal does.)
    const r = m.runner;
    const placed = vi.fn(() => void (r.state = { ...r.state, players: r.state.players.map((p, i) => ({ ...p, placement: p.id === HUMAN ? 1 : i + 2 })) }));
    Object.assign(r, { afterFinalTurn: () => [], stageComplete: () => true, finishFinal: placed, finalView: () => ({ board: {}, teams: [], mover: HUMAN }) });
    m.showFinalMove({ boards: [{ fenBefore: START_FEN, result: { playedMove: "e2e4", players: [{ playerId: HUMAN, loss: 0 }] } }] });
    expect(m.phase.kind).toBe("final");
    expect(placed).toHaveBeenCalledTimes(1);
    expect(m.decided).toMatchObject({ kind: "results", placement: 1, youWon: true });
    const decided = m.decided;
    vi.advanceTimersByTime(5000);
    expect(m.phase).toEqual(decided);
    expect(placed).toHaveBeenCalledTimes(1);
    m.dispose();
  });

  it("an end moment added later can't open the gap: any update once the game is decided carries its result, before anyone hears it", () => {
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as SoloMatch & Inside;
    m.createRunner();
    const heard: (Results | null)[] = [];
    m.subscribe(() => heard.push(m.decided));
    // (Still playing: none.)
    m.set({ kind: "boss", boss: {}, until: Date.now() + 9000 });
    // (Beaten: a hold no path uses today, say a new boss's own fall, set right after the runner's end.)
    m.runner.state = finishBoss(m.runner.state, () => 0.5, "crowd");
    m.set({ kind: "boss", boss: {}, until: Date.now() + 9000, fall: true });
    expect(heard).toEqual([null, expect.objectContaining({ kind: "results", placement: 1, bossResult: "crowd" })]);
    m.dispose();
  });
});
