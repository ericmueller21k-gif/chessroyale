import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RIDE_SOUND, type RideLoopSound, type RideStepSound } from "@chessroyale/core";

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
  started: [number, number | undefined, number | undefined] | null = null;
  stopped = false;
  stopAt: number | undefined;
  onended: (() => void) | null = null;
  connect(g: FakeGain) {
    return g;
  }
  start(at: number, offset?: number, duration?: number) {
    this.started = [at, offset, duration];
  }
  stop(at?: number) {
    this.stopped = true;
    this.stopAt = at;
  }
  disconnect() {}
}
class FakeGain {
  gain = new FakeParam();
  to: unknown = null;
  connect(out: unknown) {
    this.to = out;
  }
  disconnect() {}
}
const OUT = { out: true };
/** The unsoftened output (`gameBus(true)`): a bright ride's. */
const BRIGHT = { bright: true };
const ctx = {
  /** The audio's clock (s): 10 s ahead of the page's (the fake timers' Date.now, ms), moving with it. */
  get currentTime() {
    return 10 + Date.now() / 1000;
  },
  state: "running" as AudioContextState,
  sampleRate: 24000,
  sources: [] as FakeSource[],
  buffers: [] as { length: number; data: Float32Array }[],
  /** (A synth loop's buffer: Birdie's Train.) */
  createBuffer(_ch: number, length: number, rate: number) {
    const b = { length, rate, data: new Float32Array(length), getChannelData: () => b.data };
    this.buffers.push(b);
    return b;
  },
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
  gameBus: (unsoftened?: boolean) => ({ ctx, out: unsoftened ? BRIGHT : OUT }),
  loadAudioFile: (url: string) => (sound.asked.push(url), Promise.resolve({ url })),
  onMuteChange: (fn: () => void) => (sound.mute.push(fn), () => undefined),
  onAudioRebuilt: (fn: () => void) => (sound.rebuilt.push(fn), () => undefined),
}));

const { rideMoving, rideStep, rideHop, rideSoundId, rideSoundState, rideSoundForTests, warmRideSound, RIDE_LOOP, DECLICK_S } = await import("../src/ride-sound.ts");
const { BIRDIE_RIDE_LOOP, birdieSound } = await import("../src/characters/birdie-sounds.ts");
const { Walker } = await import("../src/town/world.ts");
const { RIDE_CELLS } = await import("../src/town/ride-cells.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");
const settle = () => new Promise((r) => setTimeout(r, 0));

const DOZER = RIDE_SOUND.rides["sawyer-dozer"] as RideLoopSound;
const POGO = RIDE_SOUND.rides["boingo-pogo"] as RideStepSound;
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
  warmRideSound("ginger-sled");
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
    expect(sound.asked).toEqual(["/sounds/rides/sawyer-dozer.wav", "/sounds/rides/boingo-pogo.wav", "/sounds/rides/ginger-sled.wav"]);
  });

  it("a hard start on the first moving frame: one source looping between 0.1 and 1.1 s, from 0.1, at full speed; full level in DECLICK_S", () => {
    rideMoving("sawyer-dozer");
    const [src] = playing();
    expect(playing()).toHaveLength(1);
    expect([src!.loop, src!.loopStart, src!.loopEnd, src!.started![1]]).toEqual([true, RIDE_LOOP.start, RIDE_LOOP.end, 0.1]);
    expect(src!.started![0]).toBe(ctx.currentTime);
    expect([src!.playbackRate.value, src!.playbackRate.calls]).toEqual([DOZER.rate, []]);
    expect(ctx.gains[0]!.gain.calls).toEqual([
      ["set", 0, 10],
      ["ramp", RIDE_SOUND.level, 10 + DECLICK_S],
    ]);
    expect(DECLICK_S).toBeLessThanOrEqual(0.03);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1, level: RIDE_SOUND.level, rate: DOZER.rate });
  });

  it("a ride with no entry, or on foot, stays silent", () => {
    move("riding-chirp", 300);
    move(null, 300);
    expect(ctx.sources).toEqual([]);
  });

  it("held through a 100 ms gap between steps: the same source, never stopped, never a second one", () => {
    move("sawyer-dozer", 200);
    pass(100);
    move("sawyer-dozer", 200);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.stopped).toBe(false);
    expect(ctx.gains[0]!.gain.calls).toHaveLength(2);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1 });
  });

  it("a hard stop holdMs after the last step: down from full level in DECLICK_S and stopped then, at full speed to the end", () => {
    move("sawyer-dozer", 400);
    const [src] = ctx.sources;
    const g = ctx.gains[0]!.gain;
    pass(RIDE_SOUND.holdMs - 20);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1 });
    expect(src!.stopped).toBe(false);
    pass(40);
    expect(rideSoundState()).toMatchObject({ ride: null, live: 0, level: 0 });
    expect(src!.stopped).toBe(true);
    // (From full level where it stopped, holdMs after the last moving frame at 384 ms, to 0 DECLICK_S later.)
    const t = 10 + (384 + RIDE_SOUND.holdMs) / 1000;
    expect(g.calls.slice(2)).toEqual([
      ["cancel", t],
      ["set", RIDE_SOUND.level, t],
      ["ramp", 0, t + DECLICK_S],
    ]);
    expect(src!.stopAt).toBe(t + DECLICK_S);
    expect(src!.playbackRate.calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("moving again once stopped: a new source, at full level and speed from its first frame (no comeback from a fade)", () => {
    move("sawyer-dozer", 300);
    pass(RIDE_SOUND.holdMs + 10);
    pass(100);
    rideMoving("sawyer-dozer");
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0]!.stopped).toBe(true);
    expect(playing()).toEqual([ctx.sources[1]]);
    expect(ctx.sources[1]!.playbackRate.value).toBe(DOZER.rate);
    expect(ctx.gains[1]!.gain.lastRamp).toEqual([RIDE_SOUND.level, ctx.currentTime + DECLICK_S]);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1 });
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

  it("the pogo's moving frames never start a loop (it plays by steps: below); off the dozer onto it, the dozer's loop stops as standing", () => {
    move("boingo-pogo", 300);
    expect(ctx.sources).toEqual([]);
    move("sawyer-dozer", 100);
    move("boingo-pogo", RIDE_SOUND.holdMs + 100);
    expect(ctx.sources).toHaveLength(1);
    expect(rideSoundState()).toMatchObject({ ride: null, live: 0, boings: 0 });
  });

  it("the sled's bells play round the softening (bright: gameBus(true)); the dozer's engine through it", () => {
    move("ginger-sled", 100);
    expect(playing()).toHaveLength(1);
    expect(ctx.gains.at(-1)!.to).toBe(BRIGHT);
    move("sawyer-dozer", 100);
    expect(ctx.gains.at(-1)!.to).toBe(OUT);
    // (Straight from one to the other: the sled's stops as the dozer's starts.)
    expect(playing()).toHaveLength(1);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1 });
  });
  it("Birdie's Train (Nov 23): his own train run made in code on its first move, no file fetched; it loops seamless where his sounds say", () => {
    const asked = sound.asked.length;
    rideMoving("birdie-train");
    expect(sound.asked.length, "no file").toBe(asked);
    const [src] = playing();
    expect(playing()).toHaveLength(1);
    expect([src!.loop, src!.loopStart, src!.loopEnd, src!.started![1], src!.playbackRate.value]).toEqual([true, BIRDIE_RIDE_LOOP.start, BIRDIE_RIDE_LOOP.end, BIRDIE_RIDE_LOOP.start, 1]);
    expect(ctx.gains.at(-1)!.to).toBe(OUT);
    // (The buffer: the medium run's samples at the context's rate, room to the loop's end, silent at both ends of the loop.)
    const buf = ctx.buffers.at(-1)!;
    const run = birdieSound(BIRDIE_RIDE_LOOP.run, ctx.sampleRate);
    expect(src!.buffer).toBe(buf);
    expect(buf.length).toBeGreaterThan(BIRDIE_RIDE_LOOP.end * ctx.sampleRate);
    expect(Array.from(buf.data.subarray(0, run.length))).toEqual(Array.from(run));
    const near = (t: number) => Math.max(...Array.from(buf.data.subarray(Math.round(t * ctx.sampleRate) - 48, Math.round(t * ctx.sampleRate) + 1), Math.abs));
    expect(near(BIRDIE_RIDE_LOOP.start), "silent into the loop's start").toBeLessThan(1e-3);
    expect(near(BIRDIE_RIDE_LOOP.end), "silent into its end").toBeLessThan(1e-3);
    // (Made once: moving again, and a warm, reuse it.)
    pass(RIDE_SOUND.holdMs + 20);
    warmRideSound("birdie-train");
    move("birdie-train", 50);
    expect(ctx.buffers.filter((b) => b.length === buf.length)).toHaveLength(1);
    expect(rideSoundState()).toMatchObject({ ride: "birdie-train", live: 1, decoded: expect.arrayContaining(["birdie-train"]) });
  });

  it("a frame loop that halts mid-walk (the town closing, a hidden tab): it stops all the same", () => {
    move("sawyer-dozer", 200);
    pass(RIDE_SOUND.holdMs + 20);
    expect(rideSoundState()).toMatchObject({ ride: null, live: 0 });
  });
});

describe("the pogo's boings: one a step, on the hop (Eric, Nov 15: \"from one square to the next, it should be a boing\")", () => {
  const STEP = TOWN_FEEL.youStepMs;
  const started = () => ctx.sources.filter((s) => s.started);
  /** A step event now (the walker's `onStep`), on the pogo unless told. */
  const step = (id: string | null = "boingo-pogo", at = Date.now()) => rideStep(id, at, STEP);
  /** Steps one after another, a step's time apart, as a walk's are. */
  const walk = (n: number, id: string | null = "boingo-pogo") => {
    for (let i = 0; i < n; i++) {
      step(id);
      pass(STEP);
    }
  };
  /** The drawn move frame `t` (0 to 1) through a step, as rides.ts `moveIndex`, and its lift (< 0: off the ground). */
  const lift = (t: number) => {
    const m = RIDE_CELLS["boingo-pogo"]!.side.move;
    const total = m.reduce((x, r) => x + r[0]!, 0);
    let end = 0;
    for (const r of m) if (t < (end += r[0]!) / total) return r[5]!;
    return m.at(-1)![5]!;
  };

  it("its moment is the drawn hop's: take-off the first frame off the ground, landing the first back on it", () => {
    const up = rideHop("boingo-pogo", "takeoff");
    const down = rideHop("boingo-pogo", "landing");
    expect([lift(up - 1e-6), lift(up) < 0]).toEqual([0, true]);
    expect([lift(down - 1e-6) < 0, lift(down)]).toEqual([true, 0]);
    expect(up).toBeLessThan(down);
    expect(POGO.on).toBe("takeoff");
  });

  it("the first step: its boing's source made and started on that step's event, at the take-off, no fade and no timer", () => {
    step();
    expect(started()).toHaveLength(1);
    const [src] = started();
    expect(src!.started![0]).toBeCloseTo(ctx.currentTime + (rideHop("boingo-pogo", "takeoff") * STEP) / 1000, 6);
    expect([src!.started![1], src!.started![2], src!.loop]).toEqual([POGO.boings[0], POGO.lengthS, false]);
    expect(ctx.gains[0]!.gain.value).toBe(POGO.level);
    expect(ctx.gains[0]!.gain.calls).toEqual([]);
    expect(ctx.gains[0]!.to).toBe(OUT);
    expect(vi.getTimerCount()).toBe(0);
    expect(rideSoundState()).toMatchObject({ boings: 1, boingsLive: 1, ride: null, live: 0 });
  });

  it("a step from a late frame (its take-off already past) plays at once", () => {
    step("boingo-pogo", Date.now() - STEP);
    expect(started()[0]!.started![0]).toBe(ctx.currentTime);
  });

  it("one boing a step, through the 4 in turn (a, b, c, d, a ...), each its own source, a step apart on the audio clock", () => {
    const t0 = ctx.currentTime;
    walk(6);
    const all = started();
    expect(all.map((s) => s.started![1])).toEqual([...POGO.boings, POGO.boings[0], POGO.boings[1]]);
    all.forEach((s, i) => expect(s.started![0]).toBeCloseTo(t0 + (i * STEP) / 1000 + (rideHop("boingo-pogo", "takeoff") * STEP) / 1000, 6));
    expect(new Set(all).size).toBe(6);
  });

  it("they overlap: a new boing never stops the last; each lets go as it ends", () => {
    walk(4);
    expect(ctx.sources.some((s) => s.stopped)).toBe(false);
    expect(rideSoundState().boingsLive).toBe(4);
    ctx.sources[0]!.onended!();
    expect(rideSoundState()).toMatchObject({ boings: 4, boingsLive: 3 });
  });

  it("a tap's 2 squares on your walker: 2 boings, a step apart; standing, none", () => {
    const w = new Walker({ c: 3, r: 3 }, STEP, true, TOWN_FEEL.walkEase);
    w.onStep = (t0, ms) => rideStep("boingo-pogo", t0, ms);
    const frames = (d: number) => {
      for (let t = 0; t < d; t += 16) {
        w.update(Date.now());
        pass(16);
      }
    };
    frames(200);
    expect(ctx.sources).toEqual([]);
    w.go([{ c: 4, r: 3 }, { c: 5, r: 3 }]);
    frames(600);
    const all = started();
    expect(all).toHaveLength(2);
    expect(all[1]!.started![0] - all[0]!.started![0]).toBeCloseTo(STEP / 1000, 2);
    expect(w.moving()).toBe(false);
  });

  it("on foot, another ride (the dozer's loop is by frames, not steps) or one with no sound: no boing", () => {
    walk(3, null);
    walk(3, "sawyer-dozer");
    walk(3, "riding-chirp");
    expect(ctx.sources).toEqual([]);
  });

  it("the Sound switch off or the page hidden: no boing", () => {
    sound.muted = true;
    walk(2);
    sound.muted = false;
    sound.hidden = true;
    walk(2);
    expect(ctx.sources).toEqual([]);
    sound.hidden = false;
    walk(1);
    expect(started()).toHaveLength(1);
  });

  it("the dozer is as it was: its loop by moving frames, untouched by the pogo's steps", () => {
    walk(2);
    move("sawyer-dozer", 100);
    const loop = ctx.sources.filter((s) => s.loop);
    expect(loop).toHaveLength(1);
    expect([loop[0]!.loopStart, loop[0]!.loopEnd, loop[0]!.playbackRate.value]).toEqual([RIDE_LOOP.start, RIDE_LOOP.end, DOZER.rate]);
    expect(rideSoundState()).toMatchObject({ ride: "sawyer-dozer", live: 1, boings: 2 });
  });
});

describe("a ride's HunChess colorway sounds as its ride (Eric, Nov 22: the gold pogo had no boing)", () => {
  it("every ride with a sound: its -hunchess item maps to it, and items with no colorway keep their own id", () => {
    for (const id of Object.keys(RIDE_SOUND.rides)) expect(rideSoundId(`${id}-hunchess`), id).toBe(id);
    expect(rideSoundId("boingo-pogo")).toBe("boingo-pogo");
    expect(rideSoundId(null)).toBeNull();
  });

  it("the gold pogo boings on each step, from the pogo's own file (nothing new fetched)", () => {
    const asked = sound.asked.length;
    warmRideSound("boingo-pogo-hunchess");
    rideStep("boingo-pogo-hunchess", Date.now(), TOWN_FEEL.youStepMs);
    const started = ctx.sources.filter((s) => s.started);
    expect(started).toHaveLength(1);
    expect([started[0]!.started![1], started[0]!.started![2]]).toEqual([POGO.boings[0], POGO.lengthS]);
    expect(sound.asked.length).toBe(asked);
  });

  it("the gold dozer's loop plays while it moves, as the dozer's", () => {
    move("sawyer-dozer-hunchess", 100);
    expect(playing()).toHaveLength(1);
  });
});
