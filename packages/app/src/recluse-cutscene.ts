/**
 * The Hidden Boss's cutscene between his adult form and the cyborg (Nov 12; played after his fall, before his phase change,
 * since Nov 13): its one timeline, pure. The times are RECLUSE_CUTSCENE in settings.ts; the arrival's lengths come from the
 * figures' own frames (`RECLUSE_CUTSCENE` in characters/recluse-ages.ts), so the picture and the timeline can't drift apart.
 * Drawn by `components/RecluseCutscene.tsx`. Its whole length is RECLUSE_CUTSCENE.holdMs, the server's hold online (a unit
 * test keeps the two equal).
 */
import { RECLUSE_CUTSCENE } from "@chessroyale/core";

export type Speaker = "kid" | "man";
export interface CutLine {
  who: Speaker;
  /** Its sentences, typed one after the other with a pause between. */
  say: readonly string[];
}
/** One box: its words (the sentences joined), when it starts, when each sentence starts typing, when it's typed, when it's gone. */
export interface CutBox {
  who: Speaker;
  text: string;
  at: number;
  starts: readonly number[];
  typed: number;
  until: number;
}
export interface CutTimeline {
  /** The light fully up. */
  litAt: number;
  poofAt: number;
  dropAt: number;
  landAt: number;
  /** He has straightened: the conversation's loop from here. */
  standAt: number;
  boxes: readonly CutBox[];
  /** The scene is over and his transformation carries on from it (the phase change: the book at his feet opens), `endAfterMs` after the last box. */
  endAt: number;
}

type Settings = typeof RECLUSE_CUTSCENE;

/** How long a box stays fully readable once its words are typed (ms). */
export const cutReadMs = (text: string, c: Settings = RECLUSE_CUTSCENE) => Math.min(c.maxReadMs, c.readMs + c.perCharMs * text.length);

/** A box for a line starting at `at`: each sentence typed at `typeMs` a character, `sentencePauseMs` between them. */
export function cutBox(line: CutLine, at: number, c: Settings = RECLUSE_CUTSCENE): CutBox {
  const starts: number[] = [];
  let t = at;
  line.say.forEach((s, i) => {
    if (i) t += c.sentencePauseMs;
    starts.push(t);
    t += s.length * c.typeMs;
  });
  const text = line.say.join(" ");
  return { who: line.who, text, at, starts, typed: t, until: t + cutReadMs(text, c) + c.boxFadeMs };
}

/**
 * How many of a box's characters are typed by `now` (its sentences joined by one space, the space typed with the second):
 * every character of the sentences already started, at `typeMs` each, none during a pause.
 */
export function cutTyped(line: CutLine, box: CutBox, now: number, c: Settings = RECLUSE_CUTSCENE): number {
  let n = 0;
  line.say.forEach((s, i) => {
    const sep = i ? 1 : 0;
    const t = now - box.starts[i]!;
    if (t < 0) return;
    n += sep + Math.min(s.length, Math.floor(t / c.typeMs) + 1);
  });
  return n;
}

/**
 * The scene's beats from its start (0: the dimming begins). `arrival`: the lengths of the child's poof, drop and landing
 * (from his frames).
 */
export function cutsceneTimeline(lines: readonly CutLine[], arrival: { poofMs: number; dropMs: number; landMs: number }, c: Settings = RECLUSE_CUTSCENE): CutTimeline {
  const litAt = c.dimMs;
  const poofAt = litAt + c.poofAfterMs;
  const dropAt = poofAt + arrival.poofMs;
  const landAt = dropAt + arrival.dropMs;
  const standAt = landAt + arrival.landMs;
  const boxes: CutBox[] = [];
  let t = standAt + c.firstLineAfterMs;
  for (const line of lines) {
    const b = cutBox(line, t, c);
    boxes.push(b);
    t = b.until + c.gapMs;
  }
  return { litAt, poofAt, dropAt, landAt, standAt, boxes, endAt: (boxes.at(-1)?.until ?? standAt) + c.endAfterMs };
}

export type CutArrival = Parameters<typeof cutsceneTimeline>[1];
/** The times in RECLUSE_CUTSCENE that pace the scene (all but the light's size and darkness), for `fitCutscene`. */
const PACED = ["dimMs", "poofAfterMs", "firstLineAfterMs", "typeMs", "sentencePauseMs", "readMs", "perCharMs", "maxReadMs", "boxFadeMs", "gapMs", "endAfterMs"] as const;

/**
 * The scene in a window of `windowMs` (its hold: RECLUSE_CUTSCENE.holdMs, the server's online): itself, unchanged, when the window
 * is its own length (within a second: two devices' clocks) or longer (it ends early and the light stays down, never stretched); in a
 * shorter one (a test's hold: `cutsceneHoldMs`) every paced time shrinks by one factor, the child's frames as they are, so it
 * still ends by the window's end. Test-only: a window shorter than the child's fixed frames plus 2% of the rest (`?cutscene=` of
 * about 3 s or less, or `cutsceneHoldMs` under about 3 s) overruns it (the 0.02 floor), and the phase change cuts the scene off.
 */
export function fitCutscene(lines: readonly CutLine[], arrival: CutArrival, windowMs: number, c: Settings = RECLUSE_CUTSCENE): { timeline: CutTimeline; c: Settings } {
  const full = cutsceneTimeline(lines, arrival, c);
  if (windowMs >= full.endAt - 1000) return { timeline: full, c };
  const fixed = arrival.poofMs + arrival.dropMs + arrival.landMs;
  const f = Math.max(0.02, (windowMs - fixed) / (full.endAt - fixed));
  const scaled = { ...c } as Record<string, number>;
  for (const k of PACED) scaled[k] = Math.max(1, Math.floor(c[k] * f));
  const fc = scaled as unknown as Settings;
  return { timeline: cutsceneTimeline(lines, arrival, fc), c: fc };
}

/** The box up at `t` (from the scene's start), if any. */
export const boxAt = (tl: CutTimeline, t: number): { box: CutBox; i: number } | null => {
  const i = tl.boxes.findIndex((b) => t >= b.at && t < b.until);
  return i < 0 ? null : { box: tl.boxes[i]!, i };
};
