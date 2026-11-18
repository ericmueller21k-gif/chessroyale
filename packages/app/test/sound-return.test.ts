/**
 * Sound coming back after the page was away (Eric, Nov 3, on his iPhone: "whenever I switch away and come back" the audio was
 * gone): sound.ts's `audioReturned` (visibilitychange, pageshow, focus) and `wakeAudio` (every tap and key), against a fake
 * AudioContext standing in for iOS's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type State = "suspended" | "running" | "interrupted" | "closed";
/** A node: what it's connected to (`to`). */
const node = (extra: object = {}) => {
  const n = { to: [] as unknown[], connect: (x: unknown) => (n.to.push(x), x), ...extra };
  return n;
};
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
  on = new Map<string, () => void>();
  addEventListener = (ev: string, fn: () => void) => this.on.set(ev, fn);
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
const winListeners = new Map<string, () => void>();
const deviceListeners = new Map<string, () => void>();
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
  winListeners.clear();
  deviceListeners.clear();
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (ev: string, fn: () => void) => docListeners.set(ev, fn),
  });
  vi.stubGlobal("addEventListener", (ev: string, fn: () => void) => winListeners.set(ev, fn));
  vi.stubGlobal("navigator", { mediaDevices: { addEventListener: (ev: string, fn: () => void) => deviceListeners.set(ev, fn) } });
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

describe("sound dying while the page stays (Eric, Nov 3: Timber chittered, then Alfil and the fight were silent for good)", () => {
  /** Eric's steps: a tap that plays (Timber's chitter), then iOS stops the context with the page on screen. */
  async function playedThenDies(state: State) {
    tap();
    expect(last().started).toBe(1);
    FakeContext.hang = true;
    last().state = state;
  }

  it("interrupted, resume waiting for ever: the next tap makes a new context and its own sound plays (Alfil's)", async () => {
    const first = last();
    await playedThenDies("interrupted");
    tap(3000);
    expect(FakeContext.made).toHaveLength(2);
    expect(first.state).toBe("closed");
    expect(last().started).toBe(1);
    expect((globalThis as { __soundLog: string[] }).__soundLog).toContain("audio:rebuilt");
    FakeContext.hang = false;
    last().resume();
    tap(3000);
    expect(last().started).toBe(2);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("suspended with its resume hanging: a new one on the next tap", async () => {
    await playedThenDies("suspended");
    tap(3000);
    expect(FakeContext.made).toHaveLength(2);
    expect(last().started).toBe(1);
  });

  it("closed: a new one on the next tap", async () => {
    await playedThenDies("closed");
    tap(3000);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("\"running\" with its clock stopped between two taps a second or more apart: a new one; its clock moving: kept", () => {
    tap();
    last().currentTime += 2;
    tap(2000); // moved 2 s in 2 s: alive
    expect(FakeContext.made).toHaveLength(1);
    tap(2000); // moved nothing in 2 s: dead
    expect(FakeContext.made).toHaveLength(2);
    expect(last().started).toBe(1);
  });

  it("taps less than a second apart don't judge the clock (a tap's pointerdown, touchend and click); a second on, it's judged", () => {
    tap();
    tap(300);
    tap(300);
    expect(FakeContext.made).toHaveLength(1);
    tap(500); // 1.1 s since the first, its clock still where it was
    expect(FakeContext.made).toHaveLength(2);
  });

  it("the taps' own time stamps are used: a test's fake clock jumping between taps doesn't make a new one", () => {
    const at = (ms: number) => ({ timeStamp: ms }) as Event;
    sound.wakeAudio(at(10_000));
    clock += 5000; // performance.now jumped (a fake clock); the device's clock moved 100 ms
    sound.wakeAudio(at(10_100));
    expect(FakeContext.made).toHaveLength(1);
  });

  it("never seen running (sound not switched on yet): a tap switches it on, no new context", async () => {
    vi.resetModules();
    FakeContext.made = [];
    sound = await import("../src/sound.ts");
    sound.prepareAudio();
    FakeContext.hang = true;
    tap();
    tap(3000);
    expect(FakeContext.made).toHaveLength(1);
  });

  it("at most one new context every 2 s while it keeps dying (iOS mid phone call)", async () => {
    await playedThenDies("interrupted");
    tap(3000);
    expect(FakeContext.made).toHaveLength(2);
    last().state = "running";
    tap(); // seen running
    last().state = "interrupted";
    tap(500);
    expect(FakeContext.made).toHaveLength(2);
    tap(2000);
    expect(FakeContext.made).toHaveLength(3);
  });
});

describe("the computer's sound changing under the page (Eric, Nov 3, Chrome: moved and resized the window, clicked over to another app and back: silent for good)", () => {
  /** Chrome's context after the device under it changed: "running", its clock moving, nothing coming out. */
  const tick = (ms: number) => {
    clock += ms;
    last().currentTime += ms / 1000;
  };
  /** The window loses focus with the page on screen, and gets it back `ms` later. */
  const otherApp = (ms: number) => {
    winListeners.get("blur")?.();
    tick(ms);
    winListeners.get("focus")?.();
  };
  const clickAt = (ms = 1000) => {
    tick(ms);
    sound.wakeAudio();
    sound.play("tick");
  };

  it("another app for 2 s or more: the next click makes a new context, closes the old one, and its own sound plays", async () => {
    const old = last();
    otherApp(5000);
    clickAt();
    expect(FakeContext.made).toHaveLength(2);
    expect(old.state).toBe("closed");
    await flush();
    expect(last().state).toBe("running");
    expect(last().started).toBe(1);
    clickAt(3000);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("a quick switch (under 2 s) keeps it", () => {
    otherApp(1500);
    clickAt();
    expect(FakeContext.made).toHaveLength(1);
  });

  it("hidden in between (a phone going to another app): the checks for coming back decide, as before", () => {
    winListeners.get("blur")?.();
    visibility = "hidden";
    docListeners.get("visibilitychange")?.();
    tick(5000);
    visibility = "visible";
    docListeners.get("visibilitychange")?.();
    winListeners.get("focus")?.();
    clickAt();
    expect(FakeContext.made).toHaveLength(1);
  });

  it("the audio devices change (headphones, another app opening the microphone) with the page staying: the next click makes a new one, once", () => {
    clickAt();
    deviceListeners.get("devicechange")?.();
    clickAt();
    expect(FakeContext.made).toHaveLength(2);
    clickAt(3000);
    expect(FakeContext.made).toHaveLength(2);
  });

  it("the context's own error: the next click makes a new one", () => {
    last().on.get("error")?.();
    clickAt();
    expect(FakeContext.made).toHaveLength(2);
  });

  it("a listener still using the old context (the music, fading out on it once the new one has taken over) keeps it open as long as it asks", async () => {
    const old = last();
    let heard: unknown = null;
    sound.onAudioRebuilt((o) => ((heard = o), 300));
    otherApp(5000);
    clickAt();
    expect(heard).toBe(old);
    expect(FakeContext.made).toHaveLength(2);
    expect(old.state).toBe("running");
    await new Promise((ok) => setTimeout(ok, 350));
    expect(old.state).toBe("closed");
  });

  it("before sound was ever switched on, a device change does nothing", async () => {
    vi.resetModules();
    FakeContext.made = [];
    deviceListeners.clear();
    sound = await import("../src/sound.ts");
    sound.prepareAudio();
    await new Promise((ok) => setTimeout(ok, 1100));
    deviceListeners.get("devicechange")?.();
    sound.wakeAudio();
    await flush();
    expect(FakeContext.made).toHaveLength(1);
  });
});

describe("the music's way out (Eric, Nov 14: \"it sounds much lower quality... we can't compromise on these songs\")", () => {
  it("its own gain, at the master's level, straight to the speakers: not through the game sounds' low-pass", () => {
    const c = last();
    const bus = sound.musicBus()! as unknown as { ctx: FakeContext; out: ReturnType<typeof node> & { gain: { value: number } } };
    expect(bus.ctx).toBe(c);
    expect(bus.out.to).toEqual([c.destination]);
    expect(bus.out.gain.value).toBe(0.9);
  });
  it("a new context: a new way out on it", () => {
    const first = sound.musicBus()!.out;
    last().on.get("error")?.();
    clock += 1000;
    sound.wakeAudio();
    const bus = sound.musicBus()! as unknown as { ctx: FakeContext; out: ReturnType<typeof node> };
    expect(bus.ctx).toBe(last());
    expect(bus.out).not.toBe(first);
    expect(bus.out.to).toEqual([last().destination]);
  });
});
