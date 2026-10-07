/**
 * Game sounds: pieces use recorded wooden knocks (move, capture, castle, from
 * PyChess, GPL-3); every timer uses one clean clock tick; the reveal's
 * "selecting move" reel has a roulette-style arpeggio and three tones for the
 * winner (all synthesised with Web Audio, placeholders until real samples). Browsers
 * only allow audio after a tap, so call unlockAudio() from one. The mute
 * choice is remembered on the device.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const samples = new Map<string, AudioBuffer>();
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
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  castle: "/sounds/castle.mp3",
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
  bossRoar: "/sounds/banner/boss-roar.mp3",
  menuOpen: "/sounds/menu/open.mp3",
  menuClose: "/sounds/menu/close.mp3",
  menuSelect: "/sounds/menu/select.mp3",
} as const;

/** Call from a tap so browsers allow sound later. Also loads the recorded samples. */
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      // A gentle low-pass keeps every sound soft on phone speakers.
      const soften = ctx.createBiquadFilter();
      soften.type = "lowpass";
      soften.frequency.value = 6000;
      master.connect(soften).connect(ctx.destination);
      for (const [name, url] of Object.entries(SAMPLE_FILES)) {
        void fetch(url)
          .then((r) => r.arrayBuffer())
          .then((b) => ctx!.decodeAudioData(b))
          .then((buf) => samples.set(name, buf))
          .catch(() => undefined);
      }
    }
    void ctx.resume();
  } catch {
    // No audio on this device: the game works silently.
  }
}

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
  if (!buf) return;
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx!.createGain();
  g.gain.value = level;
  src.connect(g).connect(master!);
  src.start(at);
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
  | "bossRoar"
  | "menuOpen"
  | "menuClose"
  | "menuSelect"
  | "gavel"
  | "pop"
  | "popSoft";

const SOUNDS: Record<SoundName, (t: number) => void> = {
  move: (t) => sample("move", t),
  capture: (t) => sample("capture", t),
  castle: (t) => sample("castle", t),
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
  bossRoar: (t) => sample("bossRoar", t, 0.9),
  menuOpen: (t) => sample("menuOpen", t, 0.7),
  menuClose: (t) => sample("menuClose", t, 0.7),
  menuSelect: (t) => sample("menuSelect", t, 0.8),
  gkLeave: (t) => sample("gkLeave", t, 0.6),
  // The judge's gavel at a cut: two heavy wooden knocks (the piece sounds, pitched down).
  gavel: (t) => {
    for (const [dt, level] of [[0, 1], [0.26, 0.85]] as const) {
      sample("capture", t + dt, level, 0.55);
      sample("move", t + dt, level * 0.8, 0.45);
    }
  },
  // The queue: a pawn pops into its seat (a short soft "pop"), and a bot's, quieter.
  pop: (t) => bubblePop(t, 1),
  popSoft: (t) => bubblePop(t, 0.45),
  // Every board's move landing after a round: a quick ripple of soft wooden knocks, one per board.
  ripple: (t) => {
    for (let i = 0; i < 8; i++) sample("move", t + i * 0.045, 0.22 + 0.04 * (i % 3), 1.25 + 0.05 * (i % 4));
  },
};

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
