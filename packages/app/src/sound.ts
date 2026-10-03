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

const SAMPLE_FILES = { move: "/sounds/move.mp3", capture: "/sounds/capture.mp3", castle: "/sounds/castle.mp3" } as const;

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

/** A bright, game-like blip: a square wave with a sine an octave up, quick attack and short decay. */
function blip(at: number, freq: number, len = 0.08, level = 0.05) {
  const c = ctx!;
  for (const [type, mult, amp] of [
    ["square", 1, 1],
    ["sine", 2, 0.8],
  ] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level * amp, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(master!);
    o.start(at);
    o.stop(at + len + 0.02);
  }
}

// The roulette climbs a major arpeggio and starts again, like a kart racer's item roulette.
const ROULETTE = [1046.5, 1318.5, 1568, 2093]; // C6 E6 G6 C7
let rouletteStep = 0;

export type SoundName = "move" | "capture" | "castle" | "tick" | "reel" | "select";

const SOUNDS: Record<SoundName, (t: number) => void> = {
  move: (t) => sample("move", t),
  capture: (t) => sample("capture", t),
  castle: (t) => sample("castle", t),
  tick: (t) => clockTick(t),
  // One step of the "selecting move" reel: a quick two-note flick up the arpeggio.
  reel: (t) => {
    const f = ROULETTE[rouletteStep++ % ROULETTE.length]!;
    blip(t, f, 0.06);
    blip(t + 0.03, f * 1.5, 0.05, 0.035);
  },
  // The winner: three of the same tone, in time with its three blinks.
  select: (t) => {
    rouletteStep = 0;
    for (let i = 0; i < 3; i++) blip(t + i * 0.2, 1568, 0.15, 0.06);
  },
};

export function play(name: SoundName) {
  // Tests read this log (set window.__soundLog = [] to start one).
  (globalThis as { __soundLog?: string[] }).__soundLog?.push(`${name}:${ctx?.state ?? "none"}${muted ? ":muted" : ""}`);
  if (muted || !ctx || !master || ctx.state !== "running") return;
  try {
    SOUNDS[name](ctx.currentTime + 0.005);
  } catch {
    // Ignore audio errors.
  }
}
