/**
 * The landing reel's theme, written note by note, timed to the reel's scenes. One score, two arrangements: chiptune.ts plays
 * it on chip voices (synth.ts), orchestra.ts writes it as MIDI for real instruments (FluidSynth + a sampled soundfont).
 *
 * Key D major (D minor for the boss and ranked), about 150 bpm. Every note sits at an absolute time, worked out from the
 * reel's cut times (scripts/encode-demo.sh: each clip's length / speed, the 0.35 s crossfades), so the hits land on the cuts:
 *   bars 1-2  50 v 50 (energy, a build)            bars 3-4  the town (light, staccato)
 *   bar 5     Big Boy's card (a cheeky stab)       bar 6     his Crib (a toy box)
 *   bar 7     the swirl (a chromatic riser)        bar 8     "A boss appears" (the hit), a pickup into ranked
 *   bars 9-11 ranked (the theme in D minor)        run       one note per rank as they shuffle up (the reel's own hold times)
 *   top       Transcendent (the stinger)           hidden    the drop: low D, a dark pad, a glint, two heartbeats
 *   pickup    a roll and three notes that lead back into bar 1 (the reel loops)
 */

/** The reel's moments, in seconds (frame-exact for the encoded MP4s). */
export interface Cues {
  name: string;
  /** "A boss appears: Big Boy" (the boss clip's first frame). */
  hit: number;
  /** Ranked's first frame (the crossfade from the boss starts here). */
  ranked: number;
  /** The rank shuffle's first emblem (Wood). */
  ranks: number;
  /** Transcendent lands (the flash). */
  transcendent: number;
  /** The Hidden Boss (crossfade starts). */
  hidden: number;
  /** The reel's length: the loop point. */
  end: number;
}

// Phone: park 93 frames, card 30, crib 85, battle 30 after the 3.25 s crossfade point; ranks/Transcendent from the cut detector.
export const PHONE: Cues = { name: "phone", hit: 11.183, ranked: 12.233, ranks: 17.233, transcendent: 19.233, hidden: 20.583, end: 25.3 };
export const WIDE: Cues = { name: "wide", hit: 11.317, ranked: 12.367, ranks: 17.367, transcendent: 19.4, hidden: 20.717, end: 25.433 };

/** scripts/reel/rank-shuffle.ts: when each tier shows (s from Wood; the ninth is Transcendent). */
const RANK_STEPS = [0, 0.38, 0.7, 0.97, 1.2, 1.4, 1.58, 1.75, 1.98];

export type Section = "crowd" | "town" | "card" | "crib" | "rise" | "hit" | "ranked" | "run" | "top" | "hidden" | "pickup";
export type Role =
  | "lead" // the tune
  | "harm" // held chords (one note per chord tone)
  | "stab" // short chords
  | "bass"
  | "ost" // an 8th-note ostinato
  | "arp" // bells: the toy box, the rank sparkles, the glint
  | "pad" // the Hidden Boss's dark pad
  | "kick"
  | "snare"
  | "roll" // a roll's single strokes
  | "hat"
  | "crash"
  | "swell" // a cymbal swell (t: start, d: to the peak)
  | "timp"
  | "boom"; // a deep hit

export interface Note {
  sec: Section;
  role: Role;
  /** Start, s. */
  t: number;
  /** Length, s. */
  d: number;
  /** MIDI pitch (drums: 0). */
  p: number;
  /** Velocity 1-127. */
  v: number;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  "7": [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
};
/** A chord's tones, closely voiced from `low` up (e.g. "Bb", "Dm", "C#dim", "Dadd9"). */
export function chordTones(sym: string, low: number): number[] {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  if (!m) throw new Error(`bad chord ${sym}`);
  const root = PC[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const q = QUALITY[m[3]!];
  if (!q) throw new Error(`bad chord ${sym}`);
  return q.map((iv) => {
    const pc = (root + iv) % 12;
    return low + ((pc - low) % 12 + 12) % 12 + (iv >= 12 ? 12 : 0);
  });
}

/** The time map: bars 1-7 share one tempo (bar 8 lands on the hit); bar 8 is 3 beats to ranked; bars 9-11 fill ranked. */
export function timeline(c: Cues) {
  const b0 = c.hit / 28;
  const b8 = (c.ranked - c.hit) / 3;
  const bR = (c.ranks - c.ranked) / 12;
  const beat = (bar: number) => (bar <= 7 ? b0 : bar === 8 ? b8 : bR);
  const at = (bar: number, b: number) =>
    bar <= 7 ? ((bar - 1) * 4 + b) * b0 : bar === 8 ? c.hit + b * b8 : c.ranked + ((bar - 9) * 4 + b) * bR;
  const steps = RANK_STEPS.map((s) => c.ranks + (s * (c.transcendent - c.ranks)) / RANK_STEPS[RANK_STEPS.length - 1]!);
  return { b0, b8, bR, beat, at, steps, bpm: 60 / b0, bpmRanked: 60 / bR };
}

type Line = [beat: number, len: number, note: string][];

export function score(c: Cues): Note[] {
  const tl = timeline(c);
  const out: Note[] = [];
  const add = (sec: Section, role: Role, t: number, d: number, p: number | string, v: number) =>
    out.push({ sec, role, t, d, p: typeof p === "string" ? midi(p) : p, v: Math.max(1, Math.min(127, Math.round(v))) });
  /** A line of notes in one bar; `gate` shortens each (staccato). */
  const line = (sec: Section, role: Role, bar: number, notes: Line, v: number, gate = 1) => {
    for (const [b, l, p] of notes) add(sec, role, tl.at(bar, b), l * tl.beat(bar) * gate, p, v);
  };
  const chord = (sec: Section, role: Role, bar: number, b: number, l: number, sym: string, low: number | string, v: number) => {
    const lo = typeof low === "string" ? midi(low) : low;
    for (const p of chordTones(sym, lo)) add(sec, role, tl.at(bar, b), l * tl.beat(bar), p, v);
  };
  const hits = (sec: Section, role: Role, bar: number, beats: number[], v: number | ((i: number) => number), p = 0, len = 0.25) =>
    beats.forEach((b, i) => add(sec, role, tl.at(bar, b), len * tl.beat(bar), p, typeof v === "number" ? v : v(i)));
  const range = (from: number, to: number, step: number) => {
    const r: number[] = [];
    for (let x = from; x < to - 1e-9; x += step) r.push(x);
    return r;
  };

  // ── 1-2. 50 v 50: the theme, driving 8ths, a build (the snare joins in 16ths at the end of bar 2) ──
  line("crowd", "lead", 1, [[0, 0.5, "D5"], [0.5, 0.5, "A4"], [1, 0.5, "D5"], [1.5, 0.5, "E5"], [2, 1, "F#5"], [3, 0.5, "E5"], [3.5, 0.5, "F#5"]], 104);
  line("crowd", "lead", 2, [[0, 1, "G5"], [1, 0.5, "F#5"], [1.5, 0.5, "G5"], [2, 1.5, "A5"], [3.5, 0.5, "E5"]], 110);
  chord("crowd", "harm", 1, 0, 4, "D", "F#3", 78);
  chord("crowd", "harm", 2, 0, 2, "G", "G3", 82);
  chord("crowd", "harm", 2, 2, 2, "A", "A3", 86);
  for (const [bar, from, to, root] of [[1, 0, 4, "D2"], [2, 0, 2, "G1"], [2, 2, 4, "A1"]] as const) {
    for (const b of range(from, to, 0.5)) add("crowd", "bass", tl.at(bar, b), 0.45 * tl.b0, midi(root) + ((b * 2) % 2 ? 12 : 0), 96);
  }
  hits("crowd", "crash", 1, [0], 100, 0, 4);
  hits("crowd", "kick", 1, [0, 2, 2.5], 100);
  hits("crowd", "kick", 2, [0, 2, 2.5], 104);
  hits("crowd", "snare", 1, [1, 3], 92);
  hits("crowd", "snare", 2, [1], 96);
  hits("crowd", "roll", 2, range(2, 4, 0.25), (i) => 50 + i * 8);
  hits("crowd", "hat", 1, range(0, 4, 0.5), 58);
  hits("crowd", "hat", 2, range(0, 2, 0.5), 62);
  hits("crowd", "timp", 1, [0, 2], 100, midi("D2"), 1);
  hits("crowd", "timp", 2, [0], 96, midi("G2"), 1);
  hits("crowd", "timp", 2, [2], 104, midi("A2"), 1);

  // ── 3-4. The town: lighter, staccato, an oom-pah under it ──
  line("town", "lead", 3, [[0, 0.5, "F#5"], [0.5, 0.25, "E5"], [0.75, 0.25, "F#5"], [1, 0.5, "A5"], [1.5, 0.5, "F#5"], [2, 0.5, "D5"], [2.5, 0.5, "F#5"], [3, 0.5, "D5"], [3.5, 0.5, "B4"]], 92, 0.6);
  line("town", "lead", 4, [[0, 0.5, "D5"], [0.5, 0.25, "C#5"], [0.75, 0.25, "D5"], [1, 0.5, "G5"], [1.5, 0.5, "B4"], [2, 0.5, "C#5"], [2.5, 0.5, "E5"], [3, 1, "A5"]], 96, 0.6);
  for (const [bar, b, sym, low] of [[3, 0, "D", "F#4"], [3, 2, "Bm", "F#4"], [4, 0, "G", "G4"], [4, 2, "A", "E4"]] as const) {
    chord("town", "stab", bar, b + 0.5, 0.3, sym, low, 60);
    chord("town", "stab", bar, b + 1.5, 0.3, sym, low, 56);
  }
  line("town", "bass", 3, [[0, 0.5, "D2"], [1, 0.5, "A1"], [2, 0.5, "B1"], [3, 0.5, "F#2"]], 90);
  line("town", "bass", 4, [[0, 0.5, "G1"], [1, 0.5, "D2"], [2, 0.5, "A1"], [3, 0.5, "E2"]], 92);
  hits("town", "kick", 3, [0, 2], 60);
  hits("town", "kick", 4, [0, 2], 64);
  hits("town", "hat", 3, [0.5, 1.5, 2.5, 3.5], 52);
  hits("town", "hat", 4, [0.5, 1.5, 2.5, 3.5, 3.75], 56);

  // ── 5. Big Boy's card: a cheeky Bb stab (a half step above the tune's A), then C, back home to D for the Crib ──
  line("card", "lead", 5, [[0, 1, "Bb5"], [1.5, 0.25, "A5"], [1.75, 0.25, "Bb5"], [2, 0.5, "C6"], [2.5, 0.5, "G5"], [3, 0.5, "E5"], [3.5, 0.5, "C5"]], 104, 0.8);
  chord("card", "stab", 5, 0, 0.75, "Bb", "D4", 116);
  chord("card", "stab", 5, 0, 0.75, "Bb", "Bb2", 110);
  chord("card", "stab", 5, 2, 0.4, "C", "E4", 96);
  chord("card", "stab", 5, 3, 0.4, "C", "E4", 100);
  line("card", "bass", 5, [[0, 1, "Bb1"], [1, 0.5, "Bb1"], [2, 0.5, "C2"], [3, 0.5, "C2"], [3.5, 0.5, "A1"]], 104);
  hits("card", "crash", 5, [0], 108, 0, 3);
  hits("card", "kick", 5, [0, 2], 104);
  hits("card", "snare", 5, [3, 3.5], 80);
  hits("card", "timp", 5, [0], 112, midi("Bb1"), 1);

  // ── 6. The Crib: a toy box (bells), soft strings, plucked bass ──
  line("crib", "arp", 6, [[0, 0.5, "A5"], [0.5, 0.5, "F#5"], [1, 0.5, "D6"], [1.5, 0.5, "A5"], [2, 0.5, "B5"], [2.5, 0.5, "G5"], [3, 0.5, "D6"], [3.5, 0.5, "B5"]], 92);
  chord("crib", "harm", 6, 0, 2, "D", "D4", 54);
  chord("crib", "harm", 6, 2, 2, "G", "D4", 56);
  line("crib", "bass", 6, [[0, 0.5, "D2"], [1, 0.5, "A2"], [2, 0.5, "G1"], [3, 0.5, "D2"]], 80);
  hits("crib", "hat", 6, [1, 3], 46);

  // ── 7. The swirl: chromatic chords climbing over an A pedal, a snare roll and a cymbal swell into the hit ──
  for (const [b, l, sym, v] of [[0, 1, "A", 66], [1, 1, "Bb", 76], [2, 1, "B", 88], [3, 0.5, "C", 100], [3.5, 0.5, "C#dim", 108]] as const) {
    chord("rise", "harm", 7, b, l, sym, "E4", v);
  }
  line("rise", "lead", 7, [[0, 1, "A4"], [1, 1, "Bb4"], [2, 1, "B4"], [3, 0.5, "C5"], [3.5, 0.5, "C#5"]], 100);
  line("rise", "bass", 7, [[0, 4, "A1"]], 92);
  hits("rise", "kick", 7, [0, 1, 2, 3], (i) => 70 + i * 12);
  hits("rise", "roll", 7, range(1.5, 4, 0.25), (i) => 36 + i * 8);
  hits("rise", "timp", 7, range(2, 4, 0.25), (i) => 50 + i * 8, midi("A1"));
  add("rise", "swell", tl.at(7, 1.5), tl.at(8, 0) - tl.at(7, 1.5), 0, 96);

  // ── 8. "A boss appears": the tutti hit in D minor; two low A's lead into ranked ──
  chord("hit", "harm", 8, 0, 2.6, "Dm", "D4", 120);
  chord("hit", "harm", 8, 0, 2.6, "Dm", "A2", 116);
  chord("hit", "stab", 8, 0, 0.9, "Dm", "D3", 124);
  line("hit", "lead", 8, [[0, 2.6, "D5"]], 118);
  line("hit", "bass", 8, [[0, 2, "D2"], [0, 2, "D1"], [2, 0.45, "A1"], [2.5, 0.45, "A1"]], 122);
  hits("hit", "boom", 8, [0], 124, 0, 3);
  hits("hit", "crash", 8, [0], 124, 0, 3);
  hits("hit", "timp", 8, [0], 127, midi("D2"), 1.5);
  hits("hit", "timp", 8, [2, 2.5], (i) => 100 + 10 * i, midi("A1"), 0.5);
  hits("hit", "snare", 8, [2.5, 2.75], (i) => 80 + 16 * i);

  // ── 9-11. Ranked: the theme in D minor on horns, 8th-note strings, drums on the beat ──
  line("ranked", "lead", 9, [[0, 0.5, "D5"], [0.5, 0.5, "A4"], [1, 0.5, "D5"], [1.5, 0.5, "E5"], [2, 1.5, "F5"], [3.5, 0.5, "E5"]], 106);
  line("ranked", "lead", 10, [[0, 1, "D5"], [1, 0.5, "F5"], [1.5, 0.5, "D5"], [2, 1, "Bb4"], [3, 0.5, "C5"], [3.5, 0.5, "D5"]], 108);
  line("ranked", "lead", 11, [[0, 1.5, "E5"], [1.5, 0.5, "G5"], [2, 1, "E5"], [3, 1, "C#5"]], 112);
  chord("ranked", "harm", 9, 0, 4, "Dm", "D4", 70);
  chord("ranked", "harm", 10, 0, 4, "Bb", "D4", 74);
  chord("ranked", "harm", 11, 0, 2, "C", "E4", 80);
  chord("ranked", "harm", 11, 2, 2, "A", "E4", 86);
  for (const [bar, from, to, root] of [[9, 0, 4, "D2"], [10, 0, 4, "Bb1"], [11, 0, 2, "C2"], [11, 2, 4, "A1"]] as const) {
    for (const b of range(from, to, 0.5)) {
      add("ranked", "bass", tl.at(bar, b), 0.4 * tl.bR, midi(root), b % 1 ? 84 : 100);
      const shape = [12, 19, 24, 19][Math.round(b * 2) % 4]!;
      add("ranked", "ost", tl.at(bar, b), 0.4 * tl.bR, midi(root) + shape, 66);
    }
  }
  hits("ranked", "crash", 9, [0], 104, 0, 3);
  for (const bar of [9, 10, 11]) {
    hits("ranked", "kick", bar, bar === 11 ? [0, 1.5, 2] : [0, 1.5, 2, 2.5], 100);
    hits("ranked", "snare", bar, bar === 11 ? [1] : [1, 3], 92);
    hits("ranked", "hat", bar, range(0, bar === 11 ? 3 : 4, 0.5), 54);
    hits("ranked", "timp", bar, [0], 96, bar === 9 ? midi("D2") : bar === 10 ? midi("Bb1") : midi("C2"), 1);
  }
  hits("ranked", "timp", 11, [2], 104, midi("A1"), 1);
  hits("ranked", "roll", 11, range(3, 4, 0.25), (i) => 70 + i * 12);

  // ── The run: one note per rank as they shuffle up (A major scale over an A pedal), the swell peaking on Transcendent ──
  const steps = tl.steps;
  const runNotes = ["A4", "B4", "C#5", "D5", "E5", "F#5", "G#5", "A5"];
  runNotes.forEach((p, i) => {
    const d = steps[i + 1]! - steps[i]!;
    add("run", "lead", steps[i]!, d * 0.92, p, 88 + i * 4);
    add("run", "arp", steps[i]!, 0.5, midi(p) + 12, 80 + i * 4);
  });
  const t8 = steps[8]!;
  add("run", "arp", t8 - 0.1, 0.1, "B6", 100);
  add("run", "arp", t8 - 0.05, 0.1, "C#7", 104);
  for (const p of chordTones("A", midi("E4"))) add("run", "harm", steps[0]!, t8 - steps[0]!, p, 84);
  add("run", "bass", steps[0]!, t8 - steps[0]!, "A1", 96);
  for (let t = steps[0]!, i = 0; t < t8 - 0.02; t += tl.bR / 4, i++) {
    add("run", "roll", t, 0.05, 0, 40 + 70 * ((t - steps[0]!) / (t8 - steps[0]!)));
    add("run", "timp", t, 0.1, "A1", 50 + 60 * ((t - steps[0]!) / (t8 - steps[0]!)));
  }
  add("run", "swell", steps[0]!, t8 - steps[0]!, 0, 100);

  // ── Transcendent: a big D (add 9) with bells running up, held to the Hidden Boss ──
  const topLen = c.hidden - t8 + 0.15;
  for (const p of chordTones("Dadd9", midi("F#4"))) add("top", "harm", t8, topLen, p, 118);
  for (const p of chordTones("D", midi("A2"))) add("top", "harm", t8, topLen, p, 112);
  for (const p of chordTones("D", midi("D3"))) add("top", "stab", t8, 0.4, p, 124);
  add("top", "lead", t8, topLen, "D5", 120);
  add("top", "lead", t8, topLen, "A5", 116);
  add("top", "bass", t8, topLen, "D2", 118);
  add("top", "bass", t8, topLen, "D1", 110);
  ["D6", "F#6", "A6", "D7", "E7", "F#7"].forEach((p, i) => add("top", "arp", t8 + i * 0.07, 0.8, p, 112 - i * 6));
  add("top", "crash", t8, 3, 0, 124);
  add("top", "boom", t8, 2, 0, 110);
  add("top", "timp", t8, 1.2, "D2", 124);

  // ── The Hidden Boss: the drop. A deep boom, a low D held, a dark pad (D, F), his eye's glint, two heartbeats ──
  const h = c.hidden;
  const rollFrom = c.end - 2 * tl.b0;
  add("hidden", "boom", h, 3, 0, 116);
  add("hidden", "bass", h, rollFrom - h, "D1", 84);
  add("hidden", "bass", h, rollFrom - h, "D2", 52);
  add("hidden", "pad", h + 0.05, rollFrom - h, "D3", 60);
  add("hidden", "pad", h + 0.05, rollFrom - h, "F3", 56);
  add("hidden", "pad", h + 1.6, rollFrom - h - 1.6, "Ab3", 46);
  add("hidden", "arp", h + 1.3, 1.6, "Eb6", 66);
  for (const [dt, v] of [[1.9, 84], [2.16, 64], [2.9, 90], [3.16, 70]] as const) add("hidden", "timp", h + dt, 0.6, "D2", v);

  // ── The pickup: a roll and three notes (A, B, C#) that land on bar 1's D when the reel loops ──
  for (let t = rollFrom, i = 0; t < c.end - 0.02; t += tl.b0 / 4, i++) {
    const k = (t - rollFrom) / (c.end - rollFrom);
    add("pickup", "roll", t, 0.05, 0, 30 + 80 * k);
    add("pickup", "timp", t, 0.1, "A1", 30 + 80 * k);
  }
  add("pickup", "swell", rollFrom, c.end - rollFrom, 0, 80);
  for (const [i, p] of (["A4", "B4", "C#5"] as const).entries()) add("pickup", "lead", c.end - (1.5 - 0.5 * i) * tl.b0, 0.5 * tl.b0, p, 92 + 8 * i);
  for (const p of chordTones("A", midi("E4"))) add("pickup", "harm", c.end - tl.b0, tl.b0, p, 76);
  add("pickup", "bass", c.end - tl.b0, tl.b0, "A1", 96);

  return out.sort((a, b) => a.t - b.t);
}
