/**
 * The name tags over the people in the town square (Eric, Oct 28, after trying 50 bots): who shows one, how strongly, and in what color.
 * "The people are always visible but the name tags no": by default (`near`) a tag shows only while its figure is within
 * `TOWN_FEEL.nameRadius` squares of you, and fades in and out over the last `nameFadeSquares` as you or it walk (`nameAlpha`: stateless,
 * from positions each frame, nothing allocated); "Everyone" in Town settings shows them all, exactly as before. Your own tag, a figure whose
 * card is open and one at a table with you (or walking to or from a game with you) always show. A boss's sidekick wears a blue tag
 * with white text (`TAG_STYLE`), a pawn a white one with dark text, you gold. Pure (the setting's memory aside: localStorage, in a
 * try/catch); the drawing is render.ts'. docs/areas/town-square.md, "Name tags".
 */
import { TOWN_FEEL } from "./feel.ts";

/** The kinds of tag: yours, a pawn's (a bot) and a boss's sidekick's. The tag drawings are cached by it (render.ts, `tagArtOf`). */
export type TagKind = "you" | "bot" | "sidekick";

/**
 * Each kind's pill and its name's ink. White and gold are as they always were (the drawing is pixel for pixel the same: the cache's
 * #399 check). The sidekicks' blue is `#1d4ed8` at the pill's usual alpha: white text on it reads at 6.7:1 (more than the 4.5:1 of
 * WCAG AA), and it stands out from the day sky, the sand, the grass and the night sky (docs/decisions/2026-10-28-name-tags-near-you.md).
 */
export const TAG_STYLE: Readonly<Record<TagKind, { pill: string; ink: string }>> = {
  you: { pill: "rgba(255,215,106,.96)", ink: "#1f2530" },
  bot: { pill: "rgba(255,255,255,.92)", ink: "#1f2530" },
  sidekick: { pill: "rgba(29,78,216,.96)", ink: "#ffffff" },
};

/**
 * The tag drawings' cache (render.ts, `tagArtOf`): each tag drawn once and stamped every frame, one per name, size and **kind** (yours,
 * a pawn's or a sidekick's: they differ in color, so the kind is part of the key, not a gold-or-not flag), at most `max` in all, the
 * least lately used making way. Generic over what it holds (the renderer keeps canvases; a test keeps plain records). Pure.
 */
export class TagCache<A extends { s: number; kind: TagKind; used: number }> {
  private readonly byName = new Map<string, A[]>();
  /** How many drawings are held. */
  n = 0;
  constructor(readonly max: number) {}

  /** The drawing of this name at this size and kind, or undefined. */
  find(text: string, s: number, kind: TagKind): A | undefined {
    const list = this.byName.get(text);
    if (list) for (const a of list) if (a.s === s && a.kind === kind) return a;
    return undefined;
  }

  /** Holds a new drawing (the caller has made room with `evict`). */
  add(text: string, a: A): void {
    let list = this.byName.get(text);
    if (!list) this.byName.set(text, (list = []));
    list.push(a);
    this.n++;
  }

  /**
   * When it's full, lets go of the least lately used drawing and hands it back (the renderer reuses its canvas), but never one drawn in
   * this frame or the last (`frameNo`: this frame may still draw it): a crowd of more names than `max` on screen keeps them all and
   * the cache grows past `max` until they thin. Null: nothing let go.
   */
  evict(frameNo: number): A | null {
    if (this.n < this.max) return null;
    let old: A | null = null;
    let oldText = "";
    for (const [k, l] of this.byName) for (const a of l) if (!old || a.used < old.used) ((old = a), (oldText = k));
    if (!old || old.used >= frameNo - 1) return null;
    const l = this.byName.get(oldText)!;
    l.splice(l.indexOf(old), 1);
    if (!l.length) this.byName.delete(oldText);
    this.n--;
    return old;
  }

  /** Forgets everything (the device's pixel ratio changed: every drawing is the wrong size). */
  clear(): void {
    this.byName.clear();
    this.n = 0;
  }
}

/**
 * How strongly a tag shows from how far its figure is from you: `dist` squares, the larger of the two directions (|dc| and |dr|, so
 * about a 10 × 10 area round you for a radius of 5): 1 up to `radius − fade / 2` (4.5), then falling in a straight line to 0 at
 * `radius + fade / 2` (5.5). Squares from fractional positions, so a walk fades it smoothly.
 */
export function nameAlpha(dist: number, radius: number = TOWN_FEEL.nameRadius, fade: number = TOWN_FEEL.nameFadeSquares): number {
  const a = (radius + fade / 2 - dist) / fade;
  return a < 0 ? 0 : a > 1 ? 1 : a;
}

/**
 * A figure's tag alpha (before its fade in and out of the square): the smaller of the near rule's and today's far-distance fade
 * (`far`, 1 when it isn't far). "Everyone" and a figure that is `always` shown (its card is open, it's at a table with you or walking
 * to or from a game with you) take no near rule.
 */
export function tagAlpha(names: NamesMode, dist: number, always: boolean, far: number): number {
  const near = names === "everyone" || always ? 1 : nameAlpha(dist);
  return near < far ? near : far;
}

/** The names setting's two choices (Town settings, under Chat): "Near you" (the default) and "Everyone" (every tag, as before). */
export type NamesMode = "near" | "everyone";
export const NAMES_MODES: readonly NamesMode[] = ["near", "everyone"];
/** What each choice is called in the settings sheet, the sheet's heading for them, and the line under them. */
export const NAMES_CHOICE: Readonly<Record<NamesMode, string>> = { near: "Near you", everyone: "Everyone" };
export const NAMES_LABEL = "Names";
export const namesNote = (radius: number = TOWN_FEEL.nameRadius): string => `Near you: names show within ${radius} squares of you.`;
/** Where the choice is remembered on this device. */
export const NAMES_KEY = "brc.townNames";

/** The choice now: the one remembered on this device (the first time it's asked), else "near". */
let mode: NamesMode | null = null;
const seen = new Set<() => void>();
export function namesMode(): NamesMode {
  return (mode ??= loadNamesMode());
}
/** Sets it, remembers it on this device, and tells everyone showing it (the settings sheet). The renderer reads `namesMode()` as it draws. */
export function setNamesMode(m: NamesMode): void {
  if (m === mode) return;
  mode = m;
  saveNamesMode(m);
  for (const f of seen) f();
}
export function onNamesMode(fn: () => void): () => void {
  seen.add(fn);
  return () => void seen.delete(fn);
}

/** The choice remembered on this device, or "near" (nothing stored, something else stored, or a storage that won't answer). */
export function loadNamesMode(): NamesMode {
  try {
    const v = localStorage.getItem(NAMES_KEY);
    return NAMES_MODES.find((m) => m === v) ?? "near";
  } catch {
    return "near";
  }
}

export function saveNamesMode(m: NamesMode): void {
  try {
    localStorage.setItem(NAMES_KEY, m);
  } catch {
    // (private mode, storage full: it lasts until a reload)
  }
}
