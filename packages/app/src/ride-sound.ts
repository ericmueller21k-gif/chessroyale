/**
 * A ride's moving sound (Eric, Nov 14: "when you move around ... it sounds like ... a little bulldozer moving ... one continuous
 * sound"; docs/decisions/2026-11-14-ride-sounds.md). Your own pawn's ride only, only a ride listed in `RIDE_SOUND.rides`, only while
 * it moves; standing, nothing. One loop at a time (`/sounds/rides/<id>.wav`: one loop of exactly 1 s with 0.1 s of itself either side),
 * on the game's sounds: the Sound switch and a hidden page silence it, as they do every game sound.
 *
 * The frame loops (the town's, a shop room's) only say "you're moving on this ride" (`rideMoving`), on the frames you move: a time
 * kept and two compares once it plays. Everything else happens off the frame: a timer sees the steps stop (`RIDE_SOUND.holdMs` after
 * the last moving frame, so a turn or a tap between two steps never stops it; a frame loop that halts, the town closing or the tab
 * hidden, stops it the same way), then the loop fades out (an engine sinking a little as it goes) and is let go once silent. Moving
 * again mid-fade brings its level (and an engine's speed) back up from where they are: it never starts again from silence.
 */
import { RIDE_SOUND } from "@chessroyale/core";
import { gameBus, isMuted, isPageHidden, loadAudioFile, onAudioRebuilt, onMuteChange } from "./sound.ts";

/** Where the loop runs in each file (s): the README's shape for every ride's loop. */
export const RIDE_LOOP = { start: 0.1, end: 1.1 } as const;
export const rideSoundFile = (id: string) => `/sounds/rides/${id}.wav`;
/** The Sound switch or a hidden page: out this fast (s), so it doesn't click. */
const SILENCE_S = 0.03;

/** A straight ramp of a value from `from` (at t0) to `to` (at t1), in the context's seconds: where it is now, without asking the browser. */
type Ramp = { from: number; to: number; t0: number; t1: number };
const valueAt = (r: Ramp, t: number) => (t >= r.t1 ? r.to : t <= r.t0 ? r.from : r.from + ((r.to - r.from) * (t - r.t0)) / (r.t1 - r.t0));

type Voice = {
  id: string;
  ctx: AudioContext;
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** Coming up or playing (true), or fading out (false). */
  up: boolean;
  level: Ramp;
  rate: Ramp;
  /** Let go once the fade-out is done. */
  endTimer: ReturnType<typeof setTimeout> | undefined;
};

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

/** Fetches and decodes a ride's loop once (the town warms yours after its first frame; a first move asks for it too). */
export function warmRideSound(id: string | null | undefined) {
  if (!id || !RIDE_SOUND.rides[id] || buffers.has(id) || asking.has(id)) return;
  asking.add(id);
  void loadAudioFile(rideSoundFile(id)).then((b) => {
    asking.delete(id);
    if (b) buffers.set(id, b);
  });
}

/** A frame loop: you moved this frame, on this ride (its id; null: on foot). Call it only on the frames you move. */
export function rideMoving(id: string | null | undefined) {
  if (!id) return;
  const v = voice;
  if (v && v.up && v.id === id) {
    lastMove = clock();
    return;
  }
  const s = RIDE_SOUND.rides[id];
  if (!s) return;
  lastMove = clock();
  start(id, s);
}

function start(id: string, s: (typeof RIDE_SOUND.rides)[string]) {
  if (isMuted() || isPageHidden()) return;
  const bus = gameBus();
  if (!bus || bus.ctx.state !== "running") return;
  const buf = buffers.get(id);
  if (!buf) return warmRideSound(id);
  listen();
  const { ctx } = bus;
  const now = ctx.currentTime;
  const e = RIDE_SOUND.engine;
  // (Another ride, or the old context's: that one goes, this one starts.)
  if (voice && (voice.id !== id || voice.ctx !== ctx)) letGo(voice);
  let v = voice;
  if (!v) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = RIDE_LOOP.start;
    src.loopEnd = RIDE_LOOP.end;
    const r0 = s.engine ? e.startRate : 1;
    src.playbackRate.value = r0;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(bus.out);
    src.start(now, RIDE_LOOP.start);
    live++;
    v = voice = { id, ctx, src, gain, up: true, level: { from: 0, to: 0, t0: now, t1: now }, rate: { from: r0, to: r0, t0: now, t1: now }, endTimer: undefined };
    log(`ride:start:${id}`);
  } else log(`ride:back:${id}`);
  clearTimeout(v.endTimer);
  v.up = true;
  rampTo(v.gain.gain, v.level, RIDE_SOUND.level, s.fadeInMs, now);
  // (Up to speed at the same pace from wherever it is: the whole `upMs` from `startRate`, less from nearer 1.)
  if (s.engine) rampTo(v.src.playbackRate, v.rate, 1, (e.upMs * (1 - valueAt(v.rate, now))) / (1 - e.startRate), now);
  watch();
}

/** The steps stopped? Checked `holdMs` after the last moving frame, off the frame loop. */
function watch() {
  clearTimeout(holdTimer);
  const wait = lastMove + RIDE_SOUND.holdMs - clock();
  holdTimer = setTimeout(() => {
    holdTimer = undefined;
    if (!voice?.up) return;
    if (clock() - lastMove >= RIDE_SOUND.holdMs) fadeOut(voice);
    else watch();
  }, Math.max(0, wait));
}

function fadeOut(v: Voice) {
  const s = RIDE_SOUND.rides[v.id]!;
  const now = v.ctx.currentTime;
  v.up = false;
  rampTo(v.gain.gain, v.level, 0, s.fadeOutMs, now);
  if (s.engine) rampTo(v.src.playbackRate, v.rate, RIDE_SOUND.engine.stopRate, s.fadeOutMs, now);
  log(`ride:fade:${v.id}`);
  clearTimeout(v.endTimer);
  v.endTimer = setTimeout(() => !v.up && letGo(v), s.fadeOutMs + 50);
}

/** The Sound switch off, or the page hidden: out at once (a few ms, no click), and let go. */
function silence() {
  const v = voice;
  if (!v) return;
  const now = v.ctx.currentTime;
  v.up = false;
  rampTo(v.gain.gain, v.level, 0, SILENCE_S * 1000, now);
  clearTimeout(v.endTimer);
  v.endTimer = setTimeout(() => letGo(v), SILENCE_S * 1000 + 50);
}

function letGo(v: Voice) {
  clearTimeout(v.endTimer);
  try {
    v.src.stop();
  } catch {
    // (Already stopped, or its context closed.)
  }
  v.src.disconnect?.();
  v.gain.disconnect?.();
  live--;
  if (voice === v) voice = null;
  log(`ride:end:${v.id}`);
}

function rampTo(p: AudioParam, r: Ramp, to: number, ms: number, now: number) {
  const from = valueAt(r, now);
  const t1 = now + Math.max(0, ms) / 1000;
  p.cancelScheduledValues(now);
  p.setValueAtTime(from, now);
  p.linearRampToValueAtTime(to, t1);
  r.from = from;
  r.to = to;
  r.t0 = now;
  r.t1 = t1;
}

/** The switch, the page and a new audio context, heard once the first loop plays. */
function listen() {
  if (listening) return;
  listening = true;
  onMuteChange(() => isMuted() && silence());
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => isPageHidden() && silence());
  // (The old context is closed under it: let it go; the next moving frame starts on the new one.)
  onAudioRebuilt(() => void (voice && letGo(voice)));
}

/** Tests read this log (window.__soundLog), as sound.ts's own. */
const log = (line: string) => (globalThis as { __soundLog?: string[] }).__soundLog?.push(line);

/** (Tests, `__townRide().you.sound`) The loop as it is: its ride, coming up or fading, the sources alive, how it loops, where its level and speed are headed. */
export function rideSoundState() {
  const v = voice;
  return {
    ride: v?.id ?? null,
    up: !!v?.up,
    live,
    loop: v ? [v.src.loop, v.src.loopStart, v.src.loopEnd] : null,
    level: v ? v.level.to : 0,
    rate: v ? v.rate.to : 0,
  };
}

/** (Unit tests) A clock of their own, and everything back to the start. */
export function rideSoundForTests(c: () => number) {
  clock = c;
  if (voice) letGo(voice);
  clearTimeout(holdTimer);
  holdTimer = undefined;
  lastMove = -Infinity;
  live = 0;
}
