/**
 * Game sounds: pieces use recorded knocks: the move and capture sounds the player picked in Settings (piece-sounds.ts;
 * all wood; the defaults are the classic PyChess knocks, GPL-3.0, as is castling's); every timer uses one clean clock tick; the reveal's
 * "selecting move" reel has a roulette-style arpeggio and three tones for the
 * winner (all synthesised with Web Audio, placeholders until real samples). Browsers
 * only allow audio after a tap, so call unlockAudio() from one. The mute
 * choice is remembered on the device.
 */

import { QUICK_CHAT } from "@chessroyale/core";
import { clownSound, type ClownSound } from "./characters/clown-sounds.ts";
import { gingerSound, type GingerSound } from "./characters/gingerbread-sounds.ts";
import { WHISTLES, grexSound, whistlePick, type GrexSound } from "./characters/grex-sounds.ts";
import { hollowSound, type HollowSound } from "./characters/hollow-sounds.ts";
import { bigBoySound, type BigBoySound } from "./characters/bigboy-sounds.ts";
import { sawyerSound, type SawyerSound } from "./characters/sawyer-sounds.ts";
import { pigSound, type PigSound } from "./characters/pig-sounds.ts";
import { recluseSound, type RecluseSound } from "./characters/recluse-sounds.ts";
import { godKingSound } from "./characters/god-king-sounds.ts";
import { makeBossSound, type BossSound } from "./characters/boss-sounds.ts";
import { soundCache } from "./characters/synth.ts";
import { CASTLE_SOUND, MOVE_SOUNDS, CAPTURE_SOUNDS, defaultPieceSound, onPieceSoundChange, pieceSound, pieceSoundOption, type PieceSoundKind } from "./piece-sounds.ts";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const samples = new Map<string, AudioBuffer>();
/** Every recorded file, fetched and decoded once, by its path (the piece sounds share them with SAMPLE_FILES). */
const files = new Map<string, Promise<AudioBuffer | null>>();
const decoded = new Map<string, AudioBuffer>();
function loadFile(url: string): Promise<AudioBuffer | null> {
  let p = files.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
      .then((buf) => (decoded.set(url, buf), buf))
      .catch(() => (files.delete(url), null));
    files.set(url, p);
  }
  return p;
}
const MUTE_KEY = "brc.muted";
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

const SAMPLE_FILES = {
  // The default move and capture sounds (the classic knocks: the judge's gavel is made from them) and castling's.
  move: MOVE_SOUNDS[0].file,
  capture: CAPTURE_SOUNDS[0].file,
  castle: CASTLE_SOUND,
  // The God King (boss battle): CC0 retro cuts, see public/sounds/god-king/CREDITS.md.
  gkSummon: "/sounds/god-king/summon.mp3",
  gkAppear: "/sounds/god-king/appear.mp3",
  gkHyuah: "/sounds/god-king/hyuah.mp3",
  gkBolt: "/sounds/god-king/bolt.mp3",
  gkHit: "/sounds/god-king/hit.mp3",
  gkLeave: "/sounds/god-king/leave.mp3",
  gkSlash: "/sounds/god-king/slash.mp3",
  gkCutIn: "/sounds/god-king/cutin.mp3",
  // His Last Stand (same packs, see the credits).
  gkWarn: "/sounds/god-king/warn.mp3",
  gkLastLeap: "/sounds/god-king/last-leap.mp3",
  gkLastCrash: "/sounds/god-king/last-crash.mp3",
  gkLastSlashes: "/sounds/god-king/last-slashes.mp3",
  gkLastGrunt1: "/sounds/god-king/last-grunt1.mp3",
  gkLastGrunt2: "/sounds/god-king/last-grunt2.mp3",
  gkLastGroan: "/sounds/god-king/last-groan.mp3",
  bannerStart: "/sounds/banner/start.mp3",
  queenGasp: "/sounds/banner/queen-gasp.mp3",
  menuOpen: "/sounds/menu/open.mp3",
  menuClose: "/sounds/menu/close.mp3",
  menuSelect: "/sounds/menu/select.mp3",
} as const;

/**
 * G-REX's Roman candle whistle is synthesised (characters/grex-sounds.ts: three variants, a little pitch either way,
 * now and then a crackle). To use a recorded whistle instead, put the file in public/sounds/grex/ (credit it in
 * CREDITS.md) and set its path here, e.g. "/sounds/grex/whistle.mp3": every shot then plays it, with the same pitch
 * spread and crackles, at GREX_WHISTLE_FILE_LEVEL (trim it so the whole volley stays under a move's loudness).
 */
const GREX_WHISTLE_FILE: string | null = null;
const GREX_WHISTLE_FILE_LEVEL = 0.15;

/** The audio graph, made once (prepareAudio, while the page is idle; failing that, on the first tap). */
function ensureContext() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.9;
  // A gentle low-pass keeps every sound soft on phone speakers.
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 6000;
  master.connect(soften).connect(ctx.destination);
}

let loading = false;
/** Fetches and decodes the recorded samples: once, after the first tap's frame (none of it holds up that tap). */
function loadSamples() {
  if (loading) return;
  loading = true;
  const go = () => {
    for (const [name, url] of Object.entries({ ...SAMPLE_FILES, ...(GREX_WHISTLE_FILE ? { grexWhistleFile: GREX_WHISTLE_FILE } : {}) })) {
      void loadFile(url).then((buf) => buf && samples.set(name, buf));
    }
    // Only the picked move and capture sounds (the others load when previewed), and a new pick as it's made.
    void loadFile(pieceSound("move").file);
    void loadFile(pieceSound("capture").file);
    onPieceSoundChange(() => {
      void loadFile(pieceSound("move").file);
      void loadFile(pieceSound("capture").file);
    });
  };
  // (After the next paint: the tap's own work, a piece picked up or a button pressed, shows first.)
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(go, 0));
  else setTimeout(go, 0);
}

/**
 * Makes the audio graph while the page is idle, before any tap, so the first tap of a visit only has to switch sound
 * on: making it cost 45-210 ms (a slowed phone) inside the first tap, the first move's own frame waited for it. The
 * graph starts suspended; nothing is fetched or played until a tap (unlockAudio).
 */
export function prepareAudio() {
  const make = () => {
    try {
      ensureContext();
    } catch {
      // No audio on this device: the game works silently.
    }
  };
  const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(make, { timeout: 2000 });
  else setTimeout(make, 1000);
}

/** Call from a tap so browsers allow sound later. Also loads the recorded samples (after the tap's frame). */
export function unlockAudio() {
  try {
    ensureContext();
    void ctx!.resume();
    loadSamples();
  } catch {
    // No audio on this device: the game works silently.
  }
}

/** Sound is on and its samples are loading or loaded: a tap has nothing more to do. */
export const audioUnlocked = () => loading && ctx?.state === "running";

export const isMuted = () => muted;
/** Sound is on (the audio context is running). */
export const audioRunning = () => ctx?.state === "running";
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}
export function onMuteChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sample(name: keyof typeof SAMPLE_FILES, at: number, level = 1, rate = 1) {
  const buf = samples.get(name);
  if (buf) startBuffer(buf, at, level, rate);
}
/**
 * The picked move or capture sound. Until it has loaded (or if it can't), today's wooden knock: a move is never
 * silent because of a pick.
 */
function pieceSample(kind: PieceSoundKind, at: number, level = 1, rate = 1) {
  const buf = decoded.get(pieceSound(kind).file) ?? decoded.get(defaultPieceSound(kind).file);
  if (buf) startBuffer(buf, at, level, rate);
}
/** Castling: the classic king-and-rook knock with the default move sound; with another, the picked move sound twice. */
function castleSample(at: number) {
  if (pieceSound("move").id === defaultPieceSound("move").id || !decoded.has(pieceSound("move").file)) return sample("castle", at);
  pieceSample("move", at);
  pieceSample("move", at + 0.11, 0.8);
}
function startBuffer(buf: AudioBuffer, at: number, level: number, rate: number) {
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx!.createGain();
  g.gain.value = level;
  src.connect(g).connect(master!);
  src.start(at);
}

/**
 * Plays one of the piece sounds in Settings' pickers (its ▶, or as it's picked), loading it first if it hasn't been.
 * A tap asked for it, so it plays even with the game's sound switched off. Tests read `preview:<kind>:<id>` in the log.
 */
export function previewPieceSound(kind: PieceSoundKind, id: string): void {
  const option = pieceSoundOption(kind, id);
  (globalThis as { __soundLog?: string[] }).__soundLog?.push(`preview:${kind}:${option.id}`);
  unlockAudio();
  const c = ctx;
  if (!c || !master) return;
  void loadFile(option.file).then(async (buf) => {
    if (!buf || ctx !== c) return;
    await c.resume().catch(() => undefined);
    startBuffer(buf, c.currentTime + 0.005, 1, 1);
  });
}

/** Plays synthesised samples (a boss character's sounds, see characters/), at `rate` (a little higher or lower). */
function buffer(data: Float32Array, at: number, rate = 1) {
  const c = ctx!;
  const buf = c.createBuffer(1, data.length, c.sampleRate);
  buf.getChannelData(0).set(data);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(master!);
  src.start(at);
}
const clown = (name: ClownSound) => (t: number) => buffer(clownSound(name, ctx!.sampleRate), t);
const ginger = (name: GingerSound) => (t: number) => buffer(gingerSound(name, ctx!.sampleRate), t);
const grex = (name: GrexSound) => (t: number) => buffer(grexSound(name, ctx!.sampleRate), t);
const hollow = (name: HollowSound) => (t: number) => buffer(hollowSound(name, ctx!.sampleRate), t);
const bigBoy = (name: BigBoySound) => (t: number) => buffer(bigBoySound(name, ctx!.sampleRate), t);
const sawyer = (name: SawyerSound) => (t: number) => buffer(sawyerSound(name, ctx!.sampleRate), t);
const pig = (name: PigSound) => (t: number) => buffer(pigSound(name, ctx!.sampleRate), t);
const recluse = (name: RecluseSound) => (t: number) => buffer(recluseSound(name, ctx!.sampleRate), t);
/** The God King tapped with no charges left: his soft "can't" (god-king-sounds.ts). */
const kingCant = (t: number) => buffer(godKingSound("cant", ctx!.sampleRate), t);
/** One of the Roman candle's shots: a whistle (one of three, its pitch a little either way), now and then a crackle at its top. */
function grexWhistle(t: number) {
  const w = whistlePick(Math.random(), Math.random(), Math.random());
  const file = samples.get("grexWhistleFile");
  if (file) {
    const src = ctx!.createBufferSource();
    src.buffer = file;
    src.playbackRate.value = w.rate;
    const g = ctx!.createGain();
    g.gain.value = GREX_WHISTLE_FILE_LEVEL;
    src.connect(g).connect(master!);
    src.start(t);
  } else buffer(grexSound(w.name, ctx!.sampleRate), t, w.rate);
  if (w.crackleAt !== null) buffer(grexSound("sparkle", ctx!.sampleRate), t + (file ? file.duration / w.rate : w.crackleAt), w.rate);
}

/** A clean clock tick: a very short burst of noise through a narrow band, like a watch's escapement. */
function clockTick(at: number, level = 0.5) {
  const c = ctx!;
  const len = 0.03;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 6;
  const g = c.createGain();
  g.gain.value = level * 4;
  src.connect(band).connect(g).connect(master!);
  src.start(at);
}

/**
 * Squads' sudden-death sting: two low notes falling a fourth ("dun-dun"), a muted brassy buzz through a low-pass, with a
 * soft thump under the first. Short, clear, quieter than a move, and nothing like a chime (no bright bell partials).
 */
function sqSting(at: number) {
  const c = ctx!;
  const note = (t: number, f: number, len: number, level: number) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.012);
    g.gain.setValueAtTime(level, t + len * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(lp).connect(g).connect(master!);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  note(at, 220, 0.16, 0.09);
  note(at + 0.17, 165, 0.32, 0.1);
  tap(at, 160, 0.12);
}

/**
 * How loud a sound is (its peak and RMS over where it sounds), rendered offline as it would play: for checking that a
 * sound stays quieter than a move (e2e/squads-play.spec.ts, through ?debug). A sample must have loaded (unlockAudio).
 */
export async function measureSound(name: SoundName, seconds = 1): Promise<{ peak: number; rms: number }> {
  const real = { ctx, master };
  const off = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100);
  const g = off.createGain();
  g.gain.value = 0.9;
  g.connect(off.destination);
  ctx = off as unknown as AudioContext;
  master = g;
  try {
    SOUNDS[name](0.005);
  } finally {
    ctx = real.ctx;
    master = real.master;
  }
  const data = (await off.startRendering()).getChannelData(0);
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (const x of data) {
    const a = Math.abs(x);
    peak = Math.max(peak, a);
    if (a > 1e-3) {
      sum += x * x;
      n++;
    }
  }
  return { peak, rms: n ? Math.sqrt(sum / n) : 0 };
}

/** One struck note built from partials: [frequency multiple, level, decay seconds]. */
function strike(at: number, freq: number, partials: readonly (readonly [number, number, number])[], level: number, opts: { glide?: number; type?: OscillatorType } = {}) {
  const c = ctx!;
  for (const [mult, amp, decay] of partials) {
    const o = c.createOscillator();
    o.type = opts.type ?? "sine";
    // A struck pan or bar starts a hair sharp and settles: a touch of warmth.
    o.frequency.setValueAtTime(freq * mult * (1 + (opts.glide ?? 0)), at);
    o.frequency.exponentialRampToValueAtTime(freq * mult, at + 0.04);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level * amp, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(master!);
    o.start(at);
    o.stop(at + decay + 0.02);
  }
}

/** A short soft noise tap (the stick hitting), band-passed around `freq`. */
function tap(at: number, freq: number, level: number) {
  const c = ctx!;
  const len = 0.015;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = 2;
  const g = c.createGain();
  g.gain.value = level;
  src.connect(band).connect(g).connect(master!);
  src.start(at);
}

/**
 * A soft, short "pop": a sine that drops in pitch fast (like a bubble), with a tiny tap on top. Its pitch wanders a
 * little so a run of them doesn't sound mechanical.
 */
function bubblePop(at: number, level: number) {
  const c = ctx!;
  const f = 520 + Math.random() * 160;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f, at);
  o.frequency.exponentialRampToValueAtTime(f * 0.42, at + 0.07);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.32 * level, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + 0.11);
  tap(at, 1800, 0.05 * level);
}

/**
 * Voices for the reveal's "selecting move" roulette, to audition in the sound
 * lab (?soundlab). Each plays one note; the roulette climbs a major arpeggio
 * from `base` (C, E, G, C), and the winner is three of the same note.
 */
export const REEL_VOICES = {
  pan: {
    label: "Steel pan (warm, default)",
    base: 523.25, // C5
    note: (t: number, f: number, l = 1) => {
      strike(t, f, [[1, 1, 0.5], [2, 0.45, 0.32], [3, 0.18, 0.18], [4.02, 0.08, 0.1]], 0.16 * l, { glide: 0.012 });
      tap(t, 2400, 0.08 * l);
    },
  },
  kalimba: {
    label: "Kalimba (soft pluck)",
    base: 523.25,
    note: (t: number, f: number, l = 1) => strike(t, f, [[1, 1, 0.45], [5.4, 0.12, 0.05], [2, 0.12, 0.2]], 0.17 * l),
  },
  marimba: {
    label: "Marimba (wooden)",
    base: 523.25,
    note: (t: number, f: number, l = 1) => strike(t, f, [[1, 1, 0.38], [4, 0.14, 0.07], [10, 0.03, 0.02]], 0.18 * l),
  },
  glock: {
    label: "Glockenspiel (bright bell)",
    base: 1046.5, // C6
    note: (t: number, f: number, l = 1) => strike(t, f, [[1, 1, 0.6], [2.76, 0.3, 0.25], [5.4, 0.12, 0.1]], 0.1 * l),
  },
  musicbox: {
    label: "Music box (tinkly)",
    base: 1046.5,
    note: (t: number, f: number, l = 1) => strike(t, f, [[1, 1, 0.8], [3, 0.15, 0.3], [4.2, 0.05, 0.08]], 0.09 * l),
  },
  chip: {
    label: "8-bit blip",
    base: 1046.5,
    note: (t: number, f: number, l = 1) => strike(t, f, [[1, 1, 0.07], [2, 0.8, 0.05]], 0.05 * l, { type: "square" }),
  },
} as const;
export type ReelVoice = keyof typeof REEL_VOICES;
const VOICE_KEY = "brc.reelVoice";
let reelVoice: ReelVoice = (() => {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    return v && v in REEL_VOICES ? (v as ReelVoice) : "pan";
  } catch {
    return "pan";
  }
})();
export const getReelVoice = () => reelVoice;
export function setReelVoice(v: ReelVoice) {
  reelVoice = v;
  try {
    localStorage.setItem(VOICE_KEY, v);
  } catch {
    // Not important.
  }
}

const ARPEGGIO = [1, 1.26, 1.5, 2]; // C E G C
let rouletteStep = 0;

export type SoundName =
  | "move"
  | "capture"
  | "castle"
  | "tick"
  | "reel"
  | "select"
  | "ripple"
  | "gkSummon"
  | "gkAppear"
  | "gkHyuah"
  | "gkBolt"
  | "gkHit"
  | "gkLeave"
  | "gkSlash"
  | "gkCutIn"
  | "gkWarn"
  | "gkLastLeap"
  | "gkLastCrash"
  | "gkLastSlashes"
  | "gkLastGrunt1"
  | "gkLastGrunt2"
  | "gkLastGroan"
  | "bannerStart"
  | "queenGasp"
  | "menuOpen"
  | "menuClose"
  | "menuSelect"
  | "gavel"
  | "pop"
  | "popSoft"
  | "chat"
  // Boingo the Clown (a raid boss): synthesised, see characters/clown-sounds.ts.
  | "clownBoing"
  | "clownHonk"
  | "clownSqueak"
  | "clownSlideUp"
  | "clownSlideDown"
  | "clownLaugh"
  | "clownSplat"
  | "clownFlip"
  // Ginger (a raid boss, the Freeze boss): synthesised, see characters/gingerbread-sounds.ts.
  | "gingerCrunch"
  | "gingerJingle"
  | "gingerCrackle"
  | "gingerWind"
  // G-REX (a raid boss, the Fire boss): synthesised, see characters/grex-sounds.ts.
  | "grexCrackle"
  | "grexWhoosh"
  | "grexFizz"
  | "grexPoof"
  | "grexPop"
  | "grexRoar"
  | "grexSmack"
  | "grexWhistle"
  // Hollow (a raid boss, the Darkness boss): synthesised, see characters/hollow-sounds.ts.
  | "hollowHum"
  | "hollowCast"
  | "hollowWhisper"
  | "hollowPop"
  | "hollowSmash"
  | "hollowTick"
  | "hollowFound"
  | "hollowMiss"
  | "hollowRelight"
  | "hollowClink"
  | "hollowLash"
  // Big Boy (a raid boss, the baby): synthesised, see characters/bigboy-sounds.ts.
  | "bigboyGiggle"
  | "bigboySlurp"
  | "bigboyWail"
  | "bigboyBoing"
  | "bigboyCrash"
  | "bigboyNom"
  | "bigboyToss"
  | "bigboyClack"
  | "bigboySwish"
  | "bigboyBonk"
  | "bigboyStomp"
  | "bigboyPoof"
  // Sawyer (a raid boss, the raccoon with a saw): synthesised, see characters/sawyer-sounds.ts.
  | "sawyerRev"
  | "sawyerSwing"
  | "sawyerCut"
  | "sawyerCrack"
  | "sawyerTape"
  | "sawyerBigSaw"
  | "sawyerHop"
  | "sawyerRejoin"
  // Wrangler (a raid boss, the cowboy pig): synthesised, see characters/pig-sounds.ts.
  | "pigWhirl"
  | "pigThrow"
  | "pigCatch"
  | "pigTug"
  | "pigTip"
  | "pigLaugh"
  | "pigSnort"
  | "pigStomp"
  | "pigWindup"
  | "pigHop"
  | "pigDraw"
  | "pigYank"
  // The Hidden Boss (admins only, for now): synthesised, see characters/recluse-sounds.ts.
  | "recluseFlip"
  | "recluseShut"
  | "recluseRustle"
  | "recluseHuff"
  | "recluseHum"
  | "recluseThump"
  | "recluseGlow"
  | "recluseSlow"
  | "kingCant"
  // Squads: a short tick in the last seconds of your free time, and the sting as a squad enters sudden death.
  | "sqTick"
  | "sqSting";

const SOUNDS: Record<SoundName, (t: number) => void> = {
  move: (t) => pieceSample("move", t),
  capture: (t) => pieceSample("capture", t),
  castle: castleSample,
  tick: (t) => clockTick(t),
  // One step of the "selecting move" reel: the next note up the arpeggio, with a quick grace note above.
  reel: (t) => {
    const v = REEL_VOICES[reelVoice];
    const f = v.base * ARPEGGIO[rouletteStep++ % ARPEGGIO.length]!;
    v.note(t, f);
    v.note(t + 0.035, f * 1.5, 0.45);
  },
  // The winner: three of the same note, in time with its three blinks.
  select: (t) => {
    rouletteStep = 0;
    const v = REEL_VOICES[reelVoice];
    for (let i = 0; i < 3; i++) v.note(t + i * 0.2, v.base * 1.5, 1.2);
  },
  gkSummon: (t) => sample("gkSummon", t, 0.7),
  gkAppear: (t) => sample("gkAppear", t, 0.7),
  gkHyuah: (t) => sample("gkHyuah", t, 0.9),
  gkBolt: (t) => sample("gkBolt", t, 0.8),
  gkHit: (t) => sample("gkHit", t, 0.8),
  gkSlash: (t) => sample("gkSlash", t, 0.85),
  gkCutIn: (t) => sample("gkCutIn", t, 0.85),
  gkWarn: (t) => sample("gkWarn", t, 0.85),
  gkLastLeap: (t) => sample("gkLastLeap", t, 0.8),
  gkLastCrash: (t) => sample("gkLastCrash", t, 0.95),
  gkLastSlashes: (t) => sample("gkLastSlashes", t, 0.7),
  gkLastGrunt1: (t) => sample("gkLastGrunt1", t, 0.9),
  gkLastGrunt2: (t) => sample("gkLastGrunt2", t, 0.9),
  gkLastGroan: (t) => sample("gkLastGroan", t, 0.95),
  bannerStart: (t) => sample("bannerStart", t, 0.9),
  // A woman's short gasp, quieter than a move. Unused for now (Eric, Oct 11: the queen banners are silent; it sounded wrong).
  queenGasp: (t) => sample("queenGasp", t, 0.9),
  menuOpen: (t) => sample("menuOpen", t, 0.7),
  menuClose: (t) => sample("menuClose", t, 0.7),
  menuSelect: (t) => sample("menuSelect", t, 0.8),
  gkLeave: (t) => sample("gkLeave", t, 0.6),
  // The judge's gavel at a cut: two heavy wooden knocks (the classic capture and move sounds, pitched down to about
  // half, whatever the pick: as it was before Oct 12, the classics being the defaults again).
  gavel: (t) => {
    for (const [dt, level] of [[0, 1], [0.26, 0.85]] as const) {
      sample("capture", t + dt, level, 0.55);
      sample("move", t + dt, level * 0.8, 0.45);
    }
  },
  // The queue: a pawn pops into its seat (a short soft "pop"), and a bot's, quieter.
  pop: (t) => bubblePop(t, 1),
  popSoft: (t) => bubblePop(t, 0.45),
  // Quick chat: a team message arrives. A soft, short tick, well under a move's knock.
  chat: (t) => {
    clockTick(t, 0.5 * QUICK_CHAT.tickLevel);
    tap(t + 0.012, 2600, 0.2 * QUICK_CHAT.tickLevel);
  },
  clownBoing: clown("boing"),
  clownHonk: clown("honk"),
  clownSqueak: clown("squeak"),
  clownSlideUp: clown("slideUp"),
  clownSlideDown: clown("slideDown"),
  clownLaugh: clown("laugh"),
  clownSplat: clown("splat"),
  clownFlip: clown("flip"),
  gingerCrunch: ginger("crunch"),
  gingerJingle: ginger("jingle"),
  gingerCrackle: ginger("crackle"),
  gingerWind: ginger("wind"),
  grexCrackle: grex("crackle"),
  grexWhoosh: grex("whoosh"),
  grexFizz: grex("fizz"),
  grexPoof: grex("poof"),
  grexPop: grex("pop"),
  grexRoar: grex("roar"),
  grexSmack: grex("smack"),
  grexWhistle,
  hollowHum: hollow("hum"),
  hollowCast: hollow("cast"),
  hollowWhisper: hollow("whisper"),
  hollowPop: hollow("pop"),
  hollowSmash: hollow("smash"),
  hollowTick: hollow("tick"),
  hollowFound: hollow("found"),
  hollowMiss: hollow("miss"),
  hollowRelight: hollow("relight"),
  hollowClink: hollow("clink"),
  hollowLash: hollow("lash"),
  bigboyGiggle: bigBoy("giggle"),
  bigboySlurp: bigBoy("slurp"),
  bigboyWail: bigBoy("wail"),
  bigboyBoing: bigBoy("boing"),
  bigboyCrash: bigBoy("crash"),
  bigboyNom: bigBoy("nom"),
  bigboyToss: bigBoy("toss"),
  bigboyClack: bigBoy("clack"),
  bigboySwish: bigBoy("swish"),
  bigboyBonk: bigBoy("bonk"),
  bigboyStomp: bigBoy("stomp"),
  bigboyPoof: bigBoy("poof"),
  sawyerRev: sawyer("rev"),
  sawyerSwing: sawyer("swing"),
  sawyerCut: sawyer("cut"),
  sawyerCrack: sawyer("crack"),
  sawyerTape: sawyer("tape"),
  sawyerBigSaw: sawyer("bigsaw"),
  sawyerHop: sawyer("hop"),
  sawyerRejoin: sawyer("rejoin"),
  pigWhirl: pig("whirl"),
  pigThrow: pig("throw"),
  pigCatch: pig("catch"),
  pigTug: pig("tug"),
  pigTip: pig("tip"),
  pigLaugh: pig("laugh"),
  pigSnort: pig("snort"),
  pigStomp: pig("stomp"),
  pigWindup: pig("windup"),
  pigHop: pig("hop"),
  pigDraw: pig("draw"),
  pigYank: pig("yank"),
  recluseFlip: recluse("flip"),
  recluseShut: recluse("shut"),
  recluseRustle: recluse("rustle"),
  recluseHuff: recluse("huff"),
  recluseHum: recluse("hum"),
  recluseThump: recluse("thump"),
  recluseGlow: recluse("glow"),
  recluseSlow: recluse("slow"),
  kingCant,
  sqTick: (t) => clockTick(t, 0.22),
  sqSting,
  // Every board's move landing after a round: a quick ripple of soft knocks (the picked move sound), one per board.
  ripple: (t) => {
    for (let i = 0; i < 8; i++) pieceSample("move", t + i * 0.045, 0.22 + 0.04 * (i % 3), 1.25 + 0.05 * (i % 4));
  },
};

/**
 * Synthesised sounds that can be made ahead (warmSounds), by name: Boingo's, Ginger's, Jefferson's (his three candle
 * whistles and the crackle took about 180 ms to make the first time a shot went up, on a computer: Oct 14), Hollow's
 * (his smash took 150 ms on a computer), Big Boy's, Sawyer's, Wrangler's. Each a list of its module and name (a few for one cue).
 */
const MAKE: Partial<Record<SoundName, readonly BossSound[]>> = {
  clownBoing: [["clown", "boing"]],
  clownHonk: [["clown", "honk"]],
  clownSqueak: [["clown", "squeak"]],
  clownSlideUp: [["clown", "slideUp"]],
  clownSlideDown: [["clown", "slideDown"]],
  clownLaugh: [["clown", "laugh"]],
  clownSplat: [["clown", "splat"]],
  clownFlip: [["clown", "flip"]],
  gingerCrunch: [["ginger", "crunch"]],
  gingerJingle: [["ginger", "jingle"]],
  gingerCrackle: [["ginger", "crackle"]],
  gingerWind: [["ginger", "wind"]],
  grexCrackle: [["grex", "crackle"]],
  grexWhoosh: [["grex", "whoosh"]],
  grexFizz: [["grex", "fizz"]],
  grexPoof: [["grex", "poof"]],
  grexPop: [["grex", "pop"]],
  grexRoar: [["grex", "roar"]],
  grexSmack: [["grex", "smack"]],
  grexWhistle: [...WHISTLES, "sparkle" as const].map((w): BossSound => ["grex", w]),
  hollowHum: [["hollow", "hum"]],
  hollowCast: [["hollow", "cast"]],
  hollowWhisper: [["hollow", "whisper"]],
  hollowPop: [["hollow", "pop"]],
  hollowSmash: [["hollow", "smash"]],
  hollowTick: [["hollow", "tick"]],
  hollowFound: [["hollow", "found"]],
  hollowMiss: [["hollow", "miss"]],
  hollowRelight: [["hollow", "relight"]],
  hollowClink: [["hollow", "clink"]],
  hollowLash: [["hollow", "lash"]],
  bigboyGiggle: [["bigBoy", "giggle"]],
  bigboySlurp: [["bigBoy", "slurp"]],
  bigboyWail: [["bigBoy", "wail"]],
  bigboyBoing: [["bigBoy", "boing"]],
  bigboyCrash: [["bigBoy", "crash"]],
  bigboyNom: [["bigBoy", "nom"]],
  bigboyToss: [["bigBoy", "toss"]],
  bigboyClack: [["bigBoy", "clack"]],
  bigboySwish: [["bigBoy", "swish"]],
  bigboyBonk: [["bigBoy", "bonk"]],
  bigboyStomp: [["bigBoy", "stomp"]],
  bigboyPoof: [["bigBoy", "poof"]],
  sawyerRev: [["sawyer", "rev"]],
  sawyerSwing: [["sawyer", "swing"]],
  sawyerCut: [["sawyer", "cut"]],
  sawyerCrack: [["sawyer", "crack"]],
  sawyerTape: [["sawyer", "tape"]],
  sawyerBigSaw: [["sawyer", "bigsaw"]],
  sawyerHop: [["sawyer", "hop"]],
  sawyerRejoin: [["sawyer", "rejoin"]],
  pigWhirl: [["pig", "whirl"]],
  pigThrow: [["pig", "throw"]],
  pigCatch: [["pig", "catch"]],
  pigTug: [["pig", "tug"]],
  pigTip: [["pig", "tip"]],
  pigLaugh: [["pig", "laugh"]],
  pigSnort: [["pig", "snort"]],
  pigStomp: [["pig", "stomp"]],
  pigWindup: [["pig", "windup"]],
  pigHop: [["pig", "hop"]],
  pigDraw: [["pig", "draw"]],
  pigYank: [["pig", "yank"]],
  recluseFlip: [["recluse", "flip"]],
  recluseShut: [["recluse", "shut"]],
  recluseRustle: [["recluse", "rustle"]],
  recluseHuff: [["recluse", "huff"]],
  recluseHum: [["recluse", "hum"]],
  recluseThump: [["recluse", "thump"]],
  recluseGlow: [["recluse", "glow"]],
  recluseSlow: [["recluse", "slow"]],
  kingCant: [["godKing", "cant"]],
};
/** The sound worker (sound-worker.ts), started with the first warmSounds; null where there's none (or it failed). */
let worker: Worker | null | undefined;
/** Sounds sent to the worker and not back yet: made in idle moments instead if it fails. */
const pending = new Set<string>();
const cached = ([module, name]: BossSound, rate: number) => soundCache(module).has(`${name}@${rate}`);

function soundWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./sound-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ sound: BossSound; rate: number; data: Float32Array | null }>) => {
      const { sound, rate, data } = e.data;
      pending.delete(JSON.stringify([sound, rate]));
      if (data && !cached(sound, rate)) soundCache(sound[0]).set(`${sound[1]}@${rate}`, data);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      const left = [...pending].map((k) => JSON.parse(k) as [BossSound, number]);
      pending.clear();
      for (const [sound, rate] of left) makeIdle(sound, rate);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Without the worker: one sound per idle moment (each still one task, as long as it takes to make). */
const idleQueue: [BossSound, number][] = [];
function makeIdle(sound: BossSound, rate: number) {
  const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 60));
  const next = () => {
    const job = idleQueue.shift();
    if (!job) return;
    if (!cached(...job)) makeBossSound(...job);
    if (idleQueue.length) idle(next);
  };
  idleQueue.push([sound, rate]);
  if (idleQueue.length === 1) idle(next);
}

/**
 * Makes a boss's synthesized sounds ahead of time, so the first time one plays (a bulb smashed in the middle of his
 * ultimate) a slow phone doesn't stall making it. They're made in the sound worker, off the page's thread: one can take
 * 50 to 180 ms on a slowed phone, a dropped frame or ten if it were made on the page during the intro (Big Boy's, Oct 14).
 * Without a worker, one per idle moment. Needs the audio context (for its sample rate): a no-op before the first tap.
 */
export function warmSounds(names: readonly SoundName[]): void {
  if (!ctx) return;
  const rate = ctx.sampleRate;
  const todo = [...new Set(names)].flatMap((n) => MAKE[n] ?? []).filter((s) => !cached(s, rate) && !pending.has(JSON.stringify([s, rate])));
  const w = soundWorker();
  for (const sound of todo) {
    if (!w) {
      makeIdle(sound, rate);
      continue;
    }
    pending.add(JSON.stringify([sound, rate]));
    w.postMessage({ sound, rate });
  }
}

/** Plays a sound; `voice` previews a roulette voice without choosing it (the sound lab). */
export function play(name: SoundName, voice?: ReelVoice) {
  // Tests read this log (set window.__soundLog = [] to start one).
  (globalThis as { __soundLog?: string[] }).__soundLog?.push(`${name}:${ctx?.state ?? "none"}${muted ? ":muted" : ""}`);
  if (muted || !ctx || !master || ctx.state !== "running") return;
  const chosen = reelVoice;
  if (voice) reelVoice = voice;
  try {
    SOUNDS[name](ctx.currentTime + 0.005);
  } catch {
    // Ignore audio errors.
  } finally {
    reelVoice = chosen;
  }
}
