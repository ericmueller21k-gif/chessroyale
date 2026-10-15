import { afterEach, describe, expect, it, vi } from "vitest";
import { HumanUciEngine, UciEngine, type UciTransport } from "../src/index.ts";

/**
 * Pausing Stockfish while Maia loads (DECISIONS.md, "Maia's loading step", Oct 14): the engine's process ends once the
 * work already asked for is done, nothing searches meanwhile, and a fresh process is set up as before when the pause
 * ends; one that doesn't answer is revived once. A pretend Stockfish answers here: `answers` false, a fresh process
 * stays silent (short of memory, say).
 */
function fakeStockfish() {
  const sent: string[] = [];
  const events: string[] = [];
  const listeners: ((line: string) => void)[] = [];
  let process = 1;
  let answers = true;
  const say = (line: string) => queueMicrotask(() => listeners.forEach((l) => l(line)));
  const transport: UciTransport = {
    send: (c) => {
      sent.push(`${process}: ${c}`);
      if (!answers) return;
      if (c === "uci") say("uciok");
      if (c === "isready") say("readyok");
      if (c.startsWith("go ")) {
        say("info depth 10 multipv 1 score cp 20 wdl 400 300 300 pv e2e4 e7e5");
        say("bestmove e2e4");
      }
    },
    onLine: (l) => listeners.push(l),
    close: () => events.push("close"),
    restart: () => {
      events.push(`restart ${process}`);
      process++;
    },
  };
  return {
    transport,
    sent,
    events,
    setAnswers: (on: boolean) => (answers = on),
  };
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("UciEngine.pause", () => {
  afterEach(() => vi.useRealTimers());

  it("ends the process after the work already asked for; work asked meanwhile waits for a fresh one, set up as before", async () => {
    const sf = fakeStockfish();
    const engine = new UciEngine(sf.transport, { nodes: 1000, hashMb: 16 });
    await engine.init();
    const before = engine.topMoves(START, 1);
    let release!: () => void;
    const until = new Promise<void>((r) => (release = r));
    const ended = engine.pause(until);
    let during: string | null = null;
    const asked = engine.topMoves(START, 1).then((m) => (during = m[0]!.move));
    expect((await before)[0]!.move).toBe("e2e4");
    await ended;
    expect(sf.events).toEqual(["restart 1"]);
    const sentWhilePaused = sf.sent.length;
    await tick();
    await tick();
    // Nothing goes to the engine while it's paused, and the work asked for waits.
    expect(sf.sent.length).toBe(sentWhilePaused);
    expect(during).toBeNull();
    release();
    await asked;
    expect(during).toBe("e2e4");
    // The fresh process is set up as the first was, before the waiting work.
    const fresh = sf.sent.filter((c) => c.startsWith("2: ")).map((c) => c.slice(3));
    expect(fresh.slice(0, 5)).toEqual(["uci", "setoption name UCI_ShowWDL value true", "setoption name Hash value 16", "setoption name Threads value 1", "isready"]);
    expect(fresh).toContain(`position fen ${START}`);
  });

  it("a fresh process that doesn't answer in time: revive is called once, and it starts again", async () => {
    vi.useFakeTimers();
    const sf = fakeStockfish();
    const engine = new UciEngine(sf.transport, { nodes: 1000, hashMb: 16 });
    const init = engine.init();
    await vi.advanceTimersByTimeAsync(0);
    await init;
    const revive = vi.fn(() => sf.setAnswers(true));
    sf.setAnswers(false);
    const ended = engine.pause(Promise.resolve(), revive, 15_000);
    await vi.advanceTimersByTimeAsync(0);
    await ended;
    let done = false;
    const asked = engine.topMoves(START, 1).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(14_000);
    expect(revive).not.toHaveBeenCalled();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(revive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    await asked;
    expect(sf.events).toEqual(["restart 1", "restart 2"]);
    expect(sf.sent.filter((c) => c.startsWith("3: "))[0]).toBe("3: uci");
  });

  it("a transport that can't restart (Node's): the work only waits, nothing is sent again", async () => {
    const sf = fakeStockfish();
    delete sf.transport.restart;
    const engine = new UciEngine(sf.transport, { nodes: 1000, hashMb: 16 });
    await engine.init();
    const n = sf.sent.length;
    let release!: () => void;
    await engine.pause(new Promise<void>((r) => (release = r)));
    let done = false;
    const asked = engine.topMoves(START, 1).then(() => (done = true));
    await tick();
    expect(done).toBe(false);
    release();
    await asked;
    expect(sf.sent.slice(n)[0]).toBe("1: ucinewgame");
  });
});

describe("HumanUciEngine.loaded", () => {
  function fakeMaia(reply: (c: string, say: (l: string) => void) => void) {
    const listeners: ((line: string) => void)[] = [];
    const say = (line: string) => queueMicrotask(() => listeners.forEach((l) => l(line)));
    const transport: UciTransport = { send: (c) => reply(c, say), onLine: (l) => listeners.push(l), close: () => undefined };
    return new HumanUciEngine(transport);
  }

  it("true once ready (and at once after); false on a failed load, with its reason", async () => {
    const ok = fakeMaia((c, say) => (c === "uci" ? say("uciok") : c === "isready" ? say("readyok") : undefined));
    const waiting = ok.loaded();
    void ok.init();
    expect(await waiting).toBe(true);
    expect(await ok.loaded()).toBe(true);
    const bad = fakeMaia((c, say) => {
      if (c === "uci") say("uciok");
      if (c === "isready") {
        say("info string error load failed: no available backend found. ERR: [wasm] RangeError: Out of memory");
        say("readyok");
      }
    });
    const failed = bad.loaded();
    void bad.init();
    expect(await failed).toBe(false);
    expect(bad.error).toBe("load failed: no available backend found. ERR: [wasm] RangeError: Out of memory");
  });

  it("false when the worker breaks or the engine is closed while loading", async () => {
    const broken = fakeMaia(() => undefined);
    const w1 = broken.loaded();
    void broken.init();
    broken.fail("worker error");
    expect(await w1).toBe(false);
    const closed = fakeMaia(() => undefined);
    const w2 = closed.loaded();
    void closed.init();
    closed.close();
    expect(await w2).toBe(false);
  });
});
