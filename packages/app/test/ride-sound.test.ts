import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RIDE_SOUND } from "@chessroyale/core";

// The audio graph, faked (as music.test.ts fakes it): what was started, and every move of the loop's gain and speed.
type Call = [string, ...number[]];
class FakeParam {
  value = 1;
  calls: Call[] = [];
  cancelScheduledValues(t: number) {
    this.calls.push(["cancel", t]);
  }
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(["ramp", v, t]);
  }
  /** The last ramp: [to, at]. */
  get lastRamp() {
    const r = this.calls.filter((c) => c[0] === "ramp").at(-1);
    return r ? [r[1], r[2]] : null;
  }
  /** The value it was set to as the last ramp began. */
  get lastFrom() {
    return this.calls.filter((c) => c[0] === "set").at(-1)?.[1];
  }
}
class FakeSource {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = new FakeParam();
  started: [number, number | undefined] | null = null;
  stopped = false;
  connect(g: FakeGain) {
    return g;
  }
  start(at: number, offset?: number) {
    this.started = [at, offset];
  }
  stop() {
    this.stopped = true;
  }
  disconnect() {}
}
class FakeGain {
  gain = new FakeParam();
  connect() {}
  disconnect() {}
}
const ctx = {
  /** The audio's clock (s): 10 s ahead of the page's (the fake timers' Date.now, ms), moving with it. */
  get currentTime() {
    return 10 + Date.now() / 1000;
  },
  state: "running" as AudioContextState,
  sources: [] as FakeSource[],
  gains: [] as FakeGain[],
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  },
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  },
};
const sound = vi.hoisted(() => ({ muted: false, hidden: false, mute: [] as (() => void)[], rebuilt: [] as (() => void)[], asked: [] as string[] }));
vi.mock("../src/sound.ts", () => ({
  isMuted: () => sound.muted,
  isPageHidden: () => sound.hidden,
  gameBus: () => ({ ctx, out: {} }),
  loadAudioFile: (url: string) => (sound.asked.push(url), Promise.resolve({ url })),
  onMuteChange: (fn: () => void) => (sound.mute.push(fn), () => undefined),
  onAudioRebuilt: (fn: () => void) => (sound.rebuilt.push(fn), () => undefined),
}));

const { rideMoving, rideSoundState, rideSoundForTests, warmRideSound, RIDE_LOOP } = await import("../src/ride-sound.ts");
const settle = () => new Promise((r) => setTimeout(r, 0));

const DOZER = RIDE_SOUND.rides["sawyer-dozer"]!;
const POGO = RIDE_SOUND.rides["boingo-pogo"]!;
const E = RIDE_SOUND.engine;
/** Time passing: the page's clock, the audio's and the timers together. */
const pass = (d: number) => vi.advanceTimersByTime(d);
/** Moving for `d` ms: a frame every 16 ms says so. */
const move = (id: string | null, d: number) => {
  for (let t = 0; t < d; t += 16) {
    rideMoving(id);
    pass(Math.min(16, d - t));
  }
};
const playing = () => ctx.sources.filter((s) => s.started && !s.stopped);

beforeEach(async () => {
  vi.useRealTimers();
  warmRideSound("sawyer-dozer");
  warmRideSound("boingo-pogo");
  await settle();
  vi.useFakeTimers({ now: 0 });
  rideSoundForTests(() => Date.now());
  ctx.sources = [];
  ctx.gains = [];
  sound.muted = sound.hidden = false;
});
afterEach(() => {
  rideSoundForTests(() => Date.now());
  vi.useRealTimers();
});

describe("a ride's moving sound", () => {
  it("each listed ride's loop is fetched once, from /sounds/rides/<id>.wav; a ride with no entry never is", () => {
    warmRideSound("riding-chirp");
    expect(sound.asked).toEqual(["/sounds/rides/sawyer-dozer.wav", "/sounds/rides/boingo-pogo.wav"]);
  });

  it("starts on the first moving frame: one source looping between 0.1 and 1.1 s, from 0.1; fades in over fadeInMs; an engine from startRate up to 1 over upMs", () => {
    rideMoving("sawyer-dozer");
    const [src] = playing();
    expect(playing()).toHaveLength(1);
    expect([src!.loop, src!.loopStart, src!.loopEnd, src!.started![1]]).toEqual([true, RIDE_LOOP.start, RIDE_LOOP.end, 0.1]);
    expect(src!.playbackRate.value).toBe(E.startRate);
    expect(src!.playbackRate.lastRamp![0]).toBe(1);
    expect(src!.playbackRate.lastRamp![1]).toBeCloseTo(10 + E.upMs / 1000, 6);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", up: true, live: 1, level: RIDE_SOUND.level, rate: 1 });
  });

  it("the pogo starts at its own speed (no ramp of its rate)", () => {
    rideMoving("boingo-pogo");
    const [src] = playing();
    expect(src!.playbackRate.value).toBe(1);
    expect(src!.playbackRate.calls).toEqual([]);
  });

  it("a ride with no entry, or on foot, stays silent", () => {
    move("riding-chirp", 300);
    move(null, 300);
    expect(ctx.sources).toEqual([]);
  });

  it("held through a 100 ms gap between steps: the same source, never faded, never a second one", () => {
    move("sawyer-dozer", 200);
    pass(100);
    move("sawyer-dozer", 200);
    expect(ctx.sources).toHaveLength(1);
    expect(rideSoundState().up).toBe(true);
  });

  it("stops holdMs after the last step: fades out over fadeOutMs, an engine sinking to stopRate; let go once silent", () => {
    move("sawyer-dozer", 400);
    const [src] = ctx.sources;
    pass(RIDE_SOUND.holdMs - 20);
    expect(rideSoundState().up).toBe(true);
    pass(40);
    expect(rideSoundState()).toMatchObject({ up: false, level: 0, rate: E.stopRate });
    const fadeAt = ctx.currentTime;
    const g = src!.playbackRate.lastRamp!;
    expect(g[0]).toBe(E.stopRate);
    expect(g[1]).toBeGreaterThan(fadeAt - 0.03 + DOZER.fadeOutMs / 1000 - 0.03);
    expect(src!.stopped).toBe(false);
    pass(DOZER.fadeOutMs + 60);
    expect(src!.stopped).toBe(true);
    expect(rideSoundState()).toMatchObject({ ride: null, live: 0 });
  });

  it("the pogo fades out over its own fadeOutMs", () => {
    move("boingo-pogo", 200);
    pass(RIDE_SOUND.holdMs + 20);
    pass(POGO.fadeOutMs - 10);
    expect(ctx.sources[0]!.stopped).toBe(false);
    pass(70);
    expect(ctx.sources[0]!.stopped).toBe(true);
  });

  it("moving again mid-fade: the same source comes back up from where it is (level and speed), never from silence", () => {
    move("sawyer-dozer", 1000); // (well up to speed)
    pass(RIDE_SOUND.holdMs + 10);
    const [src] = ctx.sources;
    // Halfway through the fade.
    pass(DOZER.fadeOutMs / 2);
    rideMoving("sawyer-dozer");
    expect(ctx.sources).toHaveLength(1);
    expect(src!.stopped).toBe(false);
    expect(rideSoundState()).toMatchObject({ up: true, live: 1, level: RIDE_SOUND.level, rate: 1 });
    // Its speed picked up from about halfway between 1 and stopRate, and back to 1 in the matching share of upMs.
    const from = src!.playbackRate.lastFrom as number;
    expect(from).toBeGreaterThan(E.stopRate + 0.01);
    expect(from).toBeLessThan(1 - 0.01);
    const [to, at] = src!.playbackRate.lastRamp!;
    expect(to).toBe(1);
    expect((at as number) - ctx.currentTime).toBeCloseTo(((1 - from) / (1 - E.startRate)) * (E.upMs / 1000), 6);
    // And it doesn't let go when the old fade would have ended.
    move("sawyer-dozer", DOZER.fadeOutMs);
    expect(src!.stopped).toBe(false);
    expect(ctx.sources).toHaveLength(1);
  });

  it("the gain comes back up from where the fade had it (about half way), not from 0, over fadeInMs", () => {
    move("boingo-pogo", 300);
    pass(RIDE_SOUND.holdMs + 10);
    const g = ctx.gains[0]!.gain;
    expect(g.lastRamp![0]).toBe(0);
    pass(POGO.fadeOutMs / 2);
    rideMoving("boingo-pogo");
    expect(g.lastFrom).toBeGreaterThan(RIDE_SOUND.level * 0.4);
    expect(g.lastFrom).toBeLessThan(RIDE_SOUND.level * 0.65);
    expect(g.lastRamp![0]).toBe(RIDE_SOUND.level);
    expect((g.lastRamp![1] as number) - ctx.currentTime).toBeCloseTo(POGO.fadeInMs / 1000, 6);
    expect(ctx.sources).toHaveLength(1);
  });

  it("the Sound switch off or the page hidden: out at once and let go; nothing starts again while it stays so", () => {
    move("sawyer-dozer", 200);
    sound.muted = true;
    sound.mute.forEach((f) => f());
    pass(100);
    expect(ctx.sources[0]!.stopped).toBe(true);
    move("sawyer-dozer", 200);
    expect(ctx.sources).toHaveLength(1);
    sound.muted = false;
    move("sawyer-dozer", 50);
    expect(ctx.sources).toHaveLength(2);
    expect(rideSoundState().live).toBe(1);
  });

  it("another ride: the old loop goes and the new one starts; one source at a time", () => {
    move("sawyer-dozer", 100);
    move("boingo-pogo", 100);
    expect(ctx.sources.map((s) => s.stopped)).toEqual([true, false]);
    expect(rideSoundState()).toMatchObject({ ride: "boingo-pogo", live: 1 });
  });

  it("a frame loop that halts mid-walk (the town closing, a hidden tab): it fades out all the same", () => {
    move("sawyer-dozer", 200);
    pass(RIDE_SOUND.holdMs + DOZER.fadeOutMs + 100);
    expect(rideSoundState()).toMatchObject({ ride: null, live: 0 });
  });
});
