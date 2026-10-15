import { readdirSync, statSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_BRAIN, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { HumanUciEngine, type UciTransport } from "@chessroyale/chess";
import { MaiaGate, retryable } from "../src/maia-gate.ts";
import { downloadProgress, fileTotal } from "../src/maia.ts";
import { SoloMatch } from "../src/solo.ts";

/**
 * Maia's loading step before a solo boss battle (DECISIONS.md, "Maia's loading step", Oct 14): Stockfish paused first,
 * Maia loaded alone, one more try after a memory or backend failure, never longer than BOSS_BRAIN.loadGateMs; and the
 * download's bar.
 */

describe("the download's bar", () => {
  it("the share of the three files' bytes; unknown (a bar that only says it's busy) until every size is known", () => {
    expect(downloadProgress([])).toEqual({ share: null, loaded: 0, total: null });
    // (One file's size not known yet: no share.)
    expect(downloadProgress([{ loaded: 100, total: 1000 }, { loaded: 0, total: null }, { loaded: 0, total: 3000 }]).share).toBeNull();
    // (Two of three files started: still unknown.)
    expect(downloadProgress([{ loaded: 100, total: 1000 }, { loaded: 50, total: 3000 }]).share).toBeNull();
    const p = downloadProgress([{ loaded: 1000, total: 1000 }, { loaded: 1500, total: 3000 }, { loaded: 500, total: 6000 }]);
    expect(p).toEqual({ share: 0.3, loaded: 3000, total: 10_000 });
    // (Never past the end, whatever a file sent.)
    expect(downloadProgress([{ loaded: 2000, total: 1000 }, { loaded: 1, total: 1 }, { loaded: 1, total: 1 }]).share).toBe(1);
  });

  it("a file's size: the build's, else an uncompressed response's length, else unknown", () => {
    expect(fileTotal(14_239_897, "3300000", "zstd")).toBe(14_239_897);
    expect(fileTotal(undefined, "25191199", null)).toBe(25_191_199);
    expect(fileTotal(undefined, "25191199", "identity")).toBe(25_191_199);
    // (A compressed response's length is the packed size; the reader counts unpacked bytes.)
    expect(fileTotal(undefined, "3300000", "br")).toBeNull();
    expect(fileTotal(undefined, null, null)).toBeNull();
    expect(fileTotal(undefined, "", null)).toBeNull();
    expect(fileTotal(0, "abc", null)).toBeNull();
  });

  it("the players' words say the files' size: BOSS_BRAIN.downloadMb is the three files, unpacked, rounded", () => {
    const root = new URL("../../../", import.meta.url);
    const model = statSync(new URL("packages/maia-worker/model/maia3-23m-int8.onnx", root)).size;
    const wasm = statSync(new URL("node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", root)).size;
    // (The worker: about 0.1 MB, if it's built here.)
    const dist = new URL("packages/maia-worker/dist/", root);
    let worker = 115_000;
    try {
      if (readdirSync(dist).includes("maia-worker.js")) worker = statSync(new URL("maia-worker.js", dist)).size;
    } catch {
      // Not built.
    }
    const mb = (model + wasm + worker) / 1e6;
    expect(Math.round(mb / 5) * 5, `${mb.toFixed(1)} MB`).toBe(BOSS_BRAIN.downloadMb);
  });
});

/** A Maia worker stand-in: its load ends as told (`ok`, or a failure's text), or never (null). */
function fakeMaia(outcome: { ok: true } | { error: string } | null) {
  const listeners: ((line: string) => void)[] = [];
  const say = (line: string) => queueMicrotask(() => listeners.forEach((l) => l(line)));
  const transport: UciTransport = {
    send: (c) => {
      if (c === "uci") say("uciok");
      if (c === "isready" && outcome) {
        if ("error" in outcome) say(`info string error load failed: ${outcome.error}`);
        say("readyok");
      }
    },
    onLine: (l) => listeners.push(l),
    close: () => undefined,
  };
  return new HumanUciEngine(transport);
}

describe("the loading step (MaiaGate)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A gate over stand-ins: what happened, in order. */
  function gate(outcomes: ({ ok: true } | { error: string } | null)[], gateMs = 20_000) {
    const log: string[] = [];
    let stockfishEnd!: () => void;
    const engines: HumanUciEngine[] = [];
    const g = new MaiaGate({
      start: (after) => {
        const e = fakeMaia(outcomes[engines.length] ?? null);
        engines.push(e);
        log.push(`start ${engines.length}`);
        void after.then(() => {
          log.push(`load ${engines.indexOf(e) + 1}`);
          void e.init();
        });
        return e;
      },
      pause: (until) => {
        log.push("pause");
        void until.then(() => log.push("Stockfish back"));
        return new Promise<void>((r) => (stockfishEnd = () => (log.push("Stockfish ended"), r())));
      },
      gateMs,
    });
    return { g, log, engines, stockfishEnd: () => stockfishEnd() };
  }

  it("Stockfish ends first, then Maia loads alone; ready, Stockfish starts again and the battle can begin", async () => {
    const { g, log, stockfishEnd } = gate([{ ok: true }]);
    await vi.advanceTimersByTimeAsync(0);
    // (Maia's worker starts at once; its load waits for Stockfish's workers to end.)
    expect(log).toEqual(["pause", "start 1"]);
    stockfishEnd();
    expect(await g.done).toBe("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["pause", "start 1", "Stockfish ended", "load 1", "Stockfish back"]);
    expect(g.firstError).toBeNull();
  });

  it("never longer than gateMs: Maia not ready by then, the step ends (Stockfish back, Maia left loading)", async () => {
    const { g, log, engines, stockfishEnd } = gate([null]);
    stockfishEnd();
    let end: string | null = null;
    void g.done.then((e) => (end = e));
    await vi.advanceTimersByTimeAsync(BOSS_BRAIN.loadGateMs - 1);
    expect(end).toBeNull();
    expect(log).not.toContain("Stockfish back");
    await vi.advanceTimersByTimeAsync(1);
    expect(end).toBe("timeout");
    expect(log.at(-1)).toBe("Stockfish back");
    // (Still loading: it plays once ready, as before.)
    expect(engines[0]!.status).toBe("loading");
    // (The step's own timer is gone: what's left is Maia's load timeout.)
    expect(vi.getTimerCount()).toBe(1);
  });

  it("the time counts from the start: Stockfish slow to end still can't hold the battle past gateMs", async () => {
    const { g, log } = gate([{ ok: true }]);
    await vi.advanceTimersByTimeAsync(BOSS_BRAIN.loadGateMs);
    // (Stockfish never ended: Maia's load went ahead at the deadline, and the step ended there.)
    expect(await g.done).toBe("timeout");
    expect(log).toContain("Stockfish back");
  });

  it("a memory or backend failure is tried once more, from a fresh worker; the first failure's reason is kept", async () => {
    const reason = "no available backend found. ERR: [wasm] RangeError: Out of memory";
    const { g, log, engines, stockfishEnd } = gate([{ error: reason }, { ok: true }]);
    stockfishEnd();
    expect(await g.done).toBe("ready");
    expect(engines).toHaveLength(2);
    expect(engines[0]!.status).toBe("closed");
    expect(g.engine).toBe(engines[1]);
    expect(g.firstError).toBe(`load failed: ${reason}`);
    // (Stockfish stayed paused through both tries.)
    expect(log.indexOf("Stockfish back")).toBeGreaterThan(log.indexOf("load 2"));
  });

  it("once more only: a second failure ends it (Stockfish then); other failures aren't tried again", async () => {
    const twice = gate([{ error: "RangeError: Out of memory" }, { error: "RangeError: Out of memory" }]);
    twice.stockfishEnd();
    expect(await twice.g.done).toBe("failed");
    expect(twice.engines).toHaveLength(2);
    const missing = gate([{ error: "model: HTTP 404" }]);
    missing.stockfishEnd();
    expect(await missing.g.done).toBe("failed");
    expect(missing.engines).toHaveLength(1);
    expect(retryable("load failed: no available backend found. ERR: [wasm] RangeError: Out of memory")).toBe(true);
    expect(retryable("load timed out")).toBe(false);
    expect(retryable(null)).toBe(false);
  });

  it("stopped (the player left): ends at once and Stockfish starts again", async () => {
    const { g, log, stockfishEnd } = gate([null]);
    stockfishEnd();
    await vi.advanceTimersByTimeAsync(1000);
    g.stop();
    expect(await g.done).toBe("stopped");
    await vi.advanceTimersByTimeAsync(0);
    expect(log.at(-1)).toBe("Stockfish back");
    // (The step's own timer is gone: what's left is Maia's load timeout.)
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("a solo boss battle on Maia: the loading step, then the intro", () => {
  /** Maia workers started; each answers as `answer` says (null: never ready). */
  let answer: "ready" | null = null;
  let started = 0;
  class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    constructor() {
      started++;
    }
    postMessage(c: string) {
      const say = (line: string) => queueMicrotask(() => this.onmessage?.({ data: line } as MessageEvent));
      if (c === "uci") say("uciok");
      if (c === "isready" && answer === "ready") say("readyok");
    }
    terminate() {}
  }
  const raid = (): Settings => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread" }) as Settings;

  beforeEach(() => {
    vi.useFakeTimers();
    started = 0;
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Boss alone: the loading step shows (the intro held), Maia ready, then the intro afresh", async () => {
    answer = "ready";
    const m = new SoloMatch([], "Ann", raid());
    m.start();
    expect(m.phase).toMatchObject({ kind: "boss", intro: true, loading: true });
    expect(started).toBe(1);
    expect(m.exit).toBe("leave");
    expect(m.exitHome).toBe(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(m.phase).toMatchObject({ kind: "boss", intro: true, afterLoading: true });
    expect("loading" in m.phase && m.phase.loading).toBeFalsy();
    expect(m.runner.humanBrain?.engine.ready()).toBe(true);
    m.dispose();
  });

  it("Maia never ready: the battle's intro comes at loadGateMs, Maia left loading (the boss plays Stockfish until it is)", async () => {
    answer = null;
    const m = new SoloMatch([], "Ann", raid());
    m.start();
    await vi.advanceTimersByTimeAsync(BOSS_BRAIN.loadGateMs - 10);
    expect(m.phase).toMatchObject({ kind: "boss", loading: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(m.phase).toMatchObject({ kind: "boss", intro: true, afterLoading: true });
    expect(m.runner.humanBrain?.engine.status).toBe("loading");
    m.dispose();
  });

  it("leaving during the step: the match stops there; no intro follows", async () => {
    answer = null;
    const m = new SoloMatch([], "Ann", raid());
    m.start();
    m.resign();
    await vi.advanceTimersByTimeAsync(BOSS_BRAIN.loadGateMs + 1000);
    expect(m.phase).toMatchObject({ kind: "boss", loading: true });
    expect(m.runner.humanBrain).toBeNull();
  });
});
