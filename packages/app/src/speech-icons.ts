/**
 * Pixel icons in a line of speech (Eric, Oct 20: Moo "could also put like little emojis, not like the base ones": our own
 * pixel icons, MOO_ICONS): `{heart}` in a line is Moo's heart, drawn inline at text height in the speech bubble, in the boss
 * bar's, the select screen's and anywhere else his words show (speech.tsx). Where only text can show (a screen reader, a
 * plain-text fallback) the icons are dropped: `plainLine`. An icon counts as one character, for how long a line types out
 * and stays up (`lineLength`).
 *
 * The line stays one string with its tokens (a boss's kit says "(Moo! {heart})"), so every place that says, stores or
 * measures a line is unchanged; only what draws it and what reads it aloud knows the tokens. A `{word}` that isn't one of
 * his icons is plain text.
 */
import { MOO_ICONS, type MooIconId } from "./characters/moo.ts";

/** A piece of a line: its words, or one of his icons. */
export type LineSeg = { text: string; icon?: undefined } | { icon: MooIconId; text?: undefined };

const TOKEN = /\{([a-z]+)\}/g;
const isIcon = (id: string): id is MooIconId => Object.prototype.hasOwnProperty.call(MOO_ICONS, id);

/** A line as its words and icons, in order (a line without a token is one piece). */
export function parseLine(line: string): LineSeg[] {
  const out: LineSeg[] = [];
  let at = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (!isIcon(m[1]!)) continue;
    if (m.index! > at) out.push({ text: line.slice(at, m.index) });
    out.push({ icon: m[1] });
    at = m.index! + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

/** Whether a line has an icon in it. */
export const hasIcons = (line: string): boolean => parseLine(line).some((s) => s.icon);

/** A line's length as it shows: each icon one character. */
export const lineLength = (line: string): number => parseLine(line).reduce((n, s) => n + (s.icon ? 1 : s.text.length), 0);

/**
 * A line with its icons dropped, for a screen reader or any plain text: the space before an icon goes with it, so
 * "(Moo! {heart})" reads "(Moo!)", and "I'm hungry {milk} Moo" reads "I'm hungry Moo".
 */
export function plainLine(line: string): string {
  let out = "";
  for (const s of parseLine(line)) out = s.icon ? out.replace(/\s+$/, "") : out + s.text;
  return out.trim();
}

/** The first `n` characters of a line (an icon is one) and the rest, each as pieces. */
export function sliceLine(line: string, n: number): { shown: LineSeg[]; rest: LineSeg[] } {
  const shown: LineSeg[] = [];
  const rest: LineSeg[] = [];
  let left = Math.max(0, n);
  for (const s of parseLine(line)) {
    if (s.icon) {
      (left > 0 ? shown : rest).push(s);
      left = Math.max(0, left - 1);
    } else if (left >= s.text.length) {
      shown.push(s);
      left -= s.text.length;
    } else {
      if (left > 0) shown.push({ text: s.text.slice(0, left) });
      rest.push({ text: s.text.slice(left) });
      left = 0;
    }
  }
  return { shown, rest };
}
