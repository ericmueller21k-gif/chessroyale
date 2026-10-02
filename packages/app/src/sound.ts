/**
 * Game sounds. Pieces use recorded wooden knocks (move, capture, castle, from
 * PyChess, GPL-3); cues like the round start or the reveal use a soft
 * marimba-style voice synthesised with Web Audio, kept low and warm. Browsers
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
      // A gentle low-pass keeps every cue soft on phone speakers.
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

/** One soft marimba-like note: a sine with a quick, warm decay and a faint wooden overtone. */
function mallet(at: number, freq: number, level = 0.2, decay = 0.9) {
  const c = ctx!;
  for (const [mult, amp, len] of [
    [1, 1, decay],
    [4, 0.12, decay * 0.18],
    [10, 0.03, 0.03],
  ] as const) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level * amp, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(master!);
    o.start(at);
    o.stop(at + len + 0.02);
  }
}

// Note frequencies (Hz), kept in a warm middle range.
const A3 = 220, C4 = 261.6, D4 = 293.7, E4 = 329.6, G4 = 392, A4 = 440, B4 = 493.9, C5 = 523.3, D5 = 587.3, E5 = 659.3, G5 = 784, A5 = 880;

export type SoundName =
  | "move"
  | "capture"
  | "castle"
  | "roundStart"
  | "reelTick"
  | "chosen"
  | "count"
  | "countGo"
  | "powerUp"
  | "safe"
  | "out"
  | "win"
  | "tick"
  | "tickLast";

const SOUNDS: Record<SoundName, (t: number) => void> = {
  move: (t) => sample("move", t),
  capture: (t) => sample("capture", t),
  castle: (t) => sample("castle", t),
  roundStart: (t) => {
    mallet(t, E4, 0.2, 1.2);
    mallet(t + 0.14, B4, 0.16, 1.4);
  },
  // The "selecting move" reel: a light wooden tick per step.
  reelTick: (t) => sample("move", t, 0.35, 1.6),
  chosen: (t) => [G4, B4, D5].forEach((f, i) => mallet(t + i * 0.07, f, 0.17, 1.1)),
  count: (t) => mallet(t, A4, 0.14, 0.5),
  countGo: (t) => mallet(t, D5, 0.16, 0.8),
  powerUp: (t) => [D5, E5, G5, A5].forEach((f, i) => mallet(t + i * 0.06, f, 0.12, 0.6)),
  safe: (t) => {
    [C4, E4, G4].forEach((f, i) => mallet(t + i * 0.09, f, 0.16, 1.2));
    mallet(t + 0.3, C5, 0.16, 1.6);
  },
  out: (t) => [E4, C4, A3].forEach((f, i) => mallet(t + i * 0.22, f, 0.2, 1.2)),
  win: (t) => {
    [C4, E4, G4, C5, E5].forEach((f, i) => mallet(t + i * 0.1, f, 0.16, 1.2));
    [C4, G4, C5, E5].forEach((f) => mallet(t + 0.6, f, 0.12, 2.2));
  },
  tick: (t) => mallet(t, D4, 0.16, 0.25),
  tickLast: (t) => mallet(t, A4, 0.18, 0.4),
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
