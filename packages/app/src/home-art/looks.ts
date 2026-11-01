import { frameKeys, type Character, type Frame, type Speck } from "../characters/sprite.ts";
import { grain } from "../town/houses/kit.ts";

/**
 * Chess Town's three looks (Eric, Nov 1: "make a version of it that's a darker version… the town has like dark with like the
 * lights on the houses"; then, once he saw the live site, today's dusk sky already read as dark to him): the same drawings
 * under three skies, picked by the device's clock (town.ts).
 *
 * - `dusk` is the picture exactly as it was drawn: the character itself, nothing remapped.
 * - `day` is a palette swap: fuller colors, the windows unlit (glass that catches the sun).
 * - `night` is a palette swap too: every color darker and cooler, the windows and the lamps lit warm, and a handful of fixed
 *   pixels for the stars and the lamps' glow.
 *
 * No new art: a look is a copy of the character with the same parts at the same places in every frame (so every pixel the
 * drawing paints is where it was, and the idle loop is the same loop), only its colors changed. The one thing added is the night's
 * loose pixels, laid only on pixels that stay empty in every frame of the loop (so nothing is ever covered or moves).
 */
export type Sky = "day" | "dusk" | "night";

type RGB = readonly [number, number, number];

/** `#rrggbb` or `#rrggbbaa` to its three channels and its alpha suffix ("" or the two hex digits). */
function parse(c: string): { rgb: RGB; alpha: string } {
  const n = parseInt(c.slice(1, 7), 16);
  return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: c.slice(7) };
}
const hex = (rgb: RGB, alpha: string) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("") + alpha;

/** Daylight: a touch more color and a touch lighter (the shading keeps its steps, so the drawing keeps its form). */
function daylight(c: string): string {
  const { rgb, alpha } = parse(c);
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const lit = rgb.map((v) => {
    const s = luma + (v - luma) * 1.2;
    return s + (255 - s) * 0.1;
  }) as unknown as RGB;
  return hex(lit, alpha);
}

/** Moonlight: each channel dimmed, red most and blue least, so every color goes dark and cool. */
const MOON: RGB = [0.33, 0.4, 0.68];
function moonlight(c: string): string {
  const { rgb, alpha } = parse(c);
  return hex([rgb[0] * MOON[0], rgb[1] * MOON[1], rgb[2] * MOON[2]], alpha);
}

/** What one picture does differently in one look. */
interface Tuning {
  /** Palette keys given a color of their own (the windows, the lamps), whatever the rule would have made of them. */
  keys: Readonly<Record<string, string>>;
  /** A color a frame itself puts on a key (the skyline's blinking windows), as it was drawn → what it is in this look. */
  blink?: Readonly<Record<string, string>>;
  /** The faint backlight round the shapes (the drawing's `halo`), if this look changes it. */
  halo?: string;
  /** Night only: where the lamps' lanterns are (art pixels, the middle of the lit part), for their glow. */
  lamps?: readonly (readonly [number, number])[];
}

const WARM = "#ffd45a";
const WARM_LOW = "#a9753a";
const CORE = "#fff3b8";

const TUNING: Record<string, Partial<Record<"day" | "night", Tuning>>> = {
  // The skyline's windows are groups 0 to 4; the loop switches 1 to 4 between LIT and DARK, and 0 is always lit.
  "arena-town-skyline": {
    day: {
      keys: { "0": "#a9d4ee", "1": "#a9d4ee", "2": "#a9d4ee", "3": "#a9d4ee", "4": "#a9d4ee" },
      // Unlit by day, with a sun glint that comes and goes: the loop reads the same, the lights are off.
      blink: { "#f4b740": "#d8eefa", "#3b3550": "#7aa7c6" },
    },
    night: {
      keys: { "0": WARM, "1": WARM, "2": WARM, "3": WARM, "4": WARM, Y: "#ffc94d", y: CORE },
      // Lit all night; the ones the loop "switches off" only turn their lamp down (the loop is the same, the town stays lit).
      blink: { "#f4b740": WARM, "#3b3550": WARM_LOW },
      halo: "#8fa6ff26",
      lamps: [[85, 16]],
    },
  },
  // The square's windows and shop fronts are glass "a" (the top row) and "e"; its lamp is "y" (lit) and "Y".
  "arena-town-square": {
    night: {
      keys: { a: "#ffe58f", e: WARM, Y: "#ffc94d", y: CORE },
      halo: "#8fa6ff26",
      lamps: [[99, 5]],
    },
  },
};

/** The outline stays the outline in every look. */
const OUTLINE = "k";
const NIGHT_OUTLINE = "#0a0912";

// ---- Loose pixels at night: the stars, and the lamps' glow.

const STAR = "*";
const STAR_DIM = "+";
const GLOW = "~";
const GLOW_FAINT = "^";
const STARS = 11;
const STAR_GAP = 7;

/**
 * The pixels no frame of the loop ever paints, with a margin of `m` pixels around anything painted (the halo counts as painted):
 * the only places a loose pixel can go, so it never covers a thing and never gets covered.
 */
function emptyEverywhere(ch: Character, m: number): boolean[][] {
  const free = Array.from({ length: ch.h }, () => Array<boolean>(ch.w).fill(true));
  for (const fr of ch.anims.idle!.frames) {
    const keys = frameKeys(ch, fr);
    for (let y = 0; y < ch.h; y++)
      for (let x = 0; x < ch.w; x++)
        if (keys[y]![x]) for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (free[y + dy]?.[x + dx]) free[y + dy]![x + dx] = false;
  }
  return free;
}

/** Where the stars go: up in the sky, where the name's letters don't reach (the top seven rows, and the two ends a little lower). */
const starZone = (x: number, y: number, w: number) => y <= 6 || ((x <= 10 || x >= w - 11) && y <= 14);

/** About a dozen stars, a bright and a dim kind, spread out (no two within `STAR_GAP` pixels), the same ones every time. */
export function starsFor(ch: Character): Speck[] {
  const free = emptyEverywhere(ch, 2);
  const spots: { x: number; y: number; r: number }[] = [];
  for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) if (free[y]![x] && starZone(x, y, ch.w)) spots.push({ x, y, r: grain(x, y, 11) });
  spots.sort((a, b) => a.r - b.r || a.y - b.y || a.x - b.x);
  const picked: { x: number; y: number; r: number }[] = [];
  for (const s of spots) {
    if (picked.length >= STARS) break;
    if (picked.every((p) => Math.max(Math.abs(p.x - s.x), Math.abs(p.y - s.y)) >= STAR_GAP)) picked.push(s);
  }
  return picked.map((s, i) => [s.x, s.y, i % 3 === 2 ? STAR_DIM : STAR] as Speck);
}

/** A soft glow round each lantern: a stronger ring close in, a fainter one beyond, only on pixels that stay empty. */
export function glowFor(ch: Character, lamps: readonly (readonly [number, number])[]): Speck[] {
  const free = emptyEverywhere(ch, 0);
  const out: Speck[] = [];
  for (const [lx, ly] of lamps)
    for (let y = 0; y < ch.h; y++)
      for (let x = 0; x < ch.w; x++) {
        if (!free[y]![x]) continue;
        const d = Math.hypot(x - lx, y - ly);
        if (d <= 3.6) out.push([x, y, GLOW]);
        else if (d <= 5.2) out.push([x, y, GLOW_FAINT]);
      }
  return out;
}

// ---- The looks.

const cache = new Map<string, Character>();

/**
 * `ch` under `sky`. Dusk is `ch` itself. The others are new characters with their own id (the drawn frames are cached by id), the
 * same parts and layers, a remapped palette and remapped frame colors.
 */
export function townLook(ch: Character, sky: Sky): Character {
  if (sky === "dusk") return ch;
  const id = `${ch.id}-${sky}`;
  const done = cache.get(id);
  if (done) return done;
  const tune = TUNING[ch.id]?.[sky];
  const rule = sky === "night" ? moonlight : daylight;
  const recolor = (key: string, c: string) => (key === OUTLINE ? (sky === "night" ? NIGHT_OUTLINE : c) : (tune?.keys[key] ?? rule(c)));
  const palette: Record<string, string> = {};
  for (const [k, c] of Object.entries(ch.palette)) palette[k] = recolor(k, c);
  let extra: Speck[] = [];
  if (sky === "night") {
    Object.assign(palette, { [STAR]: "#e4ebff", [STAR_DIM]: "#8d9bd0", [GLOW]: "#ffd45a4d", [GLOW_FAINT]: "#ffd45a24" });
    extra = [...starsFor(ch), ...glowFor(ch, tune?.lamps ?? [])];
  }
  const frames = ch.anims.idle!.frames.map(
    (fr): Frame => ({
      ...fr,
      pal: fr.pal && Object.fromEntries(Object.entries(fr.pal).map(([k, c]) => [k, tune?.blink?.[c.toLowerCase()] ?? recolor(k, c)])),
      specks: extra.length ? [...(fr.specks ?? []), ...extra] : fr.specks,
    }),
  );
  const look: Character = {
    ...ch,
    id,
    name: `${ch.name} (${sky})`,
    palette,
    halo: ch.halo && (tune?.halo ?? ch.halo),
    anims: { ...ch.anims, idle: { ...ch.anims.idle!, frames } },
  };
  cache.set(id, look);
  return look;
}
