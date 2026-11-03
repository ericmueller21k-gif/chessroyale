/**
 * Sound coming back after the page was away (Eric, Nov 3, on his iPhone: "whenever I switch away and come back" the audio was
 * gone): sound.ts's `audioReturned` (visibilitychange, pageshow, focus) and `wakeAudio` (every tap and key), against a fake
 * AudioContext standing in for iOS's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type State = "suspended" | "running" | "interrupted" | "closed";
const node = (extra: object = {}) => ({ connect: (n: unknown) => n, ...extra });
class FakeContext {
  static made: FakeContext[] = [];
  static rate = 48000;
  /** resume() never settles (iOS after an interruption, sometimes). */
  static hang = false;
  state: State = "suspended";
  currentTime = 0;
  sampleRate = FakeContext.rate;
  destination = node();
  started = 0;
  resumes = 0;
  constructor() {
    FakeContext.made.push(this);
  }
  createGain = () => node({ gain: { value: 1 } });
  createBiquadFilter = () => node({ type: "", frequency: { value: 0 }, Q: { value: 0 } });
  createBuffer = (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) });
  createBufferSource = () => node({ buffer: null, playbackRate: { value: 1 }, start: () => this.started++ });
  resume() {
    this.resumes++;
    if (FakeContext.hang || this.state === "closed") return new Promise<void>(() => undefined);
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

let clock = 0;
let visibility: "visible" | "hidden" = "visible";
const docListeners = new Map<string, () => void>();
let sound: typeof import("../src/sound.ts");
const flush = () => new Promise((ok) => setTimeout(ok, 0));
const last = () => FakeContext.made.at(-1)!;
/** The page goes away (iOS: the context suspended or interrupted, its clock stopped) and comes back `ms` later. */
function away(state: State, ms = 5000) {
  visibility = "hidden";
  docListeners.get("visibilitychange")?.();
  last().state = state;
  clock += ms;
  visibility = "visible";
  docListeners.get("visibilitychange")?.();
}
/** The first tap after: `wakeAudio` (main.tsx's listener, ahead of the page's), then the page's own sound for that tap. */
function tap(ms = 1000) {
  clock += ms;
  sound.wakeAudio();
  sound.play("tick");
}

beforeEach(async () => {
  vi.resetModules();
  FakeContext.made = [];
  FakeContext.rate = 48000;
  FakeContext.hang = false;
  clock = 0;
  visibility = "visible";
  docListeners.clear();
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (ev: string, fn: () => void) => docListeners.set(ev, fn),
  });
  vi.stubGlobal("addEventListener", () => undefined);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  (globalThis as { __soundLog?: string[] }).__soundLog = [];
  sound = await import("../src/sound.ts");
  sound.prepareAudio();
  // The visit's first tap switches sound on, and it plays.
  sound.wakeAudio();
  await flush();
  expect(FakeContext.made).toHaveLength(1);
  expect(last().state).toBe("running");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sound after the page was away", () => {
  it("suspended, and resumed on the way back: the same context plays the next sound", async () => {
    const first = last();
    away("suspended");
    expect(first.resumes).toBe(2);
    await flush();
    tap();
    expect(FakeContext.made).toHaveLength(1);
    expect(first.state).toBe("running");
    expect(first.started).toBe(1);
    expect((globalThis as { __soundLog: string[] }).__soundLog.at(-1)).toBe("tick:running");
  });

  it("interrupted (iOS), resume waiting for ever: the first tap makes a new context, closes the old one, and its own sound plays", async () => {
    const first = last();
    FakeContext.hang = true;
    away("interrupted");
    await flush();
    expect(first.state).toBe("interrupted");
    FakeContext.hang = false;
    tap();
    expect(FakeContext.made).toHaveLength(2);
    expect(first.state).toBe("closed");
    // The tap's own sound starts on the new context as it wakes (its resume asked for in the same tap).
    expect(last().resumes).toBe(1);
    expect(last().started).toBe(1);
    await flush();
    expect(last().state).toBe("running");
    tap();
    expect(last().started).toBe(2);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("still suspended at the tap (its resume on the way back hung): a new one on that first tap", async () => {
    FakeContext.hang = true;
    away("suspended");
    FakeContext.hang = false;
    tap();
    expect(FakeContext.made).toHaveLength(2);
    expect(last().started).toBe(1);
  });

  it("closed: a new one on the first tap", () => {
    away("closed");
    tap();
    expect(FakeContext.made).toHaveLength(2);
    expect(last().started).toBe(1);
  });

  it("\"running\" with its clock stopped: a new one; running with its clock moving: kept", () => {
    away("running");
    tap(); // its currentTime never moved over the second since coming back
    expect(FakeContext.made).toHaveLength(2);
    const second = last();
    second.state = "running";
    away("running");
    second.currentTime += 1;
    tap();
    expect(FakeContext.made).toHaveLength(2);
    expect(second.state).toBe("running");
  });

  it("a tap too soon after coming back to judge a running context's clock waits for the next", () => {
    away("running");
    tap(50);
    expect(FakeContext.made).toHaveLength(1);
    tap(1000);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("the boss sounds are made again for the new context's sample rate", async () => {
    vi.useFakeTimers();
    try {
      const { soundCache } = await import("../src/characters/synth.ts");
      sound.warmSounds(["bigboyGiggle"]);
      await vi.runAllTimersAsync();
      const keys = () => [...soundCache("bigBoy").keys()];
      expect(keys().some((k) => k.endsWith("@48000"))).toBe(true);
      FakeContext.rate = 44100;
      FakeContext.hang = true;
      away("interrupted");
      FakeContext.hang = false;
      tap();
      expect(FakeContext.made).toHaveLength(2);
      await vi.runAllTimersAsync();
      expect(keys().some((k) => k.endsWith("@44100"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("nothing plays while the page is hidden, so nothing bursts out on the way back", () => {
    const first = last();
    visibility = "hidden";
    sound.play("tick");
    sound.play("tick");
    expect(first.started).toBe(0);
    visibility = "visible";
    sound.play("tick");
    expect(first.started).toBe(1);
  });

  it("never switched on before going away: the first tap switches it on as usual, one context", async () => {
    vi.resetModules();
    FakeContext.made = [];
    sound = await import("../src/sound.ts");
    sound.prepareAudio();
    // (No context yet: coming back does nothing.)
    docListeners.get("visibilitychange")?.();
    tap();
    expect(FakeContext.made).toHaveLength(1);
    await flush();
    expect(last().state).toBe("running");
  });
});
