import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUSIC, MUSIC_SWITCH, RECLUSE_MUSIC, TOWN_MUSIC } from "@chessroyale/core";
import type { Phase } from "../src/game.ts";

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
  /** The gain it plays into (one gain per copy of a theme playing). */
  to: unknown = null;
  connect(g: unknown) {
    this.to = g;
  }
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
const fakeContext = (currentTime: number) => ({
  currentTime,
  state: undefined as AudioContextState | undefined,
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
});
const ctx = fakeContext(10);
/** The context musicBus hands out (a new one once sound.ts has rebuilt it), and what heard of the rebuild. */
let busCtx = ctx;
const rebuilt: ((old: unknown) => number | void)[] = [];
const files: string[] = [];
const forgot: string[] = [];
// (Decoded buffers kept as sound.ts keeps them, until forgotten: `fetched` lists the misses, each a real fetch and decode.)
const bufs = new Map<string, { url: string; duration: number }>();
const fetched: string[] = [];
/** (Set: an intro's decode waits for it; `solo`: a town solo's.) */
const gate = { intro: null as Promise<void> | null, solo: null as Promise<void> | null };
/** Pieces whose next decode fails (once). */
const loadFails = new Set<string>();
const sound = vi.hoisted(() => ({ muted: false, hidden: false, muteListeners: [] as (() => void)[] }));
vi.mock("../src/sound.ts", () => ({
  isMuted: () => sound.muted,
  isPageHidden: () => sound.hidden,
  musicBus: () => ({ ctx: busCtx, out: {} }),
  loadAudioFile: (url: string) => {
    files.push(url);
    if (loadFails.delete(url)) return Promise.resolve(null);
    // (The town's pieces at their own lengths: the theme's loop and its pads, a solo and its ring-out.)
    const duration = url.endsWith("-intro.mp3") ? 8 : url.includes("town-loop") ? 179.604646 : url.includes("town-solo") ? 41.209313 : 120;
    if (!bufs.has(url)) (fetched.push(url), bufs.set(url, { url, duration }));
    const buf = bufs.get(url)!;
    if (gate.solo && url.includes("town-solo")) return gate.solo.then(() => buf);
    return gate.intro && url.endsWith("-intro.mp3") ? gate.intro.then(() => buf) : Promise.resolve(buf);
  },
  forgetAudioFile: (url: string) => void (forgot.push(url), bufs.delete(url)),
  onAudioRebuilt: (fn: (old: unknown) => number | void) => (rebuilt.push(fn), () => undefined),
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
    "recluse-phase2": { intro: "recluse-phase2-intro", loop: "recluse-phase2-loop", introSeconds: 118.887167, loopSeconds: 89.275563 },
    "recluse-beaten": { intro: "recluse-beaten-intro", loop: "recluse-house-loop", introSeconds: 1.815, loopSeconds: 60 },
    "recluse-phase3": { intro: "recluse-phase3-intro", loop: "recluse-phase3-loop", introSeconds: 19.29325, loopSeconds: 88.371021 },
  },
  // (The town's, as the handoff has it, Nov 15.)
  town: {
    loop: "town-loop",
    loopSeconds: 178.604646,
    solos: [
      { id: "a", file: "town-solo-a", seconds: 37.209313 },
      { id: "b", file: "town-solo-b", seconds: 37.209313 },
    ],
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

const { bossMusic, loopPlace, musicFiles, musicLevel, musicNow, musicPlan, musicTheme, musicWanted, preloadMusic, recluseMusic, roomMusic, roomMusicLoad, roomMusicNow, setMusicOn, splashDone, splashMusic, switchPlan, heardNow, townFiles, townDecodedNow, townEntry, townFirstRun, townMusic, townMusicNow, townSoloAt, townSoloOf } = await import(
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
  const TOWN = ["/music/town-loop.mp3", "/music/town-solo-a.mp3", "/music/town-solo-b.mp3"];
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
    // (The town's own first, Nov 15: its theme, then its solos in their order; the bosses' after.)
    expect(preFetched.slice(0, 3)).toEqual(TOWN);
    expect(preFetched.sort()).toEqual([...TOWN, ...ALL].sort());
    expect(files, "nothing decoded").toEqual([]);
    expect(shares).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => n / 8));
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

  it("a splash whose theme decodes late, the battle already picked (a slow device; CI, Nov 24): the battle carries it on, logged, no restart", async () => {
    const g = globalThis as { __soundLog?: string[] };
    g.__soundLog = [];
    let open = () => {};
    gate.intro = new Promise((ok) => (open = ok));
    try {
      const splash = splashMusic("grex");
      await settle();
      bossMusic({ key: "late-fight", boss: "grex", live: false });
      expect(ctx.sources).toHaveLength(0);
      open();
      await splash;
      expect(ctx.sources).toHaveLength(2);
      expect(g.__soundLog.filter((l) => l === "music:splash:grex" || l === "music:carry:grex")).toEqual(["music:splash:grex", "music:carry:grex"]);
      splashDone();
      bossMusic({ key: "late-fight", boss: "grex", live: true });
      await settle();
      expect(ctx.sources).toHaveLength(2);
      expect(ctx.sources.every((s) => s.stoppedAt === null)).toBe(true);
      expect(g.__soundLog.filter((l) => l.startsWith("music:start") || l.startsWith("music:splashEnd"))).toEqual([]);
    } finally {
      gate.intro = null;
      delete g.__soundLog;
    }
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
    // (Late for its intro's start (it loaded late, or the device joined late; #707's review, m2): its intro now, from where it would
    // be, what's playing fading from now, the loop still on the drop. Past the drop: its loop alone, at once. No intro decoded: the
    // loop alone, on the drop.)
    const late = switchPlan(THEMES, H.transform, 30, true, 40)!;
    expect(late).toMatchObject({ outAt: 30, plan: { intro: { at: 30 }, loop: { at: 40 } } });
    expect(late.plan.intro!.offset).toBeCloseTo(30 - (40 - 19.29325), 9);
    expect(switchPlan(THEMES, H.transform, 50, true, 40)).toMatchObject({ outAt: 50, plan: { intro: null, loop: { at: 50 } } });
    expect(switchPlan(THEMES, H.transform, 30, true, 40, true)).toMatchObject({ outAt: 40, plan: { intro: null, loop: { at: 40 } } });
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

    it("the four boards (Eric, Nov 14: \"this music keeps restarting on the third phase\"): every state they pass through names the same theme, so it starts once at the split and plays on until the result", async () => {
      // (Each state as solo.ts and recluse-online.ts set them: the phase change, the countdown (set twice: once more after the boards'
      // first frame), the clocks, then boards decided one by one, his ultimate; phase 1 beaten (`result`) or joined at phase 2.)
      const split = Date.now() + 20_000;
      const states: [Phase, boolean][] = [
        [{ kind: "phaseChange", at: split - 17_435, splitAt: split }, false],
        [{ kind: "simul", at: split + 9_000 }, false],
        [{ kind: "simul", at: split + 9_120 }, false],
        [{ kind: "simul", at: split + 9_120 }, false],
        [{ kind: "simul", at: split + 9_120 }, false],
      ];
      for (const result of [true, false]) {
        const themes = states.map(([p, decided]) => recluseMusic(p, result, decided));
        expect(themes.slice(1).every((t) => t?.theme === H.transform && t.dropAt === undefined)).toBe(true);
        expect(themes[0]).toEqual({ theme: H.transform, dropAt: split });
      }
      // Through the player: one start (its intro, then the loop on the split), nothing more until the result.
      for (const [p, decided] of states) {
        const r = recluseMusic(p, true, decided)!;
        bossMusic({ key, boss: "recluse", live: true, ...r });
        await settle();
      }
      expect(ctx.sources).toHaveLength(2);
      expect(musicTheme()).toBe(H.transform);
      // (Every board decided: the result's fade, as any boss's.)
      expect(recluseMusic({ kind: "simul", at: split + 9_120 }, true, true)).toBeNull();
      bossMusic(null);
      expect(musicTheme()).toBeNull();
    });

    it("a device late for the transformation's intro (#707's review, m2): it hears the intro from where it is now, the loop still on the split", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
      try {
        fight(H.beaten);
        await vi.advanceTimersByTimeAsync(0);
        // (The board splits 5 s from now: 14.29 s of its 19.29 s intro already gone.)
        const split = Date.now() + 5_000;
        fight(H.transform, { dropAt: split });
        await vi.advanceTimersByTimeAsync(0);
        expect(musicTheme()).toBe(H.transform);
        const [ti, tl] = ctx.sources.slice(2);
        const now = 10 + MUSIC.startDelayS;
        expect(ti!.buffer).toMatchObject({ url: "/music/recluse-phase3-intro.mp3" });
        expect(ti!.started![0]).toBeCloseTo(now, 6);
        expect(ti!.started![1]).toBeCloseTo(now - (15 - 19.29325), 6);
        expect(tl!.started![0]).toBeCloseTo(15, 6);
        expect(tl!.started![1]).toBe(0.5);
        // (What was playing fades from now, not from the intro's start.)
        expect(ctx.gains[0]!.gain.lastRamp![1]).toBeCloseTo(now + 0.5, 6);
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

describe("a new audio context takes the music over with no break (Eric, Nov 14: \"it froze, stopped for a second... restarted at a different part\")", () => {
  let wall = 1_000_000;
  let key = 1000;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  /** grex's battle started at ctx 20 (intro at 20.05, loop at 26.72 from 0.5), then `s` seconds on, the clock and the wall alike. */
  async function playFor(s: number) {
    ctx.currentTime = 20;
    bossMusic({ key: ++key, boss: "grex", live: true });
    await settle();
    expect(ctx.sources).toHaveLength(2);
    ctx.currentTime += s;
    wall += s * 1000;
  }
  /** sound.ts rebuilds: a new context (suspended, its clock at 0) and the listener hears the old one; returns what it asked to keep. */
  function rebuild() {
    const next = fakeContext(0);
    next.state = "suspended";
    busCtx = next;
    return { next, keep: rebuilt[0]!(ctx) };
  }
  /** The new context's clock starts (and both clocks and the wall move on by `s`). */
  async function runs(next: ReturnType<typeof fakeContext>, s = 0.5) {
    next.state = "running";
    next.currentTime += s;
    ctx.currentTime += s;
    wall += s * 1000;
    await wait(40);
  }
  const loopAt = 20 + MUSIC.startDelayS + 6.666667;
  beforeEach(() => {
    vi.spyOn(Date, "now").mockImplementation(() => wall);
    ctx.sources = [];
    ctx.gains = [];
    ctx.state = "running";
    sound.muted = false;
    sound.hidden = false;
    setMusicOn(true);
  });
  afterEach(() => {
    bossMusic(null);
    busCtx = ctx;
    ctx.state = undefined;
    vi.restoreAllMocks();
  });

  it("the old one still sounding: the new starts at the place the old is heard at once its clock runs, then the old fades over handoffMs from there", async () => {
    await playFor(40);
    const { next, keep } = rebuild();
    // (The old context kept open for the wait, the start and the fade: never past sound.ts's 2 s.)
    expect(keep).toBeGreaterThanOrEqual(MUSIC.handoffWaitMs + MUSIC.handoffMs);
    // (Nothing yet: the new one's clock hasn't started, and the old one plays on, untouched.)
    expect(next.sources).toHaveLength(0);
    expect(ctx.sources[1]!.stoppedAt).toBeNull();
    await runs(next);
    const [loop] = next.sources;
    const from = 0.5 + MUSIC.startDelayS;
    expect(next.sources).toHaveLength(1);
    expect(loop!.started![0]).toBeCloseTo(from, 6);
    // (Where the old one's loop is at its own clock's matching moment, 60.5 + the start delay.)
    expect(loop!.started![1]).toBeCloseTo(0.5 + (60.5 + MUSIC.startDelayS - loopAt), 6);
    expect([loop!.loop, loop!.loopStart, loop!.loopEnd]).toEqual([true, 0.5, 0.5 + 113.333333]);
    expect(next.gains[0]!.gain.value).toBe(MUSIC.volume);
    // The old one: held until the new one is heard, then faded out over handoffMs and stopped.
    const handAt = 60.5 + MUSIC.startDelayS;
    expect(ctx.gains[0]!.gain.lastRamp![0]).toBe(0);
    expect(ctx.gains[0]!.gain.lastRamp![1]).toBeCloseTo(handAt + MUSIC.handoffMs / 1000, 6);
    for (const s of ctx.sources) expect(s.stoppedAt).toBeCloseTo(handAt + MUSIC.handoffMs / 1000, 6);
    expect(musicNow()).toEqual({ boss: "grex", level: MUSIC.volume });
    // (Its result: the music on the new one ends, as ever.)
    bossMusic(null);
    expect(loop!.stoppedAt).toBeCloseTo(next.currentTime + MUSIC.endFadeMs / 1000, 6);
  });

  it("in its intro: the intro picks up where it is, and the loop follows at its own moment", async () => {
    await playFor(3);
    const { next } = rebuild();
    await runs(next);
    const [intro, loop] = next.sources;
    const from = 0.5 + MUSIC.startDelayS;
    expect(intro!.started![0]).toBeCloseTo(from, 6);
    expect(intro!.started![1]).toBeCloseTo(23.5 + MUSIC.startDelayS - (20 + MUSIC.startDelayS), 6);
    expect(loop!.started![0]).toBeCloseTo(from + (loopAt - (23.5 + MUSIC.startDelayS)), 6);
    expect(loop!.started![1]).toBe(0.5);
  });

  it("the old one dead (its clock stopped): closed at once, and the new one comes in at the place the wall clock says", async () => {
    await playFor(40);
    // (Dead for 20 s: the wall moves on, its clock doesn't.)
    wall += 20_000;
    ctx.state = "suspended";
    const { next, keep } = rebuild();
    expect(keep).toBe(0);
    await runs(next);
    const [loop] = next.sources;
    expect(loop!.started![1]).toBeCloseTo(0.5 + (60 + 20 + 0.5 + MUSIC.startDelayS - loopAt), 6);
  });

  it("the battle ends while the new one opens: nothing starts on it", async () => {
    await playFor(40);
    const { next } = rebuild();
    bossMusic(null);
    await runs(next);
    expect(next.sources).toHaveLength(0);
  });

  it("the battle takes the splash's music over while the new one opens: it is carried too, the old one stopped (it was left there, Nov 14)", async () => {
    ctx.currentTime = 20;
    await splashMusic("grex");
    expect(ctx.sources).toHaveLength(2);
    ctx.currentTime += 3;
    wall += 3000;
    const { next } = rebuild();
    bossMusic({ key: ++key, boss: "grex", live: false });
    splashDone();
    await runs(next);
    expect(next.sources.length).toBeGreaterThan(0);
    for (const s of ctx.sources) expect(s.stoppedAt).not.toBeNull();
    expect(musicNow()?.boss).toBe("grex");
  });

  it("the new one's clock never starts: the music is started on it after handoffWaitMs all the same", async () => {
    await playFor(40);
    const { next } = rebuild();
    await wait(40);
    expect(next.sources).toHaveLength(0);
    wall += MUSIC.handoffWaitMs;
    await wait(40);
    expect(next.sources).toHaveLength(1);
  });
});

describe("never two sources of one theme sounding past the handover (Nov 14)", () => {
  /** The copies of a theme (by its pieces' files) sounding at `t` on `c`: each its own gain, started by then and not yet stopped. */
  function copies(c: ReturnType<typeof fakeContext>, pieces: string[], t: number) {
    const gains = new Set<unknown>();
    for (const s of c.sources) {
      const url = (s.buffer as { url?: string } | null)?.url ?? "";
      if (pieces.some((p) => url === `/music/${p}.mp3`) && s.started && s.started[0] <= t && (s.stoppedAt === null || s.stoppedAt > t)) gains.add(s.to);
    }
    return gains.size;
  }
  /** Just past the handover after a copy starting at `now` (its start delay, then the old one's handoffMs). */
  const past = (now: number) => now + MUSIC.startDelayS + MUSIC.handoffMs / 1000 + 0.01;
  const ZEBRA = ["zebra-intro", "zebra-loop"];
  const GREX = ["grex-intro", "grex-loop"];
  beforeEach(() => {
    ctx.sources = [];
    ctx.gains = [];
    sound.muted = false;
    sound.hidden = false;
    setMusicOn(true);
  });
  afterEach(() => {
    roomMusic(null);
    splashDone();
    bossMusic(null);
  });

  it("a room left and walked straight back into: the copy fading out stops by the handover, one copy after", async () => {
    ctx.currentTime = 200;
    roomMusic("zebra");
    await settle();
    ctx.currentTime = 230;
    roomMusic(null);
    ctx.currentTime = 230.4;
    roomMusic("zebra");
    await settle();
    expect(copies(ctx, ZEBRA, 230.4 + MUSIC.startDelayS)).toBe(2);
    expect(copies(ctx, ZEBRA, past(230.4))).toBe(1);
    // (The one left is the new one, from its intro.)
    expect(roomMusicNow()?.boss).toBe("zebra");
  });

  it("a rematch of the same boss as the last one's result fades: one copy past the handover", async () => {
    ctx.currentTime = 300;
    bossMusic({ key: "first", boss: "grex", live: true });
    await settle();
    ctx.currentTime = 360;
    bossMusic(null);
    ctx.currentTime = 360.5;
    bossMusic({ key: "rematch", boss: "grex", live: true });
    await settle();
    expect(copies(ctx, GREX, past(360.5))).toBe(1);
  });

  it("the Hidden Boss challenged from his room: his room's theme fading out stops by the handover as his fight's copy starts", async () => {
    const HOUSE = ["recluse-house-loop"];
    ctx.currentTime = 400;
    roomMusic(RECLUSE_MUSIC.child);
    await settle();
    ctx.currentTime = 420;
    await splashMusic("recluse");
    ctx.currentTime = 420.6;
    bossMusic({ key: "hidden", boss: "recluse", live: true, theme: RECLUSE_MUSIC.child });
    await settle();
    expect(copies(ctx, HOUSE, past(420.6))).toBe(1);
  });

  it("a splash called off and the same boss challenged again: one copy past the handover", async () => {
    ctx.currentTime = 500;
    await splashMusic("grex");
    ctx.currentTime = 503;
    splashDone();
    ctx.currentTime = 503.3;
    await splashMusic("grex");
    expect(copies(ctx, GREX, past(503.3))).toBe(1);
  });

  it("a copy whose fade ends before the handover would is left to end on its own (never held longer)", async () => {
    ctx.currentTime = 600;
    roomMusic("zebra");
    await settle();
    const first = [...ctx.sources];
    ctx.currentTime = 630;
    roomMusic(null);
    ctx.currentTime = 630 + MUSIC.endFadeMs / 1000 - 0.1;
    roomMusic("zebra");
    await settle();
    for (const s of first) expect(s.stoppedAt).toBe(630 + MUSIC.endFadeMs / 1000);
  });
});

describe("the town's own theme, with its two piano solos slotted in (Eric, Nov 14-15)", () => {
  const L = 178.604646;
  const S = 37.209313;
  const PAD = 0.5;
  const town = THEMES.town;
  const TOWN_FILES = ["/music/town-loop.mp3", "/music/town-solo-a.mp3", "/music/town-solo-b.mp3"];
  /** The town opened at `t` (its first frame's music): the theme decoded and started, then its solos decoded. */
  async function open(t = 10) {
    ctx.currentTime = t;
    townMusic(true);
    await vi.advanceTimersByTimeAsync(0);
    return t + MUSIC.startDelayS;
  }
  /** The audio clock at `t`, and the timers run (the tick that puts a solo on the clock, TOWN_MUSIC.aheadS before it: a run's length away). */
  async function at(t: number) {
    ctx.currentTime = t;
    await vi.advanceTimersByTimeAsync(20 * 60_000);
  }
  const bufOf = (s: FakeSource) => (s.buffer as { url: string }).url;
  const named = (name: string) => ctx.sources.filter((s) => bufOf(s) === `/music/${name}.mp3`);
  let random: ReturnType<typeof vi.spyOn<Math, "random">>;
  beforeEach(() => {
    vi.useFakeTimers();
    ctx.sources = [];
    ctx.gains = [];
    files.length = 0;
    fetched.length = 0;
    forgot.length = 0;
    bufs.clear();
    sound.muted = false;
    sound.hidden = false;
    setMusicOn(true);
    // (The rolls pinned unless a test sets its own: from the theme's top, its first solo 1 pass in; 2 passes after each solo.)
    random = vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    townMusic(false);
    roomMusic(null);
    splashDone();
    bossMusic(null);
    await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
    random.mockRestore();
    vi.useRealTimers();
  });

  it("the solos by their turn: a, b, a… (TOWN_MUSIC.order); the first 1 pass in (from the top), then 1 or 2 passes after each; the town's pieces, theme first", () => {
    expect(TOWN_MUSIC.firstPasses).toBe(1);
    expect(TOWN_MUSIC.passesAfterSolo).toEqual([1, 2]);
    expect([0, 1, 2, 3].map((n) => townSoloOf(town, n)?.id)).toEqual(["a", "b", "a", "b"]);
    expect(townSoloAt(town, { at: 10, passes: 3, turn: 0 })).toBeCloseTo(10 + 3 * L, 9);
    expect(townFiles(THEMES)).toEqual(["/music/town-loop.mp3", "/music/town-solo-a.mp3", "/music/town-solo-b.mp3"]);
  });

  // Eric, Nov 16: "it fires the solos sometimes in the first minute 30 or sometimes later, not every time early maybe like 33% of the time,
  // but it should always play a solo before 5 minutes or so of looping."
  describe("when the first solo comes (Nov 16): a third of the time within about a minute, else 1 pass in; always within 3 minutes", () => {
    const [E77, E61] = TOWN_MUSIC.earlyEntries as [number, number];

    it("the roll: under earlyChance, partway in at one of its bar lines at random; else from the top; forced, the first", () => {
      expect(TOWN_MUSIC.earlyChance).toBe(0.33);
      // (Bar lines: a bar is 240/129 s; bar 77 and bar 61.)
      expect(E77).toBeCloseTo((76 * 240) / 129, 5);
      expect(E61).toBeCloseTo((60 * 240) / 129, 5);
      const rolls = (...r: number[]) => () => r.shift()!;
      expect(townEntry(town, false, rolls(0.32, 0.1))).toBe(E77);
      expect(townEntry(town, false, rolls(0, 0.9))).toBe(E61);
      expect(townEntry(town, false, rolls(0.33))).toBe(0);
      expect(townEntry(town, false, rolls(0.99))).toBe(0);
      expect(townEntry(town, true, rolls(0.99))).toBe(E77);
      // Over many starts (a seeded roll), about a third early, both entries met.
      let seed = 7;
      const lcg = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      let early = 0;
      const seen = new Set<number>();
      for (let k = 0; k < 3000; k++) {
        const e = townEntry(town, false, lcg);
        if (e) (early++, seen.add(e));
      }
      expect(early / 3000).toBeGreaterThan(0.28);
      expect(early / 3000).toBeLessThan(0.38);
      expect([...seen].sort()).toEqual([E61, E77].sort());
    });

    it("the first solo's moment: 0:37 or 1:07 in early, 2:59 from the top; always within 3 minutes (Eric: before about 5)", () => {
      const first = (entry: number) => townSoloAt(town, townFirstRun(100, entry, 0)) - 100;
      expect(first(E77)).toBeCloseTo(37.209297, 3);
      expect(first(E61)).toBeCloseTo(66.976739, 3);
      expect(first(0)).toBeCloseTo(L, 9);
      for (const e of [0, E77, E61]) expect(first(e)).toBeLessThan(180);
      // (Every entry's solo comes inside the window it's decoded in, at once.)
      for (const e of [E77, E61]) expect(first(e)).toBeLessThan(TOWN_MUSIC.aheadS + TOWN_MUSIC.decodeS);
    });

    it("early: the theme starts partway in on the clock, fading in over earlyFadeS; its solo decoded at once and put on the clock at that pass's end", async () => {
      random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.1);
      const t0 = await open(10);
      const [theme, solo, back] = ctx.sources;
      expect(bufOf(theme!)).toBe("/music/town-loop.mp3");
      expect(theme!.started).toEqual([t0, PAD + E77]);
      expect([theme!.loop, theme!.loopStart, theme!.loopEnd]).toEqual([true, PAD, PAD + L]);
      expect(ctx.gains[0]!.gain.calls.find((c) => c[0] === "set")).toEqual(["set", 0, t0]);
      expect(ctx.gains[0]!.gain.lastRamp).toEqual([MUSIC.volume, t0 + TOWN_MUSIC.earlyFadeS]);
      expect(files.filter((u) => u.includes("town-solo"))).toEqual(["/music/town-solo-a.mp3"]);
      const soloAt = t0 + L - E77;
      expect(theme!.stoppedAt).toBeCloseTo(soloAt, 9);
      expect(bufOf(solo!)).toBe("/music/town-solo-a.mp3");
      expect(solo!.started![0]).toBeCloseTo(soloAt, 9);
      expect(bufOf(back!)).toBe("/music/town-loop.mp3");
      expect(back!.started![0]).toBeCloseTo(soloAt + S, 9);
      expect(back!.started![1]).toBe(PAD);
      // (Then b after 1 or 2 passes, as rolled: 2 here.)
      await at(soloAt + S + 2 * L - TOWN_MUSIC.aheadS + 1);
      expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-b.mp3");
      expect(ctx.sources.at(-2)!.started![0]).toBeCloseTo(soloAt + S + 2 * L, 9);
    });

    it("early, its decode landing past the solo's moment: one more pass, the solo at its end", async () => {
      let land!: () => void;
      gate.solo = new Promise((r) => (land = r));
      try {
        random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
        const t0 = await open(10);
        expect(ctx.sources[0]!.started).toEqual([t0, PAD + E61]);
        const soloAt = t0 + L - E61;
        // (Still decoding as its moment passes: the theme loops on.)
        ctx.currentTime = soloAt + 1;
        await vi.advanceTimersByTimeAsync(5000);
        expect(named("town-solo-a")).toHaveLength(0);
        land();
        await vi.advanceTimersByTimeAsync(0);
        expect(named("town-solo-a"), "too late for this pass's end").toHaveLength(0);
        expect(ctx.sources[0]!.stoppedAt).toBeNull();
        await at(soloAt + L - TOWN_MUSIC.aheadS + 1);
        expect(named("town-solo-a")[0]!.started![0]).toBeCloseTo(soloAt + L, 9);
        expect(ctx.sources[0]!.stoppedAt).toBeCloseTo(soloAt + L, 9);
      } finally {
        gate.solo = null;
      }
    });

    it("early, its decode landing in time: put on the clock as it lands", async () => {
      let land!: () => void;
      gate.solo = new Promise((r) => (land = r));
      try {
        random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.1);
        const t0 = await open(10);
        const soloAt = t0 + L - E77;
        ctx.currentTime = soloAt - 20;
        await vi.advanceTimersByTimeAsync(3000);
        land();
        await vi.advanceTimersByTimeAsync(0);
        expect(named("town-solo-a")[0]!.started![0]).toBeCloseTo(soloAt, 9);
      } finally {
        gate.solo = null;
      }
    });

    it("the ?townsolo test switch (townMusic's second argument): every start partway in at bar 77, its solo 37 s in, whatever the roll", async () => {
      ctx.currentTime = 10;
      townMusic(true, true);
      await vi.advanceTimersByTimeAsync(0);
      const t0 = 10 + MUSIC.startDelayS;
      expect(ctx.sources[0]!.started).toEqual([t0, PAD + E77]);
      expect(named("town-solo-a")[0]!.started![0]).toBeCloseTo(t0 + L - E77, 9);
      // (Out of a room and back: again.)
      ctx.currentTime = 100;
      roomMusic("zebra");
      await vi.advanceTimersByTimeAsync(0);
      roomMusic(null);
      await vi.advanceTimersByTimeAsync(0);
      const again = ctx.sources.find((s) => bufOf(s) === "/music/town-loop.mp3" && s.started![0] === 100 + MUSIC.startDelayS);
      expect(again!.started).toEqual([100 + MUSIC.startDelayS, PAD + E77]);
      expect(named("town-solo-b")[0]!.started![0]).toBeCloseTo(100 + MUSIC.startDelayS + L - E77, 9);
      // (Closed and opened without it: rolled again, from the top here.)
      townMusic(false);
      await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
      await open(500);
      expect(ctx.sources.at(-1)!.started).toEqual([500 + MUSIC.startDelayS, PAD]);
    });
  });

  it("the theme loops as a boss loop does: from the pad, between pad and pad + loopSeconds, at MUSIC.volume; only the theme decoded", async () => {
    const t0 = await open(10);
    expect(fetched).toEqual(["/music/town-loop.mp3"]);
    expect(townDecodedNow()).toEqual(["town-loop"]);
    const [theme] = ctx.sources;
    expect(ctx.sources).toHaveLength(1);
    expect(bufOf(theme!)).toBe("/music/town-loop.mp3");
    expect(theme!.started).toEqual([t0, PAD]);
    expect([theme!.loop, theme!.loopStart, theme!.loopEnd]).toEqual([true, PAD, PAD + L]);
    expect(theme!.stoppedAt).toBeNull();
    expect(ctx.gains[0]!.gain.value).toBe(MUSIC.volume);
    expect(townMusicNow()).toEqual({ level: MUSIC.volume });
  });

  it("after 1 pass the solo starts exactly at the pass's end, the theme stopping there; the theme comes back exactly `seconds` later from its top, the solo ringing out over it", async () => {
    const t0 = await open(10);
    const soloAt = t0 + L;
    // (Not yet: the solo goes on the clock TOWN_MUSIC.aheadS before it.)
    await at(soloAt - TOWN_MUSIC.aheadS - 5);
    expect(ctx.sources).toHaveLength(1);
    await at(soloAt - TOWN_MUSIC.aheadS + 1);
    const [first, solo, back] = ctx.sources;
    expect(ctx.sources).toHaveLength(3);
    expect(first!.stoppedAt).toBe(soloAt);
    expect(bufOf(solo!)).toBe("/music/town-solo-a.mp3");
    expect(solo!.started).toEqual([soloAt, 0]);
    expect(solo!.loop).toBe(false);
    // (Never stopped: its file plays to its end, 4 s past the theme's return.)
    expect(solo!.stoppedAt).toBeNull();
    expect(bufOf(back!)).toBe("/music/town-loop.mp3");
    expect(back!.started).toEqual([soloAt + S, PAD]);
    expect([back!.loop, back!.loopStart, back!.loopEnd]).toEqual([true, PAD, PAD + L]);
    expect(back!.stoppedAt).toBeNull();
    // All on one gain (the solo at the theme's level: the files are mastered alike).
    expect(new Set(ctx.sources.map((s) => s.to)).size).toBe(1);
  });

  it("the solos take turns, a, b, a: the first after 1 pass, then after 1 or 2 more as rolled", async () => {
    let run = await open(10);
    const solos: [string, number][] = [];
    // (Rolled as each solo goes on the clock: after a, 1 pass (low); after b, 2 (high).)
    const rolls = [0.2, 0.99, 0.99];
    for (let k = 0; k < 3; k++) {
      random.mockReturnValue(rolls[k]!);
      const soloAt = run + (k === 2 ? 2 : 1) * L;
      await at(soloAt - TOWN_MUSIC.aheadS + 1);
      const s = ctx.sources.at(-2)!;
      solos.push([bufOf(s), s.started![0]]);
      expect(s.started![0]).toBeCloseTo(soloAt, 9);
      run = soloAt + S;
      expect(ctx.sources.at(-1)!.started![0]).toBeCloseTo(run, 9);
    }
    expect(solos.map(([u]) => u)).toEqual(["/music/town-solo-a.mp3", "/music/town-solo-b.mp3", "/music/town-solo-a.mp3"]);
    // (Nothing put on the clock twice.)
    expect(ctx.sources).toHaveLength(1 + 3 * 2);
  });

  it("a solo not decoded in time: the theme plays one more pass (no break), the solo at that pass's end", async () => {
    loadFails.add("/music/town-solo-a.mp3");
    const t0 = await open(10);
    await at(t0 + L - TOWN_MUSIC.aheadS + 1);
    expect(named("town-solo-a")).toHaveLength(0);
    expect(ctx.sources[0]!.stoppedAt, "the theme loops on").toBeNull();
    // (Asked for again by that tick: in for the next pass's end.)
    await at(t0 + 2 * L - TOWN_MUSIC.aheadS + 1);
    const [solo] = named("town-solo-a");
    expect(solo!.started).toEqual([t0 + 2 * L, 0]);
    expect(ctx.sources[0]!.stoppedAt).toBe(t0 + 2 * L);
    expect(ctx.sources.at(-1)!.started).toEqual([t0 + 2 * L + S, PAD]);
  });

  it("a new audio context mid-solo: the solo picks up where it is heard, the theme's return at its own moment; the old one fades out", async () => {
    const t0 = await open(10);
    // (The wall clock as the audio clock read 10.)
    const w0 = Date.now();
    const soloAt = t0 + L;
    await at(soloAt - TOWN_MUSIC.aheadS + 1);
    const old = [...ctx.sources];
    // (10 s into the solo, on the old clock and on the wall alike.)
    ctx.currentTime = soloAt + 10;
    ctx.state = "running";
    vi.setSystemTime(w0 + (soloAt + 10 - 10) * 1000);
    const next = fakeContext(0);
    next.state = "suspended";
    busCtx = next;
    try {
      const keep = rebuilt[0]!(ctx);
      expect(keep).toBeGreaterThanOrEqual(MUSIC.handoffWaitMs + MUSIC.handoffMs);
      next.state = "running";
      next.currentTime = 0.5;
      ctx.currentTime += 0.5;
      vi.setSystemTime(Date.now() + 500);
      await vi.advanceTimersByTimeAsync(20);
      const from = 0.5 + MUSIC.startDelayS;
      const [solo, back] = next.sources;
      expect(next.sources).toHaveLength(2);
      expect(bufOf(solo!)).toBe("/music/town-solo-a.mp3");
      expect(solo!.started![0]).toBeCloseTo(from, 6);
      expect(solo!.started![1]).toBeCloseTo(10.5 + MUSIC.startDelayS, 6);
      // (The theme's return: `seconds` after the solo started, as heard; from its top, looping.)
      expect(bufOf(back!)).toBe("/music/town-loop.mp3");
      expect(back!.started![0]).toBeCloseTo(from + S - (10.5 + MUSIC.startDelayS), 6);
      expect(back!.started![1]).toBe(PAD);
      expect([back!.loop, back!.loopStart, back!.loopEnd]).toEqual([true, PAD, PAD + L]);
      // The old one: everything stopped by the handover's fade.
      const handAt = soloAt + 10.5 + MUSIC.startDelayS;
      for (const s of old) expect(s.stoppedAt!).toBeLessThanOrEqual(handAt + MUSIC.handoffMs / 1000 + 1e-9);
      expect(townMusicNow()).toEqual({ level: MUSIC.volume });
    } finally {
      townMusic(false);
      busCtx = ctx;
      ctx.state = undefined;
    }
  });

  it("stopped mid-solo (a room with its own theme): the solo is the music, faded out with it; out of the room, the theme from its top, and the next solo is b", async () => {
    const t0 = await open(10);
    const soloAt = t0 + L;
    await at(soloAt - TOWN_MUSIC.aheadS + 1);
    const [, solo, back] = ctx.sources;
    ctx.currentTime = soloAt + 10;
    roomMusic("zebra");
    const out = soloAt + 10 + MUSIC.endFadeMs / 1000;
    expect(ctx.gains[0]!.gain.lastRamp).toEqual([0, out]);
    expect(solo!.stoppedAt).toBe(out);
    // (The theme's return was to come after the fade: it never sounds.)
    expect(back!.stoppedAt).toBe(out);
    expect(back!.stoppedAt!).toBeLessThan(back!.started![0]);
    expect(townMusicNow()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(roomMusicNow()?.boss).toBe("zebra");
    // Out of the room: the theme from its top, now.
    ctx.currentTime = soloAt + 60;
    const n = ctx.sources.length;
    roomMusic(null);
    await vi.advanceTimersByTimeAsync(0);
    const again = ctx.sources.slice(n).filter((s) => bufOf(s) === "/music/town-loop.mp3");
    expect(again).toHaveLength(1);
    expect(again[0]!.started).toEqual([soloAt + 60 + MUSIC.startDelayS, PAD]);
    expect(townMusicNow()).toEqual({ level: MUSIC.volume });
    // (Its theme wasn't decoded again: kept while the town is open. The solo, faded out with the town's music, was let go.)
    expect(fetched.filter((u) => u.includes("town-loop"))).toHaveLength(1);
    expect(townDecodedNow()).toEqual(["town-loop"]);
    const t1 = soloAt + 60 + MUSIC.startDelayS;
    await at(t1 + L - TOWN_MUSIC.aheadS + 1);
    expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-b.mp3");
  });

  it("stopped as a solo was due (put on the clock, not yet heard): the last pass stops by its end, never past it, and that solo is still next", async () => {
    const t0 = await open(10);
    const soloAt = t0 + L;
    await at(soloAt - TOWN_MUSIC.aheadS + 1);
    const [first, solo] = ctx.sources;
    // (0.5 s before the solo: the fade's 1.5 s would run past the pass's end.)
    ctx.currentTime = soloAt - 0.5;
    roomMusic("zebra");
    expect(first!.stoppedAt).toBe(soloAt);
    expect(solo!.stoppedAt).toBeCloseTo(soloAt - 0.5 + MUSIC.endFadeMs / 1000, 9);
    roomMusic(null);
    await vi.advanceTimersByTimeAsync(0);
    const t1 = ctx.sources.at(-1)!.started![0];
    await at(t1 + L - TOWN_MUSIC.aheadS + 1);
    expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-a.mp3");
  });

  it("its theme fails to load: nothing plays, and it isn't asked for again until the town opens again", async () => {
    loadFails.add("/music/town-loop.mp3");
    await open(10);
    expect(ctx.sources).toHaveLength(0);
    roomMusic(null);
    bossMusic(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(files.filter((u) => u.includes("town-loop"))).toHaveLength(1);
    townMusic(false);
    await open(20);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.started).toEqual([20 + MUSIC.startDelayS, PAD]);
  });

  it("a room with no theme of its own (a shop): the town's plays on, untouched", async () => {
    await open(10);
    roomMusic("bakery");
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.stoppedAt).toBeNull();
    expect(townMusicNow()).not.toBeNull();
  });

  it("a challenge's splash takes over at once; called off (no battle), the town's comes back from its top; a battle: none", async () => {
    await open(10);
    ctx.currentTime = 50;
    void splashMusic("grex");
    expect(ctx.sources[0]!.stoppedAt).toBe(50 + MUSIC.endFadeMs / 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(townMusicNow()).toBeNull();
    ctx.currentTime = 60;
    splashDone();
    await vi.advanceTimersByTimeAsync(0);
    expect(townMusicNow()).not.toBeNull();
    expect(ctx.sources.at(-1)!.started).toEqual([60 + MUSIC.startDelayS, PAD]);
    bossMusic({ key: "town-battle", boss: "grex", live: false });
    expect(townMusicNow()).toBeNull();
  });

  it("the town closes: it fades out and its pieces are let go; open again, the solos' turns start from a", async () => {
    const t0 = await open(10);
    await at(t0 + L - TOWN_MUSIC.aheadS + 1);
    ctx.currentTime = t0 + L + S + 5;
    townMusic(false);
    expect(townMusicNow()).toBeNull();
    await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
    // (Solo a still rang out; b's turn wasn't near, so it was never decoded.)
    expect(forgot.sort()).toEqual(["/music/town-loop.mp3", "/music/town-solo-a.mp3"]);
    expect(townDecodedNow()).toEqual([]);
    const t1 = await open(2000);
    await at(t1 + L - TOWN_MUSIC.aheadS + 1);
    expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-a.mp3");
  });

  it("Music off (or Sound off): nothing fetched, nothing plays; on again, the theme starts; off while it plays, it fades to nothing and keeps its place", async () => {
    setMusicOn(false);
    await open(10);
    sound.muted = true;
    setMusicOn(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetched).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
    sound.muted = false;
    sound.muteListeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.sources).toHaveLength(1);
    ctx.currentTime = 30;
    setMusicOn(false);
    expect(ctx.gains[0]!.gain.lastRamp).toEqual([0, 30 + MUSIC.fadeMs / 1000]);
    expect(ctx.sources[0]!.stoppedAt).toBeNull();
    setMusicOn(true);
    expect(ctx.gains[0]!.gain.lastRamp).toEqual([MUSIC.volume, 30 + MUSIC.fadeMs / 1000]);
    expect(ctx.sources).toHaveLength(1);
  });

  it("the town's loading: preloadMusic waits for the theme (decoded to play), then fetches the solos' bytes and the bosses' (each piece once), decoding none", async () => {
    preFetched.length = 0;
    await open(10);
    await preloadMusic();
    expect(files.filter((u) => u.includes("town")), "decoded: the theme alone").toEqual([TOWN_FILES[0]]);
    // (The solos' bytes: fetched once a visit, into the cache, by the loading bar's test above; the theme, decoded by its player, not again.)
    expect(preFetched, "the theme not fetched again").not.toContain(TOWN_FILES[0]);
  });

  describe("in memory (Nov 15: the theme ~69 MB, each solo ~16 MB, beside the town's WebGL on a phone): the theme, and at most one solo", () => {
    it("no solo decoded until its turn nears (TOWN_MUSIC.aheadS + decodeS before it); then only that one, put on the clock aheadS before", async () => {
      expect(TOWN_MUSIC.decodeS).toBeGreaterThan(0);
      const t0 = await open(10);
      const soloAt = t0 + L;
      await at(soloAt - TOWN_MUSIC.aheadS - TOWN_MUSIC.decodeS - 5);
      expect(files.filter((u) => u.includes("town-solo"))).toEqual([]);
      expect(townDecodedNow()).toEqual(["town-loop"]);
      await at(soloAt - TOWN_MUSIC.aheadS - TOWN_MUSIC.decodeS + 1);
      expect(files.filter((u) => u.includes("town-solo"))).toEqual(["/music/town-solo-a.mp3"]);
      expect(townDecodedNow().sort()).toEqual(["town-loop", "town-solo-a"]);
      // (Decoded, not on the clock yet.)
      expect(ctx.sources).toHaveLength(1);
      await at(soloAt - TOWN_MUSIC.aheadS + 1);
      expect(named("town-solo-a")[0]!.started).toEqual([soloAt, 0]);
      expect(files.filter((u) => u.includes("town-solo")), "decoded once").toEqual(["/music/town-solo-a.mp3"]);
    });

    it("once a solo has rung out its decoded audio is let go (no reference kept), and decoded again only at its next turn, from the cache", async () => {
      const t0 = await open(10);
      const soloAt = t0 + L;
      await at(soloAt - TOWN_MUSIC.aheadS + 1);
      const end = soloAt + 41.209313;
      await at(end - 1);
      expect(townDecodedNow(), "still ringing out").toContain("town-solo-a");
      expect(forgot).toEqual([]);
      await at(end + 1);
      expect(forgot).toEqual(["/music/town-solo-a.mp3"]);
      expect(townDecodedNow()).toEqual(["town-loop"]);
      expect(bufs.has("/music/town-solo-a.mp3"), "sound.ts's copy let go too").toBe(false);
      // (Its turn again (b, then a): decoded anew, a after b has been let go.)
      const run1 = soloAt + S;
      await at(run1 + 2 * L - TOWN_MUSIC.aheadS + 1);
      expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-b.mp3");
      const run2 = run1 + 2 * L + S;
      await at(run2 + 2 * L - TOWN_MUSIC.aheadS + 1);
      expect(bufOf(ctx.sources.at(-2)!)).toBe("/music/town-solo-a.mp3");
      expect(files.filter((u) => u.includes("town-solo"))).toEqual(["/music/town-solo-a.mp3", "/music/town-solo-b.mp3", "/music/town-solo-a.mp3"]);
    });

    it("never more than the theme and one solo decoded, through a, b, a and a room in between", async () => {
      const t0 = await open(10);
      let most = 0;
      const look = () => {
        most = Math.max(most, townDecodedNow().length);
        expect(townDecodedNow().filter((n) => n.includes("solo")).length).toBeLessThanOrEqual(1);
        expect([...bufs.keys()].filter((u) => u.includes("town-solo")).length).toBeLessThanOrEqual(1);
      };
      const until = t0 + L + S + 2 * (2 * L + S) + 60;
      for (let t = t0; t < until; t += 15) {
        await at(t);
        look();
        if (Math.abs(t - (t0 + L + S + 200)) < 8) {
          roomMusic("zebra");
          await vi.advanceTimersByTimeAsync(MUSIC.endFadeMs + 300);
          look();
          roomMusic(null);
          await vi.advanceTimersByTimeAsync(0);
        }
      }
      expect(most, "a solo was held at some point").toBe(2);
    });

    it("a decode that lands late (past the solo's moment): the theme plays one more pass, the solo, kept, at that pass's end", async () => {
      let land!: () => void;
      gate.solo = new Promise((r) => (land = r));
      try {
        const t0 = await open(10);
        const soloAt = t0 + L;
        await at(soloAt - TOWN_MUSIC.aheadS + 1);
        // (Still decoding: nothing on the clock, the theme looping on.)
        expect(named("town-solo-a")).toHaveLength(0);
        expect(ctx.sources[0]!.stoppedAt).toBeNull();
        ctx.currentTime = soloAt + 1;
        land();
        await vi.advanceTimersByTimeAsync(0);
        expect(named("town-solo-a"), "too late for this pass's end").toHaveLength(0);
        expect(ctx.sources[0]!.stoppedAt).toBeNull();
        await at(t0 + 2 * L - TOWN_MUSIC.aheadS + 1);
        expect(named("town-solo-a")[0]!.started).toEqual([t0 + 2 * L, 0]);
        expect(ctx.sources[0]!.stoppedAt).toBe(t0 + 2 * L);
        expect(files.filter((u) => u.includes("town-solo")), "decoded once, kept for its pass").toEqual(["/music/town-solo-a.mp3"]);
      } finally {
        gate.solo = null;
      }
    });

    it("a decode that lands in time (after aheadS, before the solo): it's put on the clock as it lands", async () => {
      let land!: () => void;
      gate.solo = new Promise((r) => (land = r));
      try {
        const t0 = await open(10);
        const soloAt = t0 + L;
        await at(soloAt - TOWN_MUSIC.aheadS + 1);
        ctx.currentTime = soloAt - 30;
        land();
        await vi.advanceTimersByTimeAsync(0);
        expect(named("town-solo-a")[0]!.started).toEqual([soloAt, 0]);
        expect(ctx.sources[0]!.stoppedAt).toBe(soloAt);
      } finally {
        gate.solo = null;
      }
    });
  });
});
