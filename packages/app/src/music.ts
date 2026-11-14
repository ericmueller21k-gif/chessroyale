/**
 * Boss battle music (Eric, Nov 11: "Wire boss battle music into the game"; docs/decisions/2026-11-11-boss-music.md).
 *
 * Each boss with a theme in `public/music/themes.json` has an intro played once and a loop played until the battle's
 * result; a boss without one plays nothing. Every theme is fetched (not decoded) during the town's loading bar (`preloadMusic`,
 * Nov 12), into the service worker's cache; a theme is decoded when its battle is picked (its loading step and intro) or its room
 * is walked into, never at app start, and let go after (`forgetTheme`). It starts as the battle starts (the intro's end: `bossMusic`'s `live`),
 * or as soon as it arrives if it's late (from its intro), never holding the battle. It plays on its own gain into the game's
 * master (sound.ts's `musicBus`), at MUSIC.volume, under the effects; Settings → Sound's "Music" and "Sound" switches and
 * the page hiding fade it to nothing (the loop keeps its place) and back; the result fades it out and stops it.
 *
 * The handoff's rules (branch stills/trailer-v2, boss-music/README.md): play the intro at t0; start the loop at
 * t0 + introSeconds from offset `pad`, looping between `pad` and `pad + loopSeconds` (the intro's tails ring over the
 * loop's start; the pads hide a decoder's silence at the file's ends). Lengths come from themes.json, never from here.
 *
 * Its room too (Nov 11, docs/decisions/2026-11-11-area-banner-room-music.md): walked into through the door on your own, the boss's
 * theme plays there (`roomMusic`), until you leave. A challenge from the town starts the theme as its splash starts (`splashMusic`;
 * a room's already playing carries straight through), and the battle carries it on.
 *
 * Switching mid-fight (the Hidden Boss, Nov 13: docs/decisions/2026-11-13-hidden-boss-music.md): a battle names the theme it wants
 * now (`MusicBattle.theme`, a key in themes.json; its boss's by default), and a new one takes over by MUSIC_SWITCH's fades
 * (`switchPlan`); one whose loop must start at a given moment (`dropAt`: his boards' split) starts its intro that long before it.
 */
import { MUSIC, MUSIC_SWITCH, RECLUSE_MUSIC } from "@chessroyale/core";
import type { Phase } from "./game.ts";
import { forgetAudioFile, isMuted, isPageHidden, loadAudioFile, musicBus, onAudioRebuilt, onMuteChange } from "./sound.ts";

/** One boss's theme as themes.json lists it (other fields, `bpm`, `lufs`…, are notes). */
export interface MusicTheme {
  intro: string | null;
  loop: string;
  introSeconds: number;
  loopSeconds: number;
}
export interface MusicThemes {
  pad: number;
  themes: Record<string, MusicTheme | undefined>;
}

/** What starts when, on the audio clock (s). */
export interface MusicPlan {
  intro: { name: string; at: number } | null;
  loop: { name: string; at: number; offset: number; loopStart: number; loopEnd: number };
}

/**
 * The plan for `boss`'s theme starting at `t0`: its intro at t0, its loop at t0 + introSeconds from `pad`, looping between
 * `pad` and `pad + loopSeconds`. A theme with no intro (or `loopOnly`: the loop picked up again on a new audio context) is
 * the loop alone, from t0. No theme (or one that can't loop): null.
 */
export function musicPlan(themes: MusicThemes | null, boss: string, t0: number, loopOnly = false): MusicPlan | null {
  const th = themes?.themes[boss];
  if (!themes || !th || !th.loop || !(th.loopSeconds > 0)) return null;
  const pad = Math.max(0, themes.pad || 0);
  const intro = th.intro && !loopOnly ? { name: th.intro, at: t0 } : null;
  const at = intro ? t0 + Math.max(0, th.introSeconds || 0) : t0;
  return { intro, loop: { name: th.loop, at, offset: pad, loopStart: pad, loopEnd: pad + th.loopSeconds } };
}

/** How a theme takes over from what's playing, on the audio clock (s): its plan, and when what was playing fades out (over `outMs`). */
export interface SwitchPlan {
  plan: MusicPlan;
  outAt: number;
  outMs: number;
}

/**
 * `theme` taking over at `now` (MUSIC_SWITCH: what's playing fades over its `fadeMs`; `after`, the theme waits for that fade when
 * something is `playing`, else it starts at once, at full level). With `dropAt`, its loop must start exactly then (the Hidden Boss's
 * boards split on it): its intro starts at dropAt − introSeconds, and what's playing fades from there. Too late for that (or
 * `loopOnly`): its loop alone, from dropAt (or now, if that's past too). No theme: null.
 */
export function switchPlan(themes: MusicThemes | null, theme: string, now: number, playing: boolean, dropAt: number | null = null, loopOnly = false): SwitchPlan | null {
  const th = themes?.themes[theme];
  if (!th) return null;
  const outMs = MUSIC_SWITCH[theme]?.fadeMs ?? MUSIC.fadeMs;
  if (dropAt !== null) {
    const t0 = dropAt - Math.max(0, th.introSeconds || 0);
    const late = loopOnly || t0 < now;
    const at = late ? Math.max(now, dropAt) : t0;
    const plan = musicPlan(themes, theme, at, late);
    return plan && { plan, outAt: at, outMs };
  }
  const at = playing && MUSIC_SWITCH[theme]?.after ? now + outMs / 1000 : now;
  const plan = musicPlan(themes, theme, at, loopOnly);
  return plan && { plan, outAt: now, outMs };
}

/** What a context has to say about when its sound is heard (AudioContext's; optional, as a fake's or an old browser's). */
export type HeardClock = Pick<BaseAudioContext, "currentTime"> & { outputLatency?: number; getOutputTimestamp?: () => AudioTimestamp };
/**
 * The audio clock's time being heard at `perfNow` (performance.now()): the output's own timestamp where the browser gives one,
 * else the clock less its output latency. A moment on screen is matched to the sound by this, not by currentTime (which runs
 * ahead of what's heard by the output's buffering).
 */
export function heardNow(ctx: HeardClock, perfNow: number): number {
  let ts: AudioTimestamp | undefined;
  try {
    ts = ctx.getOutputTimestamp?.();
  } catch {
    // (None: the fallback.)
  }
  if (ts?.contextTime && ts.performanceTime) {
    const t = ts.contextTime + (perfNow - ts.performanceTime) / 1000;
    // (A stale stamp, e.g. just after a resume: not trusted.)
    if (t <= ctx.currentTime && t > ctx.currentTime - 1) return t;
  }
  return ctx.currentTime - (ctx.outputLatency || 0);
}

/** Where a piece is served (MP3 only: it decodes everywhere, iOS Safari included). */
export const musicUrl = (name: string) => `/music/${name}.mp3`;

/** The music's gain for the switches and the page: MUSIC.volume, or nothing. */
export const musicLevel = (on: boolean, muted: boolean, hidden: boolean) => (on && !muted && !hidden ? MUSIC.volume : 0);

/** Moves a gain from where it is now to `to` over `ms`, replacing any fade under way. */
export function fadeTo(param: AudioParam, to: number, now: number, ms: number) {
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  param.linearRampToValueAtTime(to, now + Math.max(0, ms) / 1000);
}

/** The minimum of the audio graph the player needs (an AudioContext; a fake in the unit tests). */
export type MusicContext = Pick<BaseAudioContext, "currentTime" | "createGain" | "createBufferSource">;

export interface Playing {
  ctx: MusicContext;
  gain: GainNode;
  sources: AudioBufferSourceNode[];
  /** Where its loop is, on the wall clock: to pick it up there on a new audio context (`loopPlace`). */
  place?: LoopPlace;
}

/** A loop's timing on Date.now()'s clock: when it starts (from `offset`), and its loop points (s into its file). */
export interface LoopPlace {
  wallAt: number;
  offset: number;
  loopStart: number;
  loopEnd: number;
}

/**
 * Where a loop is at `nowMs` (s into its file), or null while it hasn't started yet (its intro still playing). A new audio context
 * (sound.ts rebuilds one after the window was away, or the sound device changed) picks the music up here, not from its start
 * (Eric, Nov 14: "a hiccup... it sounds like it's restarting").
 */
export function loopPlace(l: LoopPlace, nowMs: number): number | null {
  const t = (nowMs - l.wallAt) / 1000;
  if (!(t >= 0)) return null;
  const len = l.loopEnd - l.loopStart;
  const first = l.loopEnd - l.offset;
  if (!(len > 0)) return null;
  return t < first ? l.offset + t : l.loopStart + ((t - first) % len);
}

/**
 * Starts a plan on `ctx` into `out`, at gain `level`: the intro once (if it has one and its buffer), the loop looping. Returns
 * what's playing, to fade and stop.
 */
export function startPlan(ctx: MusicContext, out: AudioNode, plan: MusicPlan, intro: AudioBuffer | null, loop: AudioBuffer, level: number): Playing {
  const gain = ctx.createGain();
  gain.gain.value = level;
  gain.connect(out);
  const sources: AudioBufferSourceNode[] = [];
  if (plan.intro && intro) {
    const a = ctx.createBufferSource();
    a.buffer = intro;
    a.connect(gain);
    a.start(plan.intro.at);
    sources.push(a);
  }
  const b = ctx.createBufferSource();
  b.buffer = loop;
  b.loop = true;
  b.loopStart = plan.loop.loopStart;
  b.loopEnd = plan.loop.loopEnd;
  b.connect(gain);
  b.start(plan.loop.at, plan.loop.offset);
  sources.push(b);
  const place = { wallAt: Date.now() + (plan.loop.at - ctx.currentTime) * 1000, offset: plan.loop.offset, loopStart: plan.loop.loopStart, loopEnd: plan.loop.loopEnd };
  return { ctx, gain, sources, place };
}

/** Fades what's playing out over `ms` and stops it there: from now, or from `at` (the audio clock, s) if that's later. */
export function stopPlaying(p: Playing, ms: number, at?: number) {
  const now = p.ctx.currentTime;
  const from = Math.max(now, at ?? now);
  try {
    if (from > now) {
      // (Held at its level until then.)
      const g = p.gain.gain;
      g.cancelScheduledValues(from);
      g.setValueAtTime(g.value, from);
      g.linearRampToValueAtTime(0, from + ms / 1000);
    } else fadeTo(p.gain.gain, 0, now, ms);
  } catch {
    // (A closed context: nothing is playing anyway.)
  }
  for (const s of p.sources) {
    try {
      s.stop(from + ms / 1000);
    } catch {
      // Already stopped, or its context closed.
    }
  }
  setTimeout(
    () => {
      try {
        p.gain.disconnect();
      } catch {
        // Already gone.
      }
    },
    (from - now) * 1000 + ms + 200,
  );
}

// ---- The Music switch (Settings → Sound, and the match's Options): on unless switched off, remembered on the device. ----
const MUSIC_KEY = "brc.music";
const switchListeners = new Set<() => void>();
let on = (() => {
  try {
    return globalThis.localStorage?.getItem(MUSIC_KEY) !== "0";
  } catch {
    return true;
  }
})();
export const musicOn = () => on;
export function setMusicOn(v: boolean) {
  on = v;
  try {
    globalThis.localStorage?.setItem(MUSIC_KEY, v ? "1" : "0");
  } catch {
    // Not important: it lasts until a reload.
  }
  switchListeners.forEach((l) => l());
}
export function onMusicChange(fn: () => void): () => void {
  switchListeners.add(fn);
  return () => switchListeners.delete(fn);
}

// ---- The player: one battle at a time. ----
const log = (line: string) => (globalThis as { __soundLog?: string[] }).__soundLog?.push(line);

let themesFile: Promise<MusicThemes | null> | null = null;
function loadThemes(): Promise<MusicThemes | null> {
  if (!themesFile) {
    const p = fetch("/music/themes.json")
      .then((r) => (r.ok ? (r.json() as Promise<MusicThemes>) : null))
      .catch(() => null)
      // (A failure is asked again next time.)
      .then((t) => (t ? t : ((themesFile = null), null)));
    themesFile = p;
  }
  return themesFile;
}

/** Every theme's pieces, as served (each once), but those of the themes in `skip`. */
export function musicFiles(themes: MusicThemes, skip: readonly string[] = []): string[] {
  const urls = new Set<string>();
  for (const [key, th] of Object.entries(themes.themes)) {
    if (!th || skip.includes(key)) continue;
    if (th.intro) urls.add(musicUrl(th.intro));
    if (th.loop) urls.add(musicUrl(th.loop));
  }
  return [...urls];
}

/** The pieces the town's loading (or a fight's `ahead`) has fetched, or is fetching, this visit. */
const preloaded = new Set<string>();
/**
 * Themes the town's loading leaves out (the director, Nov 13: 2.5 MB for a boss only admins meet): fetched as their fight starts
 * (MusicBattle's `ahead`).
 */
const NOT_IN_TOWN: readonly string[] = Object.values(RECLUSE_MUSIC);
/**
 * The town's loading bar's "Loading music…" step (Eric, Nov 12: "why not just add all of the songs to the town when you load into the
 * town?"): every theme's pieces fetched, never decoded, so the service worker keeps them and a battle's or a room's theme never waits
 * on the network (decoding stays with `loadTheme`, one theme at a time in memory). Music or Sound off: nothing. Each piece once a
 * visit. `onShare` hears the share of the pieces in (0 to 1) as each lands; resolves once all have landed or failed (a failure is
 * fetched again as its theme is needed).
 */
export async function preloadMusic(onShare: (share: number) => void = () => {}): Promise<void> {
  if (!wanted()) return;
  const themes = await loadThemes();
  if (!themes || !wanted()) return;
  await fetchPieces(musicFiles(themes, NOT_IN_TOWN), onShare);
}

/** Fetches (never decodes) each of these pieces not fetched yet this visit; `onShare` as preloadMusic's. */
async function fetchPieces(all: readonly string[], onShare: (share: number) => void = () => {}): Promise<void> {
  const urls = all.filter((u) => !preloaded.has(u));
  let done = 0;
  await Promise.all(
    urls.map((url) => {
      preloaded.add(url);
      // (Low priority: the town's own files first. Read to the end, as a blob, not into the page's memory: the service worker
      // copies it into its cache as it passes.)
      return fetch(url, { priority: "low" } as RequestInit)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .catch(() => void preloaded.delete(url))
        .then(() => onShare(++done / urls.length));
    }),
  );
}

interface Theme {
  themes: MusicThemes;
  intro: AudioBuffer | null;
  loop: AudioBuffer;
}
const asked = new Set<string>();
/** Fetches and decodes `boss`'s theme (kept for the visit: sound.ts's file cache). Null: no theme, or it didn't load. */
async function loadTheme(boss: string): Promise<Theme | null> {
  const themes = await loadThemes();
  const th = themes?.themes[boss];
  if (!themes || !th || !musicPlan(themes, boss, 0)) return null;
  if (!asked.has(boss)) {
    asked.add(boss);
    log(`music:load:${boss}`);
  }
  // (The intro first, short and quick to decode, then the loop: Nov 11.)
  const intro = th.intro ? await loadAudioFile(musicUrl(th.intro)) : null;
  const loop = await loadAudioFile(musicUrl(th.loop));
  return loop ? { themes, intro, loop } : null;
}

/**
 * The battle the app is in: `key` names it (its match), `live` once it has started (past its intro). `theme`: the theme it wants
 * now (a key in themes.json; its boss's if none), switched to by MUSIC_SWITCH's fades as it changes; `dropAt` (Date.now()'s clock,
 * ms): that theme's loop starts exactly then (`switchPlan`). `ahead`: themes it may switch to, fetched (not decoded) as it begins;
 * `next`: the one due next, decoded now so it's ready.
 */
export interface MusicBattle {
  key: unknown;
  boss: string;
  live: boolean;
  theme?: string;
  dropAt?: number;
  ahead?: readonly string[];
  next?: string;
}
const themeOf = (b: MusicBattle) => b.theme ?? b.boss;
let battle: MusicBattle | null = null;
let playing: (Playing & { key: unknown; boss: string; theme: string }) | null = null;
/** What a switch left playing until its fade is done (stopped at once by the result, Music off or the page hiding). */
let leaving: Playing[] = [];
/** The theme a battle said is due next, decoded as it said so (`next`). */
let nextLoaded: string | undefined;
/** The battle and theme whose start is waiting for it to load. */
let starting: { b: MusicBattle; theme: string } | null = null;

const wanted = () => on && !isMuted();
/** Music is wanted (its switch and Sound's on): the town's loading bar then has its "Loading music…" step. */
export const musicWanted = () => wanted();
const level = () => musicLevel(on, isMuted(), isPageHidden());

/**
 * Called by the app on every render with the boss battle it shows (App.tsx): null when there's none, or at its result. A
 * new battle fetches its theme (if music is wanted); `live` starts it; null (or another battle) ends the last one.
 */
export function bossMusic(b: MusicBattle | null) {
  if (battle && (!b || battle.key !== b.key || battle.boss !== b.boss)) endBattle();
  if (!b) return;
  if (!battle) {
    battle = { ...b };
    // (Its splash's music, started as the challenge's splash started, carries on: no restart at "START!".)
    if (carried?.boss === themeOf(b)) {
      playing = { ...carried, key: b.key, theme: carried.boss };
      carried = null;
      log(`music:carry:${b.boss}`);
    }
    // (Any room's music ends: a battle picked from the menu. Not forgotten: forgetTheme keeps a theme whose battle has begun.)
    endRoom();
    if (wanted()) {
      void loadTheme(themeOf(b));
      if (b.ahead?.length) void fetchAhead(b.ahead);
    }
  } else if (themeOf(b) !== themeOf(battle) || b.dropAt !== battle.dropAt) {
    // (Its next theme: maybeStart switches to it.)
    battle.theme = b.theme;
    battle.dropAt = b.dropAt;
  }
  if (b.live && !battle.live) battle.live = true;
  if (b.next !== nextLoaded) {
    nextLoaded = b.next;
    if (b.next && wanted()) void loadTheme(b.next);
  }
  maybeStart(false);
}

/**
 * The Hidden Boss's theme at this point of his fight (Nov 13, RECLUSE_MUSIC): his child form's (`child`: his room's theme) from the
 * fight's start until the new match against his adult form, then his adult form's; beaten with his phase change to follow (`toPhase2`:
 * solo), his beaten theme at once, through his talk and the absorption; from the phase change, the transformation's, its loop
 * starting exactly as the board cracks into four (`dropAt`: the phase's `splitAt`; its intro starts that intro's length before,
 * `switchPlan`), on through phase 2 until every board is decided. Null: the music ends (the result, or phase 1 won where no phase 2
 * follows: as for any boss).
 */
export function recluseMusic(phase: Phase, result: boolean, simulDecided: boolean, child = false): { theme: string; dropAt?: number; next?: string } | null {
  // (His child form: his room's theme, through his fall as he grows up; the new match against his adult form switches to its theme
  // with MUSIC_SWITCH's fade, the adult's decoded meanwhile.)
  if (child && phase.kind !== "results") return { theme: RECLUSE_MUSIC.child, next: RECLUSE_MUSIC.adult };
  if (phase.kind === "phaseChange") return { theme: RECLUSE_MUSIC.transform, dropAt: phase.splitAt };
  if (phase.kind === "simul") return simulDecided ? null : { theme: RECLUSE_MUSIC.transform };
  if (phase.kind === "results") return null;
  if (phase.kind === "boss" && phase.fall && phase.toPhase2) return { theme: RECLUSE_MUSIC.beaten, next: RECLUSE_MUSIC.transform };
  return result ? null : { theme: RECLUSE_MUSIC.adult };
}

/** A fight's later themes, fetched (not decoded) so they're on the device before they're needed. */
async function fetchAhead(keys: readonly string[]) {
  const themes = await loadThemes();
  if (!themes || !wanted()) return;
  const skip = Object.keys(themes.themes).filter((k) => !keys.includes(k));
  log(`music:ahead:${keys.join(",")}`);
  await fetchPieces(musicFiles(themes, skip));
}

/** Its battle's theme starts, or takes over from the one playing (`switchPlan`), as soon as it's loaded. */
function maybeStart(loopOnly: boolean, resumeAt: number | null = null) {
  const b = battle;
  if (!b || !b.live || !wanted()) return;
  const theme = themeOf(b);
  if (playing?.theme === theme || (starting?.b === b && starting.theme === theme)) return;
  const tok = (starting = { b, theme });
  void loadTheme(theme).then((got) => {
    if (starting === tok) starting = null;
    if (!got || battle !== b || themeOf(b) !== theme || playing?.theme === theme || !wanted()) return;
    const bus = musicBus();
    if (!bus) return;
    const nowMs = Date.now();
    const heard = heardNow(bus.ctx, performance.now());
    const now = bus.ctx.currentTime + MUSIC.startDelayS;
    // (A moment on screen, Date.now()'s clock, onto the audio clock: when it's heard.)
    const dropAt = b.dropAt === undefined ? null : heard + (b.dropAt - nowMs) / 1000;
    const from = playing;
    const sw = switchPlan(got.themes, theme, now, !!from, dropAt, loopOnly || !got.intro);
    if (!sw) return;
    // (Picked up on a new audio context: where it was.)
    if (resumeAt !== null) sw.plan.loop.offset = resumeAt;
    try {
      playing = { ...startPlan(bus.ctx, bus.master, sw.plan, got.intro, got.loop, level()), key: b.key, boss: b.boss, theme };
      log(`music:start:${theme}${sw.plan.intro ? "" : ":loop"}`);
      // (Where its loop lands on Date.now()'s clock, for the tests: the Hidden Boss's drop on his boards' split.)
      if (dropAt !== null) log(`music:drop:${theme}:${Math.round(nowMs + (sw.plan.loop.at - heard) * 1000)}`);
    } catch {
      // Ignore audio errors: the battle goes on in silence.
      return;
    }
    if (!from) return;
    log(`music:out:${from.theme}`);
    stopPlaying(from, sw.outMs, sw.outAt);
    leaving.push(from);
    const doneMs = (sw.outAt - bus.ctx.currentTime) * 1000 + sw.outMs;
    setTimeout(() => {
      leaving = leaving.filter((q) => q !== from);
      forgetTheme(from.theme);
    }, doneMs + 250);
  });
}

/** What a switch left playing, stopped now (over `ms`). */
function stopLeaving(ms: number) {
  for (const q of leaving) stopPlaying(q, ms);
  leaving = [];
}

function endBattle() {
  const was = battle && themeOf(battle);
  const next = nextLoaded;
  battle = null;
  nextLoaded = undefined;
  if (next && next !== was) setTimeout(() => forgetTheme(next), MUSIC.endFadeMs + 250);
  starting = null;
  const p = playing;
  playing = null;
  stopLeaving(MUSIC.endFadeMs);
  if (was) setTimeout(() => forgetTheme(was), MUSIC.endFadeMs + 250);
  if (p && p.theme !== was) setTimeout(() => forgetTheme(p.theme), MUSIC.endFadeMs + 250);
  if (!p) return;
  log(`music:end:${p.boss}`);
  stopPlaying(p, MUSIC.endFadeMs);
}

/**
 * Once its battle is over (and its fade done), a theme's decoded audio is let go: one boss's at a time in memory, never every
 * boss met in a visit (two minutes decoded is about 45 MB). Not while a battle against the same boss has begun since.
 */
function forgetTheme(boss: string) {
  // (`boss`: a theme's key. Kept while it's wanted again, and a piece another theme in use shares is kept: the Hidden Boss's
  // beaten theme loops his house's loop.)
  const inUse = () => [battle && themeOf(battle), playing?.theme, room, carried?.boss].filter((k): k is string => !!k);
  if (inUse().includes(boss)) return;
  void loadThemes().then((t) => {
    const th = t?.themes[boss];
    if (!th || inUse().includes(boss)) return;
    const keep = new Set(inUse().flatMap((k) => [t!.themes[k]?.intro, t!.themes[k]?.loop]));
    for (const name of [th.intro, th.loop]) if (name && !keep.has(name)) forgetAudioFile(musicUrl(name));
  });
}

// ---- A boss's room (Eric, Nov 11: "add their music to the room, it loads when you walk in, then it will also be loaded already
// when the fight starts, but to be clear, only play the music if you walk in on your own through the door, not via challenging the
// boss"). Town.tsx says when: `roomMusicLoad` as the door's zoom starts, `roomMusic(boss)` as the room shows, null as you leave. ----
/** The boss whose room you walked into (null: none, or a battle took over). */
let room: string | null = null;
let roomPlaying: (Playing & { boss: string }) | null = null;
let roomStarting: string | null = null;
/** The boss whose theme roomMusicLoad loaded, to let go if it never plays (a challenge called off). */
let loadedFor: string | null = null;

/**
 * You set off through a boss's door (on your own, or to fight it: its splash then starts the theme at once): its theme starts
 * loading, if music is wanted, to be ready as the room shows.
 */
export function roomMusicLoad(boss: string) {
  if (!wanted()) return;
  loadedFor = boss;
  void loadTheme(boss);
}

/**
 * The room you walked into shows (`boss`: its boss; the same boss again, Rolling Dough's other room, carries on with no restart), or
 * null: you left (a fade over MUSIC.endFadeMs, then it stops and its theme is let go). A battle on: nothing (the battle's own plays).
 */
export function roomMusic(boss: string | null) {
  if (boss && boss === room) return maybeStartRoom(false);
  endRoom();
  room = boss;
  maybeStartRoom(false);
}

function maybeStartRoom(loopOnly: boolean, resumeAt: number | null = null) {
  const r = room;
  if (!r || battle || roomPlaying || roomStarting === r || !wanted()) return;
  roomStarting = r;
  void loadTheme(r).then((got) => {
    if (roomStarting === r) roomStarting = null;
    if (!got || room !== r || battle || roomPlaying || !wanted()) return;
    const bus = musicBus();
    if (!bus) return;
    const plan = musicPlan(got.themes, r, bus.ctx.currentTime + MUSIC.startDelayS, loopOnly || !got.intro);
    if (!plan) return;
    if (resumeAt !== null) plan.loop.offset = resumeAt;
    try {
      roomPlaying = { ...startPlan(bus.ctx, bus.master, plan, got.intro, got.loop, level()), boss: r };
      log(`music:room:${r}${plan.intro ? "" : ":loop"}`);
    } catch {
      // Ignore audio errors: the room goes on in silence.
    }
  });
}

function endRoom() {
  const was = room ?? loadedFor;
  loadedFor = null;
  room = null;
  roomStarting = null;
  const p = roomPlaying;
  roomPlaying = null;
  if (was) setTimeout(() => forgetTheme(was), MUSIC.endFadeMs + 250);
  if (!p) return;
  log(`music:roomEnd:${p.boss}`);
  stopPlaying(p, MUSIC.endFadeMs);
}

// ---- A challenge from the town (Eric, Nov 11): the theme starts the moment the boss's full-screen splash starts, and the battle
// carries it on. Town.tsx's stormIn calls splashMusic as the splash starts (holding its covering frame until it resolves, at most
// MUSIC.splashHoldMs) and splashDone once the splash is gone. From the boss menu: the battle starts it after its intro, as before. ----
/** The splash's music, until the battle takes it over (bossMusic). */
let carried: (Playing & { boss: string }) | null = null;
let splashTok = 0;

/**
 * The challenge's splash starts: `boss`'s theme starts now (its intro, then the loop), or as soon as it's decoded (the promise
 * resolves then, or at once with nothing to wait for). Its room's theme already playing (Don Dough's: you walked in) carries straight
 * through, no restart.
 */
export function splashMusic(boss: string): Promise<void> {
  const tok = ++splashTok;
  if (roomPlaying?.boss === boss) {
    carried = roomPlaying;
    roomPlaying = null;
    room = loadedFor = roomStarting = null;
    log(`music:splash:${boss}:room`);
    return Promise.resolve();
  }
  endRoom();
  if (!wanted() || battle) return Promise.resolve();
  return loadTheme(boss).then((got) => {
    if (!got || tok !== splashTok || carried || playing || !wanted()) return;
    const bus = musicBus();
    if (!bus) return;
    const plan = musicPlan(got.themes, boss, bus.ctx.currentTime + MUSIC.startDelayS, !got.intro);
    if (!plan) return;
    try {
      const p = startPlan(bus.ctx, bus.master, plan, got.intro, got.loop, level());
      // (Late, the battle already picked: it's the battle's now.)
      if (battle && themeOf(battle) === boss) playing = { ...p, key: battle.key, boss: battle.boss, theme: boss };
      else carried = { ...p, boss };
      log(`music:splash:${boss}`);
    } catch {
      // Ignore audio errors: the challenge goes on in silence.
    }
  });
}

/** The splash is gone: its music, if no battle took it over (a challenge that didn't start), fades out and stops. */
export function splashDone() {
  splashTok++;
  const p = carried;
  carried = null;
  if (!p) return;
  log(`music:splashEnd:${p.boss}`);
  stopPlaying(p, MUSIC.endFadeMs);
  setTimeout(() => forgetTheme(p.boss), MUSIC.endFadeMs + 250);
}

/** The switches or the page changed: fade to the level they make now (the loop keeps its place), or start if it hadn't. */
function relevel() {
  const l = level();
  // (A switch's fading theme: Music off or the page hidden ends it now.)
  if (!l) stopLeaving(MUSIC.fadeMs);
  for (const p of [playing, roomPlaying, carried]) {
    if (!p) continue;
    log(`music:level:${l}`);
    try {
      fadeTo(p.gain.gain, l, p.ctx.currentTime, MUSIC.fadeMs);
    } catch {
      // Its context closed: the next tap makes a new one (onAudioRebuilt below).
    }
  }
  // (A battle's theme that changed while Music was off: switched to now.)
  maybeStart(false);
  if (!roomPlaying) maybeStartRoom(false);
}

/** For the tests and the sound report: the boss whose battle music is playing, and its gain's target. */
export const musicNow = () => (playing ? { boss: playing.boss, level: level() } : null);
/** The theme playing in the battle (its key in themes.json), for the tests. */
export const musicTheme = () => playing?.theme ?? null;
/** The same for a room's music. */
export const roomMusicNow = () => (roomPlaying ? { boss: roomPlaying.boss, level: level() } : null);

onMuteChange(relevel);
onMusicChange(relevel);
if (typeof document !== "undefined") document.addEventListener("visibilitychange", relevel);
// A new audio context (the old one died: sound.ts, wakeAudio): the loop goes on on it from where it was (`loopPlace`; Nov 14: it
// started again from its start, heard as a hiccup each time Eric clicked back into the game from another window).
onAudioRebuilt(() => {
  const nowMs = Date.now();
  const at = (q: Playing | null) => (q?.place ? loopPlace(q.place, nowMs) : null);
  const p = playing;
  const r = roomPlaying;
  const c = carried;
  playing = null;
  roomPlaying = null;
  carried = null;
  for (const q of [p, r, c, ...leaving]) {
    try {
      q?.gain.disconnect();
    } catch {
      // Already gone with its context.
    }
  }
  leaving = [];
  if (p) maybeStart(true, at(p));
  if (r) maybeStartRoom(true, at(r));
});
