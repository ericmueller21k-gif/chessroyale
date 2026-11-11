import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUSIC } from "@chessroyale/core";

// The audio graph, faked: what was started where, and every move of the music's gain.
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
    this.value = v;
  }
  /** The last ramp: [to, at]. */
  get lastRamp() {
    const r = this.calls.filter((c) => c[0] === "ramp").at(-1);
    return r ? [r[1], r[2]] : null;
  }
}
class FakeSource {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started: [number, number | undefined] | null = null;
  stoppedAt: number | null = null;
  connect() {}
  start(at: number, offset?: number) {
    this.started = [at, offset];
  }
  stop(at: number) {
    this.stoppedAt = at;
  }
}
class FakeGain {
  gain = new FakeParam();
  connected = false;
  connect() {
    this.connected = true;
  }
  disconnect() {}
}
const ctx = {
  currentTime: 10,
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
const files: string[] = [];
const forgot: string[] = [];
const sound = vi.hoisted(() => ({ muted: false, hidden: false, muteListeners: [] as (() => void)[] }));
vi.mock("../src/sound.ts", () => ({
  isMuted: () => sound.muted,
  isPageHidden: () => sound.hidden,
  musicBus: () => ({ ctx, master: {} }),
  loadAudioFile: (url: string) => (files.push(url), Promise.resolve({ url })),
  forgetAudioFile: (url: string) => void forgot.push(url),
  onAudioRebuilt: () => () => undefined,
  onMuteChange: (fn: () => void) => (sound.muteListeners.push(fn), () => undefined),
}));

const THEMES = {
  pad: 0.5,
  themes: {
    grex: { intro: "grex-intro", loop: "grex-loop", introSeconds: 6.666667, loopSeconds: 113.333333 },
    bigboy: { intro: null, loop: "bigboy-loop", introSeconds: 0, loopSeconds: 60 },
  },
};
let themesAsked = 0;
vi.stubGlobal("fetch", (url: string) => {
  if (url === "/music/themes.json") themesAsked++;
  return Promise.resolve({ ok: true, json: () => Promise.resolve(THEMES) });
});

const { bossMusic, musicLevel, musicNow, musicPlan, setMusicOn } = await import("../src/music.ts");
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the plan from themes.json", () => {
  it("the intro at t0, the loop at t0 + introSeconds from the pad, looping between pad and pad + loopSeconds", () => {
    expect(musicPlan(THEMES, "grex", 3)).toEqual({
      intro: { name: "grex-intro", at: 3 },
      loop: { name: "grex-loop", at: 3 + 6.666667, offset: 0.5, loopStart: 0.5, loopEnd: 0.5 + 113.333333 },
    });
  });
  it("lengths come from the file: a longer version is played at its own lengths", () => {
    const longer = { pad: 0.25, themes: { grex: { ...THEMES.themes.grex, introSeconds: 8, loopSeconds: 240 } } };
    expect(musicPlan(longer, "grex", 0)?.loop).toEqual({ name: "grex-loop", at: 8, offset: 0.25, loopStart: 0.25, loopEnd: 240.25 });
  });
  it("a theme with no intro is the loop alone, from t0", () => {
    expect(musicPlan(THEMES, "bigboy", 2)).toEqual({ intro: null, loop: { name: "bigboy-loop", at: 2, offset: 0.5, loopStart: 0.5, loopEnd: 60.5 } });
  });
  it("the loop picked up again (a new audio context) skips the intro", () => {
    expect(musicPlan(THEMES, "grex", 4, true)?.intro).toBeNull();
    expect(musicPlan(THEMES, "grex", 4, true)?.loop.at).toBe(4);
  });
  it("a boss with no theme, or no themes at all, is nothing", () => {
    expect(musicPlan(THEMES, "gingerbread", 0)).toBeNull();
    expect(musicPlan(null, "grex", 0)).toBeNull();
    expect(musicPlan({ pad: 0.5, themes: { x: { intro: null, loop: "x", introSeconds: 0, loopSeconds: 0 } } }, "x", 0)).toBeNull();
  });
  it("the level: MUSIC.volume, nothing with Music or Sound off or the page hidden", () => {
    expect(musicLevel(true, false, false)).toBe(MUSIC.volume);
    expect(musicLevel(false, false, false)).toBe(0);
    expect(musicLevel(true, true, false)).toBe(0);
    expect(musicLevel(true, false, true)).toBe(0);
  });
});

describe("the player through a battle", () => {
  let key = 0;
  const battle = (boss: string, live: boolean, k = key) => bossMusic({ key: k, boss, live });
  beforeEach(() => {
    key++;
    ctx.sources = [];
    ctx.gains = [];
    files.length = 0;
    sound.muted = false;
    sound.hidden = false;
    setMusicOn(true);
  });
  afterEach(() => bossMusic(null));

  it("fetches the theme when the battle is picked, starts nothing until it starts, then the intro and the loop", async () => {
    battle("grex", false);
    await settle();
    expect(files).toEqual(["/music/grex-intro.mp3", "/music/grex-loop.mp3"]);
    expect(ctx.sources).toHaveLength(0);
    ctx.currentTime = 20;
    battle("grex", true);
    await settle();
    const [intro, loop] = ctx.sources;
    const t0 = 20 + MUSIC.startDelayS;
    expect(intro!.started).toEqual([t0, undefined]);
    expect(intro!.loop).toBe(false);
    expect(loop!.started![0]).toBeCloseTo(t0 + 6.666667, 6);
    expect(loop!.started![1]).toBe(0.5);
    expect([loop!.loop, loop!.loopStart, loop!.loopEnd]).toEqual([true, 0.5, 0.5 + 113.333333]);
    expect(ctx.gains[0]!.gain.value).toBe(MUSIC.volume);
    expect(musicNow()).toEqual({ boss: "grex", level: MUSIC.volume });
    // (The same battle on the next render: nothing new.)
    battle("grex", true);
    await settle();
    expect(ctx.sources).toHaveLength(2);
  });

  it("a boss with no theme plays nothing, without error", async () => {
    battle("gingerbread", false);
    battle("gingerbread", true);
    await settle();
    expect(files).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
    expect(musicNow()).toBeNull();
  });

  it("a loop-only theme starts its loop at once", async () => {
    battle("bigboy", true);
    await settle();
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.started).toEqual([ctx.currentTime + MUSIC.startDelayS, 0.5]);
  });

  it("the result fades it out over endFadeMs and stops it there", async () => {
    battle("grex", true);
    await settle();
    ctx.currentTime = 50;
    bossMusic(null);
    const g = ctx.gains[0]!.gain;
    expect(g.lastRamp).toEqual([0, 50 + MUSIC.endFadeMs / 1000]);
    for (const s of ctx.sources) expect(s.stoppedAt).toBe(50 + MUSIC.endFadeMs / 1000);
    expect(musicNow()).toBeNull();
  });

  it("after the result's fade, the theme's decoded audio is let go (one boss's in memory at a time), unless its boss is fought again", async () => {
    vi.useFakeTimers();
    try {
      forgot.length = 0;
      battle("grex", true);
      await vi.advanceTimersByTimeAsync(0);
      bossMusic(null);
      await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
      expect(forgot.sort()).toEqual(["/music/grex-intro.mp3", "/music/grex-loop.mp3"]);
      // A rematch against the same boss before the fade is done keeps it.
      forgot.length = 0;
      battle("grex", true);
      await vi.advanceTimersByTimeAsync(0);
      bossMusic(null);
      battle("grex", false, key + 500);
      await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
      expect(forgot).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("another battle ends the last one's music", async () => {
    battle("grex", true);
    await settle();
    battle("grex", true, key + 1000);
    await settle();
    expect(ctx.sources.slice(0, 2).every((s) => s.stoppedAt !== null)).toBe(true);
    expect(ctx.sources).toHaveLength(4);
  });

  it("Music off fades to nothing within fadeMs, the loop keeping its place; on again fades back", async () => {
    battle("grex", true);
    await settle();
    ctx.currentTime = 30;
    setMusicOn(false);
    const g = ctx.gains[0]!.gain;
    expect(g.lastRamp).toEqual([0, 30 + MUSIC.fadeMs / 1000]);
    expect(ctx.sources.every((s) => s.stoppedAt === null)).toBe(true);
    setMusicOn(true);
    expect(g.lastRamp![0]).toBe(MUSIC.volume);
    expect(ctx.sources).toHaveLength(2);
  });

  it("Sound off silences it too", async () => {
    battle("grex", true);
    await settle();
    sound.muted = true;
    sound.muteListeners.forEach((l) => l());
    expect(ctx.gains[0]!.gain.lastRamp![0]).toBe(0);
  });

  it("Music off from the start: nothing fetched; switched on mid-battle, it starts from its intro", async () => {
    setMusicOn(false);
    battle("grex", false);
    battle("grex", true);
    await settle();
    expect(files).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
    setMusicOn(true);
    await settle();
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0]!.loop).toBe(false);
  });

  it("the themes file is read once a visit", () => {
    expect(themesAsked).toBe(1);
  });
});
