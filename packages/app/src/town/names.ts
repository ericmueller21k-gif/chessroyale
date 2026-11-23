/**
 * Players' name colors in the town square's chat (Eric, Oct 28: "the player color names is a nice touch… just random color from
 * a palette each time you join, name can be bolded"). Ten colors, each in two shades: deeper by day, lighter by night (the chat
 * text follows the town's sky: town-chat.css, `data-tone`), so a player's color is the same color across the switch.
 * Pure: no DOM. docs/decisions/2026-10-28-town-chat-v2.md, "Oct 28, Eric's phone".
 *
 * Who gets which: a player's device picks a number at random each time the town opens (`pickNameColor`) and sends it with each
 * of its messages; the server carries it on the line (`color`, any whole number below 32: it means nothing to the server), so
 * everyone reading that player's lines sees the same color for as long as their session lasts. A line with no number (an older
 * app, a line the test hook says) gets a steady color from who said it (`nameColorIndex`).
 *
 * The shades were chosen against pixels sampled under the box in every sky (day, dawn, dusk, night; a phone's and a
 * computer's): the day shades hold at least 3:1 against about three quarters of what lies under the box on a phone (the lime
 * two thirds; the Colosseum's shadowed brown is the rest) and more on a computer, the night shades against a little over half
 * (the white text against 80 to 95 percent). No two are closer than ΔE 18 (CIELAB), and none sits near the bosses' gold or the
 * kids' mint.
 */
export interface NameColor {
  /** The deeper shade, for a light sky (day, dawn, dusk). */
  day: string;
  /** The lighter shade, for the night sky. */
  night: string;
}

export const NAME_COLORS: readonly NameColor[] = [
  { day: "#880b0b", night: "#faa5a5" }, // red
  { day: "#813807", night: "#f9b588" }, // orange
  { day: "#850b3b", night: "#faa1c5" }, // rose
  { day: "#790a72", night: "#fa9af3" }, // magenta
  { day: "#590eae", night: "#d1acfb" }, // purple
  { day: "#0e33ad", night: "#a6bafa" }, // blue
  { day: "#04568c", night: "#76c4f8" }, // azure
  { day: "#045543", night: "#0bd4a5" }, // teal
  { day: "#075107", night: "#0ce30c" }, // green
  { day: "#4e6503", night: "#a5d40b" }, // lime
];

/** The most the server accepts as a color number (exclusive): it only checks it's a small whole number; the app reads it modulo its palette. */
export const NAME_COLOR_LIMIT = 32;

/** A color for a player joining the town now: a number into the palette, at random (`rand` in [0, 1)). */
export const pickNameColor = (rand: () => number = Math.random): number => Math.min(NAME_COLORS.length - 1, Math.floor(rand() * NAME_COLORS.length));

/**
 * The palette color of a player's line: the number their device picked when it joined the town (`color`, carried by the server),
 * else a steady one from who said it (their account, or their name). Always an index into `NAME_COLORS`.
 */
export function nameColorIndex(line: { color?: unknown; uid?: string; name: string }): number {
  const c = line.color;
  if (typeof c === "number" && Number.isInteger(c) && c >= 0 && c < NAME_COLOR_LIMIT) return c % NAME_COLORS.length;
  let h = 0;
  for (const ch of line.uid ?? line.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % NAME_COLORS.length;
}
