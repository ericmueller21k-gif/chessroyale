/**
 * The orchestral version: score.ts arranged for strings, brass, timpani, a choir, bells and an orchestra kit, written as a
 * standard MIDI file, then played by FluidSynth (real music software) through the FluidR3 GM soundfont (MIT license).
 *   npx tsx scripts/reel/music/orchestra.ts <out dir> [phone|wide]
 * Writes <out>/orchestra-<cue>.mid and <out>/orchestra-<cue>-raw.wav (the loop plus a 4 s tail; master.py wraps and masters it).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PHONE, WIDE, score, timeline, type Note, type Role, type Section } from "./score.ts";

const SOUNDFONT = process.env.SOUNDFONT ?? "/usr/share/sounds/sf2/FluidR3_GM.sf2";
const TAIL = 4;

/** The players: MIDI channel → GM program (bank 0 unless noted), level, pan, reverb send. */
const CH: { prog: number; bank?: number; vol: number; pan: number; rev: number; name: string }[] = [
  { prog: 48, vol: 100, pan: 64, rev: 70, name: "strings" },
  { prog: 44, vol: 96, pan: 60, rev: 70, name: "tremolo strings" },
  { prog: 56, vol: 96, pan: 72, rev: 60, name: "trumpet" },
  { prog: 60, vol: 108, pan: 52, rev: 70, name: "French horns" },
  { prog: 61, vol: 92, pan: 66, rev: 60, name: "brass section" },
  { prog: 47, vol: 112, pan: 58, rev: 60, name: "timpani" },
  { prog: 52, vol: 78, pan: 64, rev: 90, name: "choir (ah)" },
  { prog: 53, vol: 92, pan: 64, rev: 90, name: "choir (oo)" },
  { prog: 9, vol: 78, pan: 84, rev: 80, name: "glockenspiel" },
  { prog: 48, bank: 128, vol: 100, pan: 64, rev: 55, name: "orchestra kit" },
  { prog: 73, vol: 100, pan: 78, rev: 60, name: "flute" },
  { prog: 45, vol: 96, pan: 46, rev: 55, name: "pizzicato strings" },
  { prog: 43, vol: 104, pan: 56, rev: 50, name: "contrabasses" },
  { prog: 42, vol: 92, pan: 50, rev: 55, name: "cellos" },
  { prog: 8, vol: 96, pan: 74, rev: 75, name: "celesta" },
  { prog: 119, vol: 90, pan: 64, rev: 60, name: "reverse cymbal" },
];

/** Who plays what: [channel, transpose, velocity ×, length ×]. */
type Part = [ch: number, tr?: number, vel?: number, len?: number];
const ARRANGE: Partial<Record<Role, Partial<Record<Section | "*", Part[]>>>> = {
  lead: {
    crowd: [[2, 0, 1.08], [0, -12, 0.85], [3, -12, 0.7]],
    town: [[10, 0, 1.1], [8, 0, 0.45]],
    card: [[10], [2, 0, 0.75]],
    rise: [[3, -12], [2, -12, 0.6]],
    hit: [[2], [3, -12]],
    ranked: [[3, -12], [0, 0, 0.7]],
    run: [[2, 0, 0.85], [0, 0, 0.8]],
    top: [[2], [3, -12]],
    pickup: [[2], [0, 0, 0.8]],
  },
  harm: {
    crowd: [[0], [3, -12, 0.75], [4, 0, 0.7]],
    crib: [[0, 0, 0.8]],
    rise: [[1], [3, -12, 0.7]],
    hit: [[0], [4, 0, 0.8], [6, 0, 0.85]],
    ranked: [[0]],
    run: [[1], [6, 0, 0.7]],
    top: [[0], [4, 0, 0.8], [6, 0, 0.8], [3, -12, 0.8]],
    pickup: [[1], [4, 0, 0.7]],
  },
  stab: { town: [[11, 0, 1.1]], card: [[4], [11], [0, 0, 0.8, 0.6]], hit: [[4]], top: [[4]] },
  bass: {
    "*": [[12], [13, 12, 0.85]],
    town: [[11, 12, 1.1], [12, 0, 0.6, 0.5]],
    crib: [[11, 12]],
    ranked: [[13, 12], [12, 0, 0.9]],
    hidden: [[12, 0, 0.85], [13, 12, 0.4]],
  },
  ost: { ranked: [[13, 0, 0.9]] },
  arp: { crib: [[14], [8, 0, 0.55]], run: [[8]], top: [[8], [14, -12, 0.8]], hidden: [[14], [8, 0, 0.5]] },
  pad: { hidden: [[7, 0, 0.85], [1, -12, 0.4]] },
  timp: { "*": [[5]] },
};
/** Velocity × per section: the tutti hits come down and the busy sections up, so the loudness evens out under the master. */
const SECTION_GAIN: Partial<Record<Section, number>> = { hit: 0.84, top: 0.84, hidden: 0.74, crowd: 1.1, ranked: 1.12, rise: 1.06, town: 1.08, crib: 1.05 };
/** FluidR3's reverse cymbal: when its swell peaks (s) by key, measured by rendering each key alone. */
const SWELL_PEAK: [key: number, s: number][] = [[36, 1.95], [40, 1.84], [44, 1.73], [48, 1.64], [60, 1.37], [72, 1.16], [78, 1.06], [84, 0.97], [90, 0.89]];
function swellPeak(key: number): number {
  for (let i = 1; i < SWELL_PEAK.length; i++) {
    const [k0, s0] = SWELL_PEAK[i - 1]!;
    const [k1, s1] = SWELL_PEAK[i]!;
    if (key <= k1) return s0 + ((s1 - s0) * (key - k0)) / (k1 - k0);
  }
  return SWELL_PEAK[SWELL_PEAK.length - 1]![1];
}
/** The key whose swell peaks closest to `d` seconds in. */
function swellKey(d: number): number {
  let best = 36;
  for (let k = 36; k <= 90; k++) if (Math.abs(swellPeak(k) - d) < Math.abs(swellPeak(best) - d)) best = k;
  return best;
}
/** The orchestra kit's keys (GM drum map). */
const DRUM: Partial<Record<Role, number[]>> = { kick: [36], snare: [38], roll: [38], crash: [49], boom: [36, 35] };

interface Ev {
  tick: number;
  bytes: number[];
  /** Note-offs sort before note-ons at the same tick. */
  order: number;
}

const TICKS_PER_S = 1920; // 960 PPQ at 120 bpm: every time in the score is in seconds
const tick = (s: number) => Math.max(0, Math.round(s * TICKS_PER_S));

function arrange(notes: Note[], endS: number): Ev[] {
  const ev: Ev[] = [];
  const on = (t: number, ch: number, p: number, v: number) => ev.push({ tick: tick(t), bytes: [0x90 | ch, p, v], order: 1 });
  const off = (t: number, ch: number, p: number) => ev.push({ tick: tick(t), bytes: [0x80 | ch, p, 0], order: 0 });
  const cc = (t: number, ch: number, n: number, v: number) => ev.push({ tick: tick(t), bytes: [0xb0 | ch, n, v], order: 2 });
  CH.forEach((c, ch) => {
    cc(0, ch, 0, c.bank ?? 0);
    ev.push({ tick: 0, bytes: [0xc0 | ch, c.prog], order: 3 });
    cc(0, ch, 7, c.vol);
    cc(0, ch, 10, c.pan);
    cc(0, ch, 91, c.rev);
    cc(0, ch, 93, 0);
    cc(0, ch, 11, 127);
  });
  const vel = (v: number) => Math.max(1, Math.min(127, Math.round(v)));
  for (const raw of notes) {
    const n = { ...raw, v: raw.v * (SECTION_GAIN[raw.sec] ?? 1) };
    if (DRUM[n.role]) {
      for (const key of DRUM[n.role]!) on(n.t, 9, key, n.v), off(n.t + 0.1, 9, key);
      continue;
    }
    if (n.role === "hat") {
      const key = n.sec === "town" || n.sec === "crib" ? 81 : 42; // a triangle in the town and the Crib, a closed hat elsewhere
      on(n.t, 9, key, vel(n.v * (key === 81 ? 0.8 : 0.7))), off(n.t + 0.1, 9, key);
      continue;
    }
    if (n.role === "swell") {
      // The reverse cymbal, keyed so its peak lands on the swell's end (a higher key plays the sample faster).
      const key = swellKey(n.d);
      const start = n.t + n.d - swellPeak(key);
      on(start, 15, key, vel(n.v)), off(start + swellPeak(key) + 0.6, 15, key);
      continue;
    }
    const parts = ARRANGE[n.role]?.[n.sec] ?? ARRANGE[n.role]?.["*"] ?? [];
    for (const [ch, tr = 0, vs = 1, ls = 1] of parts) {
      on(n.t, ch, n.p + tr, vel(n.v * vs));
      off(n.t + Math.max(0.05, n.d * ls), ch, n.p + tr);
    }
  }
  // Swells on the tremolo strings (expression): the swirl into the hit, the rank run into Transcendent.
  const ramp = (ch: number, from: number, to: number, a: number, b: number) => {
    for (let i = 0; i <= 24; i++) cc(from + ((to - from) * i) / 24, ch, 11, Math.round(a + ((b - a) * i) / 24));
  };
  const swirl = notes.find((n) => n.sec === "rise" && n.role === "harm")!;
  const hit = notes.find((n) => n.sec === "hit")!;
  ramp(1, swirl.t, hit.t - 0.01, 70, 127);
  const run = notes.find((n) => n.sec === "run" && n.role === "harm")!;
  ramp(1, run.t, run.t + run.d - 0.01, 50, 127);
  ramp(1, run.t + run.d, run.t + run.d + 0.02, 127, 127);
  // Keep the file running through the tail so FluidSynth renders the reverb out.
  cc(endS + TAIL, 0, 11, 127);
  return ev;
}

/** One-track (format 0) MIDI file; overlapping notes on one key keep sounding until the last of them ends. */
function midiFile(ev: Ev[]): Buffer {
  ev.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const held = new Map<string, number>();
  const kept: Ev[] = [];
  for (const e of ev) {
    const type = e.bytes[0]! & 0xf0;
    if (type === 0x90 || type === 0x80) {
      const key = `${e.bytes[0]! & 15}:${e.bytes[1]}`;
      const n = held.get(key) ?? 0;
      if (type === 0x90) held.set(key, n + 1);
      else {
        held.set(key, Math.max(0, n - 1));
        if (n > 1) continue;
      }
    }
    kept.push(e);
  }
  const data: number[] = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]; // 500000 µs per quarter (120 bpm)
  const vlq = (n: number) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  let last = 0;
  for (const e of kept) {
    data.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  data.push(0x00, 0xff, 0x2f, 0x00);
  const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x03, 0xc0]);
  const trk = Buffer.alloc(8);
  trk.write("MTrk", 0);
  trk.writeUInt32BE(data.length, 4);
  return Buffer.concat([head, trk, Buffer.from(data)]);
}

const out = process.argv[2] ?? ".";
const cues = process.argv[3] === "wide" ? WIDE : PHONE;
const notes = score(cues);
const mid = join(out, `orchestra-${cues.name}.mid`);
const wav = join(out, `orchestra-${cues.name}-raw.wav`);
writeFileSync(mid, midiFile(arrange(notes, cues.end)));
const tl = timeline(cues);
console.log(`${notes.length} notes; ${tl.bpm.toFixed(1)} bpm (ranked ${tl.bpmRanked.toFixed(1)}); ${mid}`);
execFileSync(
  "fluidsynth",
  [
    "-ni", "-q", "-r", "48000", "-g", "0.45",
    "-o", "synth.reverb.room-size=0.72", "-o", "synth.reverb.damp=0.35", "-o", "synth.reverb.width=1", "-o", "synth.reverb.level=0.7",
    "-o", "synth.chorus.active=0", "-o", "synth.polyphony=512",
    "-F", wav, "-T", "wav", "-O", "float", SOUNDFONT, mid,
  ],
  { stdio: "inherit" },
);
console.log(wav);
