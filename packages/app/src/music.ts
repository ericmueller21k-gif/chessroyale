/**
 * Boss battle music (Eric, Nov 11: "Wire boss battle music into the game"; docs/decisions/2026-11-11-boss-music.md).
 *
 * Each boss with a theme in `public/music/themes.json` has an intro played once and a loop played until the battle's
 * result; a boss without one plays nothing. The theme is fetched and decoded when its battle is picked (its loading step and
 * intro), never at app start, and kept for the visit. It starts as the battle starts (the intro's end: `bossMusic`'s `live`),
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
 */
import { MUSIC } from "@chessroyale/core";
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
  return { ctx, gain, sources };
}

/** Fades what's playing out over `ms` and stops it there. */
export function stopPlaying(p: Playing, ms: number) {
  const now = p.ctx.currentTime;
  try {
    fadeTo(p.gain.gain, 0, now, ms);
  } catch {
    // (A closed context: nothing is playing anyway.)
  }
  for (const s of p.sources) {
    try {
      s.stop(now + ms / 1000);
    } catch {
      // Already stopped, or its context closed.
    }
  }
  setTimeout(() => {
    try {
      p.gain.disconnect();
    } catch {
      // Already gone.
    }
  }, ms + 200);
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

/** The battle the app is in: `key` names it (its match), `live` once it has started (past its intro). */
export interface MusicBattle {
  key: unknown;
  boss: string;
  live: boolean;
}
let battle: MusicBattle | null = null;
let playing: (Playing & { key: unknown; boss: string }) | null = null;
/** The battle whose start is waiting for its theme. */
let starting: unknown = null;

const wanted = () => on && !isMuted();
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
    if (carried?.boss === b.boss) {
      playing = { ...carried, key: b.key };
      carried = null;
      log(`music:carry:${b.boss}`);
    }
    // (Any room's music ends: a battle picked from the menu. Not forgotten: forgetTheme keeps a theme whose battle has begun.)
    endRoom();
    if (wanted()) void loadTheme(b.boss);
  }
  if (b.live && !battle.live) battle.live = true;
  maybeStart(false);
}

function maybeStart(loopOnly: boolean) {
  const b = battle;
  if (!b || !b.live || playing || starting === b || !wanted()) return;
  starting = b;
  void loadTheme(b.boss).then((got) => {
    if (starting === b) starting = null;
    if (!got || battle !== b || playing || !wanted()) return;
    const bus = musicBus();
    if (!bus) return;
    const plan = musicPlan(got.themes, b.boss, bus.ctx.currentTime + MUSIC.startDelayS, loopOnly || !got.intro);
    if (!plan) return;
    try {
      playing = { ...startPlan(bus.ctx, bus.master, plan, got.intro, got.loop, level()), key: b.key, boss: b.boss };
      log(`music:start:${b.boss}${plan.intro ? "" : ":loop"}`);
    } catch {
      // Ignore audio errors: the battle goes on in silence.
    }
  });
}

function endBattle() {
  const was = battle?.boss;
  battle = null;
  starting = null;
  const p = playing;
  playing = null;
  if (was) setTimeout(() => forgetTheme(was), MUSIC.endFadeMs + 250);
  if (!p) return;
  log(`music:end:${p.boss}`);
  stopPlaying(p, MUSIC.endFadeMs);
}

/**
 * Once its battle is over (and its fade done), a theme's decoded audio is let go: one boss's at a time in memory, never every
 * boss met in a visit (two minutes decoded is about 45 MB). Not while a battle against the same boss has begun since.
 */
function forgetTheme(boss: string) {
  const kept = () => battle?.boss === boss || room === boss || carried?.boss === boss;
  if (kept()) return;
  void loadThemes().then((t) => {
    const th = t?.themes[boss];
    if (!th || kept()) return;
    for (const name of [th.intro, th.loop]) if (name) forgetAudioFile(musicUrl(name));
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

function maybeStartRoom(loopOnly: boolean) {
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
      if (battle?.boss === boss) playing = { ...p, key: battle.key, boss };
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
  for (const p of [playing, roomPlaying, carried]) {
    if (!p) continue;
    log(`music:level:${l}`);
    try {
      fadeTo(p.gain.gain, l, p.ctx.currentTime, MUSIC.fadeMs);
    } catch {
      // Its context closed: the next tap makes a new one (onAudioRebuilt below).
    }
  }
  if (!playing) maybeStart(false);
  if (!roomPlaying) maybeStartRoom(false);
}

/** For the tests and the sound report: the boss whose battle music is playing, and its gain's target. */
export const musicNow = () => (playing ? { boss: playing.boss, level: level() } : null);
/** The same for a room's music. */
export const roomMusicNow = () => (roomPlaying ? { boss: roomPlaying.boss, level: level() } : null);

onMuteChange(relevel);
onMusicChange(relevel);
if (typeof document !== "undefined") document.addEventListener("visibilitychange", relevel);
// A new audio context (the old one died: sound.ts, wakeAudio): the loop starts again on it, from its start.
onAudioRebuilt(() => {
  const p = playing;
  const r = roomPlaying;
  const c = carried;
  playing = null;
  roomPlaying = null;
  carried = null;
  for (const q of [p, r, c]) {
    try {
      q?.gain.disconnect();
    } catch {
      // Already gone with its context.
    }
  }
  if (p) maybeStart(true);
  if (r) maybeStartRoom(true);
});
