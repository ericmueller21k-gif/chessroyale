import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUSIC, MUSIC_SWITCH, RECLUSE_MUSIC } from "@chessroyale/core";

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
// (Decoded buffers kept as sound.ts keeps them, until forgotten: `fetched` lists the misses, each a real fetch and decode.)
const bufs = new Map<string, { url: string }>();
const fetched: string[] = [];
/** (Set: an intro's decode waits for it.) */
const gate = { intro: null as Promise<void> | null };
const sound = vi.hoisted(() => ({ muted: false, hidden: false, muteListeners: [] as (() => void)[] }));
vi.mock("../src/sound.ts", () => ({
  isMuted: () => sound.muted,
  isPageHidden: () => sound.hidden,
  musicBus: () => ({ ctx, master: {} }),
  loadAudioFile: (url: string) => {
    files.push(url);
    if (!bufs.has(url)) (fetched.push(url), bufs.set(url, { url }));
    const buf = bufs.get(url)!;
    return gate.intro && url.endsWith("-intro.mp3") ? gate.intro.then(() => buf) : Promise.resolve(buf);
  },
  forgetAudioFile: (url: string) => void (forgot.push(url), bufs.delete(url)),
  onAudioRebuilt: () => () => undefined,
  onMuteChange: (fn: () => void) => (sound.muteListeners.push(fn), () => undefined),
}));

const THEMES = {
  pad: 0.5,
  themes: {
    grex: { intro: "grex-intro", loop: "grex-loop", introSeconds: 6.666667, loopSeconds: 113.333333 },
    bigboy: { intro: null, loop: "bigboy-loop", introSeconds: 0, loopSeconds: 60 },
    zebra: { intro: "zebra-intro", loop: "zebra-loop", introSeconds: 4, loopSeconds: 100 },
    // (The Hidden Boss's, as the handoff has them, Nov 13.)
    "recluse-house": { intro: null, loop: "recluse-house-loop", introSeconds: 0, loopSeconds: 60 },
    "recluse-phase2": { intro: "recluse-phase2-intro", loop: "recluse-phase2-loop", introSeconds: 58.869625, loopSeconds: 89.275563 },
    "recluse-beaten": { intro: "recluse-beaten-intro", loop: "recluse-house-loop", introSeconds: 1.815, loopSeconds: 60 },
    "recluse-phase3": { intro: "recluse-phase3-intro", loop: "recluse-phase3-loop", introSeconds: 19.29325, loopSeconds: 88.371021 },
  },
};
let themesAsked = 0;
/** The pieces fetched by the town's loading (preloadMusic: fetched, not decoded), and the ones to fail once. */
const preFetched: string[] = [];
const failOnce = new Set<string>();
vi.stubGlobal("fetch", (url: string) => {
  if (url === "/music/themes.json") themesAsked++;
  if (url.endsWith(".mp3")) {
    preFetched.push(url);
    if (failOnce.delete(url)) return Promise.resolve({ ok: false, status: 503 });
    return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(THEMES) });
});

const { bossMusic, loopPlace, musicFiles, musicLevel, musicNow, musicPlan, musicTheme, musicWanted, preloadMusic, recluseMusic, roomMusic, roomMusicLoad, roomMusicNow, setMusicOn, splashDone, splashMusic, switchPlan, heardNow } = await import(
  "../src/music.ts"
);
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

describe("the town's loading bar (Nov 12: every theme fetched, none decoded)", () => {
  const ALL = ["/music/grex-intro.mp3", "/music/grex-loop.mp3", "/music/bigboy-loop.mp3", "/music/zebra-intro.mp3", "/music/zebra-loop.mp3"];
  beforeEach(() => {
    preFetched.length = 0;
    files.length = 0;
    sound.muted = false;
    setMusicOn(true);
  });

  it("every theme's pieces, each once; the town's loading leaves the Hidden Boss's out (fetched as his fight starts)", () => {
    const his = ["/music/recluse-house-loop.mp3", "/music/recluse-phase2-intro.mp3", "/music/recluse-phase2-loop.mp3", "/music/recluse-beaten-intro.mp3", "/music/recluse-phase3-intro.mp3", "/music/recluse-phase3-loop.mp3"];
    expect(musicFiles(THEMES)).toEqual([...ALL, ...his]);
    expect(musicFiles(THEMES, Object.values(RECLUSE_MUSIC))).toEqual(ALL);
  });
  it("Music off or Sound off: nothing fetched (and no music step)", async () => {
    setMusicOn(false);
    expect(musicWanted()).toBe(false);
    await preloadMusic();
    sound.muted = true;
    setMusicOn(true);
    expect(musicWanted()).toBe(false);
    await preloadMusic();
    expect(preFetched).toEqual([]);
  });
  it("fetches every piece once, decodes none, the share rising to 1; a failed piece is fetched again next time, the rest not", async () => {
    failOnce.add("/music/bigboy-loop.mp3");
    const shares: number[] = [];
    await preloadMusic((s) => shares.push(s));
    expect(preFetched.sort()).toEqual([...ALL].sort());
    expect(files, "nothing decoded").toEqual([]);
    expect(shares).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
    preFetched.length = 0;
    await preloadMusic();
    expect(preFetched).toEqual(["/music/bigboy-loop.mp3"]);
    preFetched.length = 0;
    await preloadMusic();
    expect(preFetched).toEqual([]);
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

// Eric, Nov 11: "add their music to the room, it loads when you walk in, then it will also be loaded already when the fight starts,
// but to be clear, only play the music if you walk in on your own through the door, not via challenging the boss." Town.tsx calls
// roomMusicLoad as the door zooms (walked in only), roomMusic(boss) as the room shows (walked in only), roomMusic(null) leaving.
describe("a boss's room", () => {
  beforeEach(() => {
    ctx.sources = [];
    ctx.gains = [];
    files.length = 0;
    fetched.length = 0;
    forgot.length = 0;
    bufs.clear();
    sound.muted = false;
    sound.hidden = false;
    setMusicOn(true);
  });
  afterEach(() => {
    roomMusic(null);
    splashDone();
    bossMusic(null);
  });

  it("walked in through the door: loads as the door zooms, plays its intro then its loop as the room shows", async () => {
    roomMusicLoad("zebra");
    await settle();
    expect(fetched).toEqual(["/music/zebra-intro.mp3", "/music/zebra-loop.mp3"]);
    expect(ctx.sources).toHaveLength(0);
    ctx.currentTime = 40;
    roomMusic("zebra");
    await settle();
    const [intro, loop] = ctx.sources;
    expect(intro!.started).toEqual([40 + MUSIC.startDelayS, undefined]);
    expect(loop!.started![0]).toBeCloseTo(40 + MUSIC.startDelayS + 4, 6);
    expect(loop!.loop).toBe(true);
    expect(roomMusicNow()).toEqual({ boss: "zebra", level: MUSIC.volume });
    expect(fetched).toHaveLength(2);
  });

  it("arriving by a challenge (no roomMusic call): nothing plays in the room; the battle's music as before", async () => {
    bossMusic({ key: "via-challenge", boss: "grex", live: false });
    await settle();
    expect(ctx.sources).toHaveLength(0);
    expect(roomMusicNow()).toBeNull();
    bossMusic({ key: "via-challenge", boss: "grex", live: true });
    await settle();
    expect(musicNow()?.boss).toBe("grex");
    expect(roomMusicNow()).toBeNull();
  });

  it("Rolling Dough's door between rooms: the same boss again carries on, no restart", async () => {
    roomMusic("zebra");
    await settle();
    roomMusic("zebra");
    roomMusic("zebra");
    await settle();
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources.every((s) => s.stoppedAt === null)).toBe(true);
  });

  it("leaving fades it out over endFadeMs and stops it; its theme is let go after the fade", async () => {
    vi.useFakeTimers();
    try {
      roomMusic("zebra");
      await vi.advanceTimersByTimeAsync(0);
      ctx.currentTime = 70;
      roomMusic(null);
      expect(ctx.gains[0]!.gain.lastRamp).toEqual([0, 70 + MUSIC.endFadeMs / 1000]);
      for (const s of ctx.sources) expect(s.stoppedAt).toBe(70 + MUSIC.endFadeMs / 1000);
      expect(roomMusicNow()).toBeNull();
      await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
      expect(forgot.sort()).toEqual(["/music/zebra-intro.mp3", "/music/zebra-loop.mp3"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Don Dough: challenged from his room, the room's theme carries straight through the splash and the battle (no restart, no second fetch)", async () => {
    vi.useFakeTimers();
    try {
      roomMusicLoad("zebra");
      roomMusic("zebra");
      await vi.advanceTimersByTimeAsync(0);
      const started = ctx.sources.length;
      await splashMusic("zebra");
      expect(roomMusicNow()).toBeNull();
      bossMusic({ key: "don", boss: "zebra", live: false });
      bossMusic({ key: "don", boss: "zebra", live: true });
      splashDone();
      await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
      expect(ctx.sources).toHaveLength(started);
      expect(ctx.sources.every((s) => s.stoppedAt === null)).toBe(true);
      expect(musicNow()?.boss).toBe("zebra");
      expect(fetched).toEqual(["/music/zebra-intro.mp3", "/music/zebra-loop.mp3"]);
      expect(forgot).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a challenge from the town (Eric, Nov 11): the theme starts as the splash starts, from its intro; the battle carries it on, no restart at START", async () => {
    roomMusicLoad("grex");
    await settle();
    expect(ctx.sources).toHaveLength(0);
    ctx.currentTime = 100;
    await splashMusic("grex");
    const [intro, loop] = ctx.sources;
    expect(intro!.started).toEqual([100 + MUSIC.startDelayS, undefined]);
    expect(loop!.loop).toBe(true);
    bossMusic({ key: "town-fight", boss: "grex", live: false });
    splashDone();
    bossMusic({ key: "town-fight", boss: "grex", live: true });
    await settle();
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources.every((s) => s.stoppedAt === null)).toBe(true);
    expect(musicNow()?.boss).toBe("grex");
  });

  it("a splash whose battle never comes (called off): its music fades out and stops once the splash is gone", async () => {
    await splashMusic("grex");
    ctx.currentTime = 120;
    splashDone();
    for (const s of ctx.sources) expect(s.stoppedAt).toBe(120 + MUSIC.endFadeMs / 1000);
    expect(musicNow()).toBeNull();
  });

  it("the battle from the menu (no splash): started after its intro, as before", async () => {
    bossMusic({ key: "menu", boss: "grex", live: false });
    await settle();
    expect(ctx.sources).toHaveLength(0);
    bossMusic({ key: "menu", boss: "grex", live: true });
    await settle();
    expect(ctx.sources).toHaveLength(2);
  });

  it("the intro is decoded first, then the loop", async () => {
    let open = () => {};
    gate.intro = new Promise((ok) => (open = ok));
    try {
      roomMusicLoad("zebra");
      await settle();
      // (The loop isn't asked for until the intro is in.)
      expect(files).toEqual(["/music/zebra-intro.mp3"]);
      open();
      await settle();
      expect(files).toEqual(["/music/zebra-intro.mp3", "/music/zebra-loop.mp3"]);
    } finally {
      gate.intro = null;
    }
  });

  it("a boss without a theme: nothing", async () => {
    roomMusicLoad("gingerbread");
    roomMusic("gingerbread");
    await settle();
    expect(files).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
  });

  it("Music off or Sound off: nothing fetched, nothing plays; Music on again starts it", async () => {
    setMusicOn(false);
    roomMusicLoad("zebra");
    roomMusic("zebra");
    await settle();
    expect(files).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
    setMusicOn(true);
    await settle();
    expect(roomMusicNow()?.boss).toBe("zebra");
    sound.muted = true;
    sound.muteListeners.forEach((l) => l());
    expect(ctx.gains[0]!.gain.lastRamp![0]).toBe(0);
  });
});

describe("the Hidden Boss: a theme for each point of his fight, switched mid-fight (Nov 13)", () => {
  const H = RECLUSE_MUSIC;
  const boss = (o: object = {}) => ({ kind: "boss", boss: {} as never, until: 0, ...o }) as const;
  it("which theme when: his adult form's from the start; beaten, with the phase change next, his beaten theme; the phase change and phase 2, the transformation's, its drop on the split; the result, none", () => {
    expect(recluseMusic(boss({ intro: true }), false, false)).toEqual({ theme: H.adult });
    expect(recluseMusic({ kind: "play" } as never, false, false)).toEqual({ theme: H.adult });
    // (The transformation's decoded now, ready before the phase change.)
    expect(recluseMusic(boss({ fall: true, toPhase2: true }), true, false)).toEqual({ theme: H.beaten, next: H.transform });
    // (Beaten where no phase 2 follows (online, a Solo raid), or he won: the result, as for any boss.)
    expect(recluseMusic(boss({ fall: true }), true, false)).toBeNull();
    expect(recluseMusic(boss(), true, false)).toBeNull();
    expect(recluseMusic({ kind: "phaseChange", at: 1000, splitAt: 20_630 }, true, false)).toEqual({ theme: H.transform, dropAt: 20_630 });
    expect(recluseMusic({ kind: "simul", at: 0 }, true, false)).toEqual({ theme: H.transform });
    expect(recluseMusic({ kind: "simul", at: 0 }, true, true)).toBeNull();
    expect(recluseMusic({ kind: "results" } as never, true, false)).toBeNull();
  });

  it("the switches' fades (the handoff's README): into his adult form's after a 1.5 s fade; his beaten theme at once over a 0.3 s fade; the transformation's at once, the last fading over 0.5 s", () => {
    expect(MUSIC_SWITCH[H.adult]).toEqual({ fadeMs: 1500, after: true });
    expect(MUSIC_SWITCH[H.beaten]).toEqual({ fadeMs: 300, after: false });
    expect(MUSIC_SWITCH[H.transform]).toEqual({ fadeMs: 500, after: false });
    // (From his house's loop, later: the adult form's theme once the house has faded.)
    expect(switchPlan(THEMES, H.adult, 10, true)).toMatchObject({ outAt: 10, outMs: 1500, plan: { intro: { at: 11.5 } } });
    // (Nothing playing: at once.)
    expect(switchPlan(THEMES, H.adult, 10, false)?.plan.intro?.at).toBe(10);
    expect(switchPlan(THEMES, H.beaten, 10, true)).toMatchObject({ outAt: 10, outMs: 300, plan: { intro: { at: 10 }, loop: { at: 10 + 1.815 } } });
  });

  it("the split time from introSeconds: the transformation starts its intro's length before the drop, read from themes.json (any length)", () => {
    const sw = switchPlan(THEMES, H.transform, 10, true, 40)!;
    expect(sw.plan.intro!.at).toBeCloseTo(40 - 19.29325, 9);
    expect(sw.plan.loop.at).toBe(40);
    expect(sw.outAt).toBeCloseTo(40 - 19.29325, 9);
    expect(sw.outMs).toBe(500);
    const shorter = { ...THEMES, themes: { ...THEMES.themes, [H.transform]: { ...THEMES.themes[H.transform], introSeconds: 8.74 } } };
    expect(switchPlan(shorter, H.transform, 10, true, 40)!.plan.intro!.at).toBeCloseTo(31.26, 9);
    expect(switchPlan(shorter, H.transform, 10, true, 40)!.plan.loop.at).toBe(40);
    // (Too late for its intro (it loaded late): its loop alone, still on the drop; past the drop too: at once.)
    expect(switchPlan(THEMES, H.transform, 30, true, 40)).toMatchObject({ outAt: 40, plan: { intro: null, loop: { at: 40 } } });
    expect(switchPlan(THEMES, H.transform, 50, true, 40)).toMatchObject({ outAt: 50, plan: { intro: null, loop: { at: 50 } } });
  });

  it("a moment on screen onto the audio clock: the output's own timestamp, else the clock less its output latency", () => {
    expect(heardNow({ currentTime: 10 }, 0)).toBe(10);
    expect(heardNow({ currentTime: 10, outputLatency: 0.04 }, 0)).toBeCloseTo(9.96, 9);
    const ts = { contextTime: 9.9, performanceTime: 5000 };
    expect(heardNow({ currentTime: 10, outputLatency: 0.04, getOutputTimestamp: () => ts }, 5050)).toBeCloseTo(9.95, 9);
    // (A stale stamp: the fallback.)
    expect(heardNow({ currentTime: 10, getOutputTimestamp: () => ({ contextTime: 2, performanceTime: 1 }) }, 5050)).toBe(10);
  });

  describe("through his fight", () => {
    let key = 1000;
    const fight = (theme: string, o: object = {}) => bossMusic({ key, boss: "recluse", live: true, theme, ...o });
    beforeEach(() => {
      key++;
      ctx.currentTime = 10;
      ctx.sources = [];
      ctx.gains = [];
      files.length = 0;
      forgot.length = 0;
      sound.muted = false;
      sound.hidden = false;
      setMusicOn(true);
    });
    afterEach(() => bossMusic(null));

    it("his fight starts: his adult form's theme, decoded and played; his later themes fetched, not decoded", async () => {
      preFetched.length = 0;
      fight(H.adult, { ahead: [H.beaten, H.transform] });
      await settle();
      await settle();
      expect([...new Set(files)], "decoded: his adult form's only").toEqual(["/music/recluse-phase2-intro.mp3", "/music/recluse-phase2-loop.mp3"]);
      expect(preFetched.sort()).toEqual(["/music/recluse-beaten-intro.mp3", "/music/recluse-house-loop.mp3", "/music/recluse-phase3-intro.mp3", "/music/recluse-phase3-loop.mp3"]);
      expect(musicTheme()).toBe(H.adult);
      expect(ctx.sources[0]!.started).toEqual([10 + MUSIC.startDelayS, undefined]);
    });

    it("beaten: his beaten theme at once, what was playing faded over 0.3 s and stopped there; then the transformation's intro its length before the split, the beaten one fading over 0.5 s from there, its loop on the split", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
      try {
        fight(H.adult);
        await vi.advanceTimersByTimeAsync(0);
        const adult = ctx.gains[0]!;
        ctx.currentTime = 100;
        files.length = 0;
        fight(H.beaten, { next: H.transform });
        await vi.advanceTimersByTimeAsync(0);
        const t = 100 + MUSIC.startDelayS;
        expect(musicTheme()).toBe(H.beaten);
        expect(files, "the transformation's decoded as he's beaten").toEqual(expect.arrayContaining(["/music/recluse-phase3-intro.mp3", "/music/recluse-phase3-loop.mp3"]));
        const [bi, bl] = ctx.sources.slice(2);
        expect(bi!.started).toEqual([t, undefined]);
        expect(bl!.started![0]).toBeCloseTo(t + 1.815, 9);
        expect(ctx.gains[1]!.gain.value, "at full level at once").toBe(MUSIC.volume);
        expect(adult.gain.calls).toContainEqual(["set", MUSIC.volume, t]);
        expect(adult.gain.lastRamp).toEqual([0, t + 0.3]);
        for (const s of ctx.sources.slice(0, 2)) expect(s.stoppedAt).toBeCloseTo(t + 0.3, 9);
        // (Its fade done: his adult form's theme let go.)
        await vi.advanceTimersByTimeAsync(700);
        expect(forgot.sort()).toEqual(["/music/recluse-phase2-intro.mp3", "/music/recluse-phase2-loop.mp3"]);
        // The phase change: the board splits 20 s from now.
        ctx.currentTime = 110;
        const split = Date.now() + 20_000;
        fight(H.transform, { dropAt: split });
        await vi.advanceTimersByTimeAsync(0);
        expect(musicTheme()).toBe(H.transform);
        const [ti, tl] = ctx.sources.slice(4);
        const t0 = 130 - 19.29325;
        expect(ti!.started![0]).toBeCloseTo(t0, 6);
        expect(tl!.started![0]).toBeCloseTo(130, 6);
        expect(tl!.started![1]).toBe(0.5);
        expect(ctx.gains[2]!.gain.value).toBe(MUSIC.volume);
        const beaten = ctx.gains[1]!.gain;
        expect(beaten.calls).toContainEqual(["set", MUSIC.volume, t0]);
        expect(beaten.lastRamp![0]).toBe(0);
        expect(beaten.lastRamp![1]).toBeCloseTo(t0 + 0.5, 6);
        for (const s of [bi, bl]) expect(s!.stoppedAt).toBeCloseTo(t0 + 0.5, 6);
        // (Phase 2: the same theme on, no restart; the next render with no drop changes nothing.)
        fight(H.transform);
        await vi.advanceTimersByTimeAsync(0);
        expect(ctx.sources).toHaveLength(6);
        // The result: it fades out as any boss's.
        ctx.currentTime = 200;
        bossMusic(null);
        expect(ctx.gains[2]!.gain.lastRamp).toEqual([0, 200 + MUSIC.endFadeMs / 1000]);
        expect(musicTheme()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("the result while a switch's fade waits (his beaten theme till the transformation): both stop", async () => {
      fight(H.beaten);
      await settle();
      fight(H.transform, { dropAt: Date.now() + 20_000 });
      await settle();
      ctx.currentTime = 12;
      bossMusic(null);
      for (const s of ctx.sources) expect(s.stoppedAt).toBeCloseTo(12 + MUSIC.endFadeMs / 1000, 6);
    });

    it("Music off while a switch's fade waits: what was leaving stops at once", async () => {
      fight(H.beaten);
      await settle();
      fight(H.transform, { dropAt: Date.now() + 20_000 });
      await settle();
      setMusicOn(false);
      const [bi, bl] = ctx.sources;
      for (const s of [bi, bl]) expect(s!.stoppedAt).toBeCloseTo(10 + MUSIC.fadeMs / 1000, 6);
    });
  });
});

describe("a new audio context picks the music up where it was (Eric, Nov 14: a hiccup, as if it restarted)", () => {
  const l = { wallAt: 10_000, offset: 0.5, loopStart: 0.5, loopEnd: 60.5 };
  it("before the loop starts (its intro still playing): null, it starts over", () => {
    expect(loopPlace(l, 9_999)).toBeNull();
  });
  it("in its first pass: the offset plus the time since it started", () => {
    expect(loopPlace(l, 10_000)).toBeCloseTo(0.5);
    expect(loopPlace(l, 40_000)).toBeCloseTo(30.5);
  });
  it("after it wraps: back between its loop points", () => {
    expect(loopPlace(l, 10_000 + 60_000)).toBeCloseTo(0.5);
    expect(loopPlace(l, 10_000 + 95_000)).toBeCloseTo(35.5);
    expect(loopPlace({ ...l, offset: 20.5 }, 10_000 + 45_000)).toBeCloseTo(5.5);
  });
});
