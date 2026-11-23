/**
 * A ride's moving sound (Eric, Nov 14: "when you move around ... it sounds like ... a little bulldozer moving ... one continuous
 * sound"; docs/decisions/2026-11-14-ride-sounds.md). Your own pawn's ride only, only a ride listed in `RIDE_SOUND.rides`, only while
 * it moves; standing, nothing. On the game's sounds: the Sound switch and a hidden page silence it, as they do every game sound. Two
 * kinds (`RIDE_SOUND.rides[id].kind`):
 *
 * A `steps` ride (the pogo; Eric, Nov 15: "every time ... you go from one square to the next, it should be a boing"): each step your
 * walker begins (`rideStep`, its step event: no work on the frames between) plays the next of its file's boings as its own one-shot,
 * on the audio clock at the step's hop (`on`: its take-off or landing, from the ride's move frames, which play once a step), so they
 * overlap freely. No fade, no timer: standing, no steps, so nothing.
 *
 * A `loop` ride (the dozer): one loop at a time (`/sounds/rides/<id>.wav`: one loop of exactly 1 s with 0.1 s of itself either side).
 * A `synth` loop (Birdie's Train, Nov 23) has no file: its samples are made in code as its boss's sounds are (`SYNTHS`), the first time
 * it's asked for once the audio is made, and it loops where they say.
 * A hard start and stop, no fades (Eric, Nov 16: "it should be a hard start and stop when you start moving and stop. Like boingo";
 * docs/decisions/2026-11-16-ride-sound-hard.md): full level and speed on your first moving frame, out once you stop.
 *
 * The frame loops (the town's, a shop room's) only say "you're moving on this ride" (`rideMoving`), on the frames you move: a time
 * kept and a compare once it plays. Everything else happens off the frame: a timer sees the steps stop (`RIDE_SOUND.holdMs` after
 * the last moving frame, so a turn or a tap between two steps never stops it; a frame loop that halts, the town closing or the tab
 * hidden, stops it the same way) and stops the loop. Each end takes `DECLICK_S`, no more: a bare cut mid-wave clicks (the dozer's
 * loop begins at -0.19, its samples step 0.005 apart).
 */
import { RIDE_SOUND, hunchessBase, type RideLoopSound, type RideStepSound } from "@chessroyale/core";
import { gameBus, isMuted, isPageHidden, loadAudioFile, onAudioRebuilt, onMuteChange } from "./sound.ts";
import { RIDE_CELLS } from "./town/ride-cells.ts";
import { BIRDIE_RIDE_LOOP, birdieSound } from "./characters/birdie-sounds.ts";

/** Where the loop runs in each file (s): the README's shape for every ride's loop. */
export const RIDE_LOOP = { start: 0.1, end: 1.1 } as const;
/**
 * The loops made in code (RIDE_SOUND's `synth`), never a file: each its samples at a sample rate and where it loops (s). Birdie's Train:
 * his own medium train run (birdie-sounds.ts; Eric, Nov 18: a boss's sounds are his own).
 */
export const SYNTHS: Readonly<Record<NonNullable<RideLoopSound["synth"]>, { samples: (rate: number) => Float32Array; loop: { start: number; end: number } }>> = {
  birdie: { samples: (rate) => birdieSound(BIRDIE_RIDE_LOOP.run, rate), loop: BIRDIE_RIDE_LOOP },
};
/** Where a loop ride's loop runs (s): its synth's, or every file's. */
const loopOf = (s: RideLoopSound) => (s.synth ? SYNTHS[s.synth].loop : RIDE_LOOP);
export const rideSoundFile = (id: string) => `/sounds/rides/${id}.wav`;
/** A loop's start and stop (s): its level up from 0 or down to it this fast, so neither clicks; the Sound switch's too. */
export const DECLICK_S = 0.03;

type Voice = { id: string; ctx: AudioContext; src: AudioBufferSourceNode; gain: GainNode };

let voice: Voice | null = null;
/** Sources made and not yet let go (tests: never more than one). */
let live = 0;
/** The last moving frame (ms, `clock`). */
let lastMove = -Infinity;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
const buffers = new Map<string, AudioBuffer>();
const asking = new Set<string>();
let listening = false;
/** (Tests replace it.) */
let clock = () => performance.now();

/**
 * The ride whose sound an item plays: its own id, or for a HunChess colorway (`<ride>-hunchess`, the Welcome Crate's gold and black)
 * its ride's (Eric, Nov 22: the gold pogo had no boing, as RIDE_SOUND is keyed by the ride, not each colorway). Every entry point maps
 * through this, so a ride's sound, its file and its hop are its colorways' too, with nothing to add per colorway.
 */
export const rideSoundId = (id: string | null | undefined): string | null => (id ? (hunchessBase(id) ?? id) : null);

/**
 * Fetches and decodes a ride's loop once (the town warms yours after its first frame; a first move asks for it too). A `synth` loop is
 * made at once instead, on the audio's context (not yet made: the first move makes it).
 */
export function warmRideSound(item: string | null | undefined) {
  const id = rideSoundId(item);
  const s = id ? RIDE_SOUND.rides[id] : undefined;
  if (!id || !s || buffers.has(id) || asking.has(id)) return;
  if (s.kind === "loop" && s.synth) {
    const ctx = gameBus()?.ctx;
    if (ctx) buffers.set(id, synthBuffer(ctx, s.synth));
    return;
  }
  asking.add(id);
  void loadAudioFile(rideSoundFile(id)).then((b) => {
    asking.delete(id);
    if (b) buffers.set(id, b);
  });
}

/** A synth loop's samples on a buffer, with room to its loop's end (a run may stop short of it: silence after). */
function synthBuffer(ctx: BaseAudioContext, name: NonNullable<RideLoopSound["synth"]>): AudioBuffer {
  const { samples, loop } = SYNTHS[name];
  const x = samples(ctx.sampleRate);
  const buf = ctx.createBuffer(1, Math.max(x.length, Math.ceil(loop.end * ctx.sampleRate) + 1), ctx.sampleRate);
  buf.getChannelData(0).set(x);
  return buf;
}

/** A frame loop: you moved this frame, on this ride (its id; null: on foot). Call it only on the frames you move. */
export function rideMoving(item: string | null | undefined) {
  const id = rideSoundId(item);
  if (!id) return;
  if (voice?.id === id) {
    lastMove = clock();
    return;
  }
  const s = RIDE_SOUND.rides[id];
  if (s?.kind !== "loop") return;
  lastMove = clock();
  start(id, s);
}

/** The next boing of a `steps` ride's (cycling through its file's), boings started and those still playing (tests). */
let nextBoing = 0;
let boings = 0;
let boingsLive = 0;
/** Each `steps` ride's hop moment as a share of its step (`on`), read from its move frames once. */
const hops = new Map<string, number>();

/**
 * Where in a step a ride's move frames take off (the first frame lifted) or land (the first one back down after it), 0 to 1: its
 * frames play once a step, their times scaled to it (render.ts `drawRider`, rides.ts `moveIndex`). Read from its side view (its back
 * and front share its times and hop). A ride with no lifted frame: the step's start.
 */
export function rideHop(id: string, on: RideStepSound["on"]): number {
  const key = `${id}:${on}`;
  let h = hops.get(key);
  if (h !== undefined) return h;
  const move = RIDE_CELLS[id]?.side.move ?? [];
  const total = move.reduce((x, r) => x + r[0]!, 0);
  let t = 0;
  let up = -1;
  h = 0;
  for (let i = 0; i < move.length; i++) {
    const lifted = move[i]![5]! < 0;
    if (up < 0 && lifted) {
      up = i;
      if (on === "takeoff") break;
    } else if (up >= 0 && !lifted) break;
    t += move[i]![0]!;
  }
  if (up >= 0 && total) h = t / total;
  hops.set(key, h);
  return h;
}

/**
 * A step event (your walker began a step, at `at` ms on the frame clock, `stepMs` long), on this ride (its id; null: on foot). A
 * `steps` ride's next boing, scheduled on the audio clock at the step's hop; a past moment (a late frame) plays at once.
 */
export function rideStep(item: string | null | undefined, at: number, stepMs: number) {
  const id = rideSoundId(item);
  if (!id) return;
  const s = RIDE_SOUND.rides[id];
  if (s?.kind !== "steps" || isMuted() || isPageHidden()) return;
  const bus = gameBus();
  if (!bus || bus.ctx.state !== "running") return;
  const buf = buffers.get(id);
  if (!buf) return warmRideSound(id);
  const { ctx } = bus;
  const when = ctx.currentTime + Math.max(0, at + rideHop(id, s.on) * stepMs - clock()) / 1000;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = s.level;
  src.connect(gain).connect(bus.out);
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
    boingsLive--;
  };
  const n = nextBoing % s.boings.length;
  src.start(when, s.boings[n]!, s.lengthS);
  nextBoing = n + 1;
  boings++;
  boingsLive++;
  log(`ride:boing:${id}:${n}`);
}

function start(id: string, s: RideLoopSound) {
  if (isMuted() || isPageHidden()) return;
  const bus = gameBus(s.bright);
  if (!bus || bus.ctx.state !== "running") return;
  // (A synth loop is made here if it hadn't been, and plays on this frame; a file's plays once it has come.)
  if (!buffers.has(id)) warmRideSound(id);
  const buf = buffers.get(id);
  if (!buf) return;
  const loop = loopOf(s);
  listen();
  // (Another ride's, or the old context's: that one goes, this one starts.)
  if (voice) stop(voice);
  const { ctx } = bus;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = loop.start;
  src.loopEnd = loop.end;
  src.playbackRate.value = s.rate;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(RIDE_SOUND.level, now + DECLICK_S);
  src.connect(gain).connect(bus.out);
  src.start(now, loop.start);
  live++;
  voice = { id, ctx, src, gain };
  log(`ride:start:${id}`);
  watch();
}

/** The steps stopped? Checked `holdMs` after the last moving frame, off the frame loop. */
function watch() {
  clearTimeout(holdTimer);
  holdTimer = setTimeout(
    () => {
      holdTimer = undefined;
      if (!voice) return;
      if (clock() - lastMove >= RIDE_SOUND.holdMs) stop(voice);
      else watch();
    },
    Math.max(0, lastMove + RIDE_SOUND.holdMs - clock()),
  );
}

/** Stops a loop: you stood, the Sound switch went off, the page hid, another ride took over or its context went. Out in `DECLICK_S`. */
function stop(v: Voice) {
  if (voice === v) voice = null;
  live--;
  log(`ride:stop:${v.id}`);
  const t = v.ctx.currentTime;
  const g = v.gain.gain;
  v.src.onended = () => {
    v.src.disconnect();
    v.gain.disconnect();
  };
  try {
    g.cancelScheduledValues(t);
    g.setValueAtTime(RIDE_SOUND.level, t);
    g.linearRampToValueAtTime(0, t + DECLICK_S);
    v.src.stop(t + DECLICK_S);
  } catch {
    // (Its context closed.)
  }
}

/** The switch, the page and a new audio context, heard once the first loop plays. */
function listen() {
  if (listening) return;
  listening = true;
  const off = () => void (voice && stop(voice));
  onMuteChange(() => isMuted() && off());
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => isPageHidden() && off());
  // (The old context is closed under it: the next moving frame starts on the new one.)
  onAudioRebuilt(off);
}

/** Tests read this log (window.__soundLog), as sound.ts's own. */
const log = (line: string) => (globalThis as { __soundLog?: string[] }).__soundLog?.push(line);

/**
 * (Tests, `__townRide().you.sound`) The loop as it is: its ride, the sources playing, how it loops, its level and speed; and a
 * `steps` ride's boings started and still playing.
 */
export function rideSoundState() {
  const v = voice;
  return {
    boings,
    boingsLive,
    decoded: [...buffers.keys()],
    ride: v?.id ?? null,
    live,
    loop: v ? [v.src.loop, v.src.loopStart, v.src.loopEnd] : null,
    level: v ? RIDE_SOUND.level : 0,
    rate: v ? v.src.playbackRate.value : 0,
  };
}

/** (Unit tests) A clock of their own, and everything back to the start. */
export function rideSoundForTests(c: () => number) {
  clock = c;
  if (voice) stop(voice);
  clearTimeout(holdTimer);
  holdTimer = undefined;
  lastMove = -Infinity;
  live = 0;
  nextBoing = boings = boingsLive = 0;
}
