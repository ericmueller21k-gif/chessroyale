/**
 * The chiptune version: score.ts played on chip voices built from the game's own sound blocks (packages/app/src/characters/
 * synth.ts: osc, lowpass, bandpass, noise, render): two pulse channels (lead and chord arpeggios), a 4-bit triangle bass and a
 * noise channel for the drums, plus a bell pulse and a short echo, the way a 16-bit console would. No samples, no files.
 *   npx tsx scripts/reel/music/chiptune.ts <out dir> [phone|wide]
 * Writes <out>/chiptune-<cue>-raw.wav (the loop plus a 2 s tail; master.py wraps and masters it).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { bandpass, lowpass, noise, osc, render, type Voice } from "../../../packages/app/src/characters/synth.ts";
import { PHONE, WIDE, score, timeline, type Note } from "./score.ts";

const RATE = 48000;
const TAIL = 2;

const hz = (p: number) => 440 * 2 ** ((p - 69) / 12);
const pulse = (duty: number) => (p: number) => (p < duty ? 1 : -1);
/** The 4-bit stepped triangle of the old consoles' bass channel. */
const tri4 = (p: number) => Math.round((p < 0.5 ? 4 * p - 1 : 3 - 4 * p) * 7.5) / 7.5;

/** Attack-decay-sustain-release in seconds; `len` is when the release starts. */
function adsr(a: number, d: number, s: number, r: number, len: number) {
  return (t: number) => {
    if (t < a) return t / a;
    if (t < len) return s + (1 - s) * Math.exp(-(t - a) / d);
    const at = s + (1 - s) * Math.exp(-(len - a) / d);
    return Math.max(0, at * (1 - (t - len) / r));
  };
}

const mix = { L: new Float32Array(0), R: new Float32Array(0) };
const echo = { L: new Float32Array(0), R: new Float32Array(0) };
function place(buf: Float32Array, at: number, gain: number, pan: number, bus = mix) {
  const i0 = Math.round(at * RATE);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = 0; i < buf.length && i0 + i < bus.L.length; i++) {
    if (i0 + i < 0) continue;
    bus.L[i0 + i]! += buf[i]! * gl;
    bus.R[i0 + i]! += buf[i]! * gr;
  }
}

/** A pitched chip note: a pulse (or triangle) with an envelope and, on long notes, a delayed vibrato. */
function tone(p: number, len: number, shape: (ph: number) => number, env: (t: number) => number, rel: number, vib = 0, slide = 0) {
  const f0 = hz(p);
  const v = osc(RATE, (t) => f0 * (1 + vib * Math.max(0, Math.min(1, (t - 0.18) / 0.15)) * Math.sin(2 * Math.PI * 5.5 * t)) * (slide && t < 0.03 ? 2 ** ((slide * (0.03 - t)) / 0.03 / 12) : 1), shape);
  const soft = lowpass(RATE, 9000, v);
  return render(RATE, len + rel, (t) => soft(t) * env(t));
}

/** A chord as a fast arpeggio on one pulse channel (a new note every 2 frames of 60 Hz). */
function arpChord(ps: number[], len: number, duty: number, env: (t: number) => number, rel: number) {
  const fs = ps.map(hz);
  const step = 2 / 60;
  const v = osc(RATE, (t) => fs[Math.floor(t / step) % fs.length]!, pulse(duty));
  const soft = lowpass(RATE, 7000, v);
  return render(RATE, len + rel, (t) => soft(t) * env(t));
}

function noiseHit(len: number, env: (t: number) => number, color: (v: Voice) => Voice, seed: number) {
  const v = color(noise(seed));
  return render(RATE, len, (t) => v(t) * env(t));
}
/** A one-pole high-pass (the noise minus its low-passed self): hats and cymbals. */
const highpass = (cut: number) => (v: Voice) => {
  const a = 1 - Math.exp((-2 * Math.PI * cut) / RATE);
  let y = 0;
  return (t: number) => {
    const x = v(t);
    y += a * (x - y);
    return x - y;
  };
};

const cues = process.argv[3] === "wide" ? WIDE : PHONE;
const tl = timeline(cues);
const notes = score(cues).filter((n) => !process.env.ONLY || process.env.ONLY.split(",").includes(`${n.sec}.${n.role}`) || process.env.ONLY.split(",").includes(n.sec));
const total = Math.ceil((cues.end + TAIL) * RATE);
mix.L = new Float32Array(total);
mix.R = new Float32Array(total);
echo.L = new Float32Array(total);
echo.R = new Float32Array(total);

// Group chord tones (same role, section, start and length) so each chord is one arpeggio.
const chords = new Map<string, Note[]>();
let seed = 7;
for (const n of notes) {
  const vel = n.v / 127;
  switch (n.role) {
    case "lead": {
      const duty = n.sec === "town" || n.sec === "card" ? 0.25 : n.sec === "ranked" || n.sec === "rise" ? 0.5 : 0.125;
      const rel = 0.05;
      const buf = tone(n.p, n.d, pulse(duty), adsr(0.004, 0.25, 0.7, rel, n.d), rel, n.d > 0.35 ? 0.006 : 0, n.sec === "ranked" ? 0 : 0.5);
      place(buf, n.t, 0.2 * vel, -0.1);
      place(buf, n.t, 0.2 * vel, -0.1, echo);
      break;
    }
    case "harm":
    case "stab":
    case "pad": {
      const key = `${n.role}|${n.sec}|${n.t.toFixed(4)}|${n.d.toFixed(4)}`;
      if (!chords.has(key)) chords.set(key, []);
      chords.get(key)!.push(n);
      break;
    }
    case "bass": {
      // The triangle can't sound much below A1: low notes go up an octave (and the Hidden Boss's doubled low D sounds once).
      if (n.sec === "hidden" && n.p < 33) break;
      const p = n.p < 33 ? n.p + 12 : n.p;
      const rel = 0.03;
      const buf = tone(p, n.d, tri4, adsr(0.002, 0.4, n.sec === "hidden" ? 0.5 : 0.85, rel, n.d), rel);
      place(buf, n.t, (n.sec === "hidden" ? 0.3 : 0.42) * vel, 0);
      break;
    }
    case "ost": {
      const rel = 0.02;
      place(tone(n.p, n.d, pulse(0.25), adsr(0.002, 0.06, 0.3, rel, n.d), rel), n.t, 0.09 * vel, 0.35);
      break;
    }
    case "arp": {
      const rel = Math.min(1.2, n.d + 0.5);
      const buf = tone(n.p, 0.02, pulse(0.125), (t) => Math.exp(-t * (n.sec === "hidden" ? 2.2 : 6)), rel);
      place(buf, n.t, 0.13 * vel, 0.4);
      place(buf, n.t, 0.13 * vel, 0.4, echo);
      break;
    }
    case "kick": {
      const v = osc(RATE, (t) => 45 + 140 * Math.exp(-t * 38), tri4);
      place(render(RATE, 0.16, (t) => v(t) * Math.exp(-t * 18)), n.t, 0.62 * vel, 0);
      break;
    }
    case "boom": {
      const v = osc(RATE, (t) => 32 + 90 * Math.exp(-t * 12), tri4);
      const rumble = lowpass(RATE, 180, noise(seed++));
      place(render(RATE, n.d, (t) => (v(t) * 0.8 + rumble(t) * 2.2) * Math.exp(-t * 2.2)), n.t, 0.55 * vel, 0);
      break;
    }
    case "snare":
    case "roll": {
      const body = osc(RATE, (t) => 190 * Math.exp(-t * 8), tri4);
      const len = n.role === "roll" ? 0.07 : 0.14;
      const nz = noiseHit(len, (t) => Math.exp(-t * (n.role === "roll" ? 45 : 24)), (v) => bandpass(RATE, () => 2600, 0.7, v), seed++);
      const buf = render(RATE, len, (t) => nz[Math.floor(t * RATE)]! * 1.6 + body(t) * 0.35 * Math.exp(-t * 30));
      place(buf, n.t, (n.role === "roll" ? 0.2 : 0.28) * vel, 0.1);
      break;
    }
    case "hat": {
      const buf = noiseHit(0.04, (t) => Math.exp(-t * 90), highpass(6000), seed++);
      place(buf, n.t, 0.12 * vel, 0.3);
      break;
    }
    case "crash": {
      const buf = noiseHit(n.d, (t) => Math.exp(-t * 2.4), highpass(3500), seed++);
      place(buf, n.t, 0.14 * vel, -0.2);
      break;
    }
    case "swell": {
      const buf = noiseHit(n.d + 0.04, (t) => (Math.min(1, t / n.d) ** 3) * (t > n.d ? Math.exp(-(t - n.d) * 60) : 1), (v) => bandpass(RATE, (t) => 1500 + 6000 * Math.min(1, t / n.d), 1.2, v), seed++);
      place(buf, n.t, 0.16 * vel, 0);
      break;
    }
    case "timp": {
      const p = n.p < 40 ? n.p + 12 : n.p;
      const v = osc(RATE, (t) => hz(p) * (1 + 0.06 * Math.exp(-t * 30)), tri4);
      const len = Math.min(n.d, 0.6) + 0.1;
      place(render(RATE, len, (t) => v(t) * Math.exp(-t * 7)), n.t, 0.3 * vel, -0.15);
      break;
    }
  }
}
for (const group of chords.values()) {
  const n = group[0]!;
  const ps = group.map((g) => g.p).sort((a, b) => a - b);
  const vel = Math.max(...group.map((g) => g.v)) / 127;
  if (n.role === "pad") {
    // The Hidden Boss's pad: each tone a soft, slow, low-passed pulse (no arpeggio: something held and dark).
    for (const g of group) {
      const v = lowpass(RATE, 700, osc(RATE, () => hz(g.p) * 1.002, pulse(0.3)));
      const buf = render(RATE, g.d + 0.4, (t) => v(t) * Math.min(1, t / 0.8) * (t > g.d ? Math.max(0, 1 - (t - g.d) / 0.4) : 1));
      place(buf, g.t, 0.07 * (g.v / 127), g.p % 2 ? -0.4 : 0.4);
    }
    continue;
  }
  const short = n.role === "stab";
  const rel = short ? 0.03 : 0.06;
  const env = short ? adsr(0.002, 0.1, 0.35, rel, n.d) : adsr(0.01, 0.4, 0.75, rel, n.d);
  place(arpChord(ps, n.d, n.sec === "town" ? 0.5 : 0.25, env, rel), n.t, (short ? 0.13 : 0.1) * vel, 0.25);
}

// The echo: a dotted 8th (of bars 1-7), bouncing left and right, quieter each time (wet only: the dry notes are in the mix).
const delay = Math.round(0.75 * tl.b0 * RATE);
const wetL = new Float32Array(total);
const wetR = new Float32Array(total);
for (let i = delay; i < total; i++) {
  wetL[i] = 0.32 * (echo.L[i - delay]! + echo.R[i - delay]!) * 0.5 + 0.42 * wetR[i - delay]!;
  wetR[i] = 0.42 * wetL[i - delay]!;
  mix.L[i]! += wetL[i]!;
  mix.R[i]! += wetR[i]!;
}

/** 32-bit float stereo WAV. */
function wav(L: Float32Array, R: Float32Array): Buffer {
  const n = L.length;
  const b = Buffer.alloc(44 + n * 8);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 8, 28);
  b.writeUInt16LE(8, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    b.writeFloatLE(L[i]!, 44 + i * 8);
    b.writeFloatLE(R[i]!, 48 + i * 8);
  }
  return b;
}
const out = join(process.argv[2] ?? ".", `chiptune-${cues.name}-raw.wav`);
writeFileSync(out, wav(mix.L, mix.R));
console.log(`${notes.length} notes, ${chords.size} chords; ${tl.bpm.toFixed(1)} bpm; ${out}`);
