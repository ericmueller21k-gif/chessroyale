/**
 * A line typed at its own pace, sentence by sentence (the Hidden Boss's chant, Eric, Nov 13: typed the way his cutscene
 * mockup types): each sentence typed at `typeMs` a character, `sentencePauseMs` between sentences, then the whole box fully
 * readable `readMs` plus `perCharMs` a character (at most `maxReadMs`), then its fade. Pure: the voice (speech.tsx) shows it,
 * the phase change times its beats by it, and the tests read it.
 */
import { lineLength } from "./speech-icons.ts";

export interface LinePace {
  typeMs: number;
  sentencePauseMs: number;
  readMs: number;
  perCharMs: number;
  maxReadMs: number;
  fadeMs: number;
}

/** A paced line: its words (the sentences joined by a space), when each sentence starts typing, when it's typed and gone (ms from its start). */
export interface PacedLine {
  sentences: readonly string[];
  text: string;
  starts: readonly number[];
  typedMs: number;
  holdMs: number;
  typeMs: number;
}

export function pacedLine(sentences: readonly string[], pace: LinePace): PacedLine {
  const starts: number[] = [];
  let t = 0;
  sentences.forEach((s, i) => {
    if (i) t += pace.sentencePauseMs;
    starts.push(t);
    t += lineLength(s) * pace.typeMs;
  });
  const text = sentences.join(" ");
  const readMs = Math.min(pace.maxReadMs, pace.readMs + pace.perCharMs * lineLength(text));
  return { sentences, text, starts, typedMs: t, holdMs: t + readMs + pace.fadeMs, typeMs: pace.typeMs };
}

/**
 * How many of its characters are typed `t` ms after it starts: every character of the sentences already started, none
 * during a pause (the space between two sentences typed with the second).
 */
export function pacedTyped(line: PacedLine, t: number): number {
  let n = 0;
  line.sentences.forEach((s, i) => {
    const since = t - line.starts[i]!;
    if (since < 0) return;
    n += (i ? 1 : 0) + Math.min(lineLength(s), Math.floor(since / line.typeMs) + 1);
  });
  return n;
}
