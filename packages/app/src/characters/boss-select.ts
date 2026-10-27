/**
 * The Boss raid screen's character select (Eric, Oct 16: "old school Street Fighter 2 style"): what each boss does as
 * it steps onto the stage. One sound of its own (its most iconic, from its sound pack: played once, through the mute
 * switch) and a line from those it already says that read right outside a match (nothing about a move, a capture, a
 * power, the board or the crowd). docs/decisions/2026-10-16-boss-character-select.md.
 *
 * The lines are the bosses' existing ones until Eric approves new ones (drafts from each boss's lore: the PR and the
 * decision file); an approved set replaces a boss's list here, in one edit.
 */
import type { SoundName } from "../sound.ts";

/** Each boss's sound as it steps onto the stage, by its roster id. */
export const SELECT_SOUND: Readonly<Record<string, SoundName>> = {
  // His freeze (the ice cracking over a piece).
  gingerbread: "gingerCrackle",
  // His pie, splatting.
  clown: "clownSplat",
  // His sparkler's fizz.
  grex: "grexFizz",
  // The darkness pouring out of him.
  hollow: "hollowCast",
  // A toy block landing.
  bigboy: "bigboyClack",
  // The saw revving.
  sawyer: "sawyerRev",
  // The lasso whirling.
  pig: "pigWhirl",
  // His trumpet.
  alfil: "alfilTrumpet",
  // Chirp's chirp.
  hopper: "hopperChirp",
  // A splash of paint.
  smudgy: "smudgySplash",
  // His happy moo.
  moo: "mooHappy",
  // His happy grunt and a splash.
  gardener: "gardenerHello",
  // A big, bored yawn, then a balloon squeak.
  tiger: "tigerHello",
  // A page turning, then a flap of its wing.
  folio: "folioHello",
  // The Hidden Boss: his low, ominous hum (the stare).
  recluse: "recluseHum",
};

/**
 * What a boss says when you tap it in the town square (Eric, Oct 27: "when you click on a boss in the town, he should make
 * a noise"): sounds of its own for the town, taken in turn, else its select sound.
 */
export const TOWN_SOUNDS: Readonly<Record<string, readonly SoundName[]>> = {
  // A low, slow murmur, then a soft "mm-hm" (Eric's picks).
  folio: ["folioMurmur", "folioHum"],
};

/** The sound for a boss's `n`th tap in the town square (from 0). */
export const townSound = (id: string, n: number): SoundName | undefined => {
  const own = TOWN_SOUNDS[id];
  return own?.length ? own[n % own.length] : SELECT_SOUND[id];
};

/** Each boss's lines on the stage (one at random a tap, never the same twice running), by its roster id. */
export const SELECT_LINES: Readonly<Record<string, readonly string[]>> = {
  gingerbread: ["Ginger is here!", "You'll crumble!", "Fresh out of the freezer!", "Cool as ice."],
  clown: ["Honk honk! Showtime!", "Step right up!", "Who ordered a clown?"],
  grex: ["Jefferson in the house!", "Feel the heat!", "Rawr! I mean… hi.", "Hot stuff coming through!"],
  hollow: ["Hollow is here.", "Did you leave a light on?", "I was always here.", "Hush now."],
  bigboy: ["Big boy here!", "Wanna play?", "Mine! All mine!"],
  sawyer: ["Measure twice, cut once.", "Hard hat zone!", "Let's get sawing."],
  pig: ["Howdy, varmints.", "Saddle up!", "Yee-haw!"],
  alfil: ["Before your bishops, there was me.", "The old piece is back.", "Make room. Big guy coming through.", "Old school wins."],
  hopper: ["Chub and Chirp! Best friends!", "He's Chirp. I'm Chub. We hop.", "Got any carrots?"],
  // The director's draft (Oct 19), as written: two of his entrance lines and a smug one, which read right outside a match.
  smudgy: ["Every chameleon blends in. I'd rather stand out.", "Smudgy, artist. Don't touch the wet parts.", "A masterpiece, if I say so myself."],
  // The director's draft (Oct 20), as written (`{heart}` is one of his pixel icons, drawn in the line: speech-icons.ts).
  moo: ["Hi! This is Moo. He's my best friend. (Moo! {heart})", "I watched your farm for ages. Let's play! (Moo? {question})", "Best friends make the best moves! (Moo! {heart})"],
  // The director's draft (Oct 21), as written: his entrance, a seed line and a smug one, which read right outside a match.
  gardener: ["Mind the flower beds.", "Good soil here. Very good soil.", "Everything's coming up roses."],
  // The director's draft (Oct 24), as written: lines that read right outside a match.
  tiger: ["No roaring tonight. Balloons only.", "Another masterpiece.", "Don't rush the artist."],
  // Folio (the director's, Oct 26): its select and intro line, the only one (its tile comes with the wiring lane).
  folio: ["Every game is a draft. Shall we write one?"],
  // The Hidden Boss (Eric's own first line; never named on screen): the two in turn.
  recluse: ["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."],
};

/** The boss whose lines go in turn rather than at random (the Hidden Boss's two). */
const IN_TURN = new Set(["recluse"]);

/**
 * The line for this tap: in turn for the Hidden Boss, else one at random that isn't the one said last (`last`).
 * `rand` in [0, 1) (Math.random; a test's own).
 */
export function selectLine(id: string, last: string | null, rand: number = Math.random()): string | null {
  const lines = SELECT_LINES[id];
  if (!lines?.length) return null;
  if (IN_TURN.has(id)) return lines[(lines.indexOf(last ?? "") + 1) % lines.length]!;
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[Math.min(pool.length - 1, Math.floor(rand * pool.length))]!;
}

/**
 * Tiles to a row, on a phone and a computer alike (Eric, Oct 23: "just 5 per row, and it doesn't matter if you're on a
 * desktop"). The CSS reads it as `--bs-per`.
 */
export const TILES_PER_ROW = 5;

/** A tile's height as a multiple of its width (styles.css, `--bs-h`): its visible width is 0.8 of its width (the slant is 0.2), so
 *  it is 1.55 times as tall as that. */
export const TILE_RATIO = 1.24;

/**
 * How many tiles go in each row for `n` tiles with `per` to a row: full rows of `per`, the last the rest (fourteen: 5, 5, 4;
 * fifteen: 5, 5, 5; sixteen: 5, 5, 5, 1). Five to a row always (Eric, Oct 23: "just 5 per row"), so a new boss's tile moves no
 * other boss's tile (Oct 27, Folio's: sharing sixteen out as 4, 4, 4, 4 would have moved every tile; Eric's rule, nothing
 * shifts). A short row is centered.
 */
export function rowSizes(n: number, per: number): number[] {
  if (n <= 0) return [];
  return Array.from({ length: Math.ceil(n / per) }, (_, i) => Math.min(per, n - i * per));
}

/**
 * How a boss's whole figure sits in its tile (Eric, Oct 23, from a Street Fighter 6 select: "the full character sprite, but
 * it simply gets cut off on the corners of the boxes… use their neck area as the starting point"). The figure is the
 * portrait's frame at full size; the tile's slanted shape cuts off what doesn't fit.
 *  - `neck`: the figure's neck, in its frame's pixels (x across, y down): pinned to the tile's middle, `at` of the way down.
 *  - `span`: how many of the frame's pixels fit across the tile (a smaller number is a closer shot).
 *  - `at`: how far down the tile the neck sits (0 to 1): the head is above it, the body below, running on past the edge.
 * Tuned by eye in the 4x sheet of every tile (docs/decisions/2026-10-23-boss-select-sf.md). A test checks that the figure
 * covers the whole tile and that its head is inside it.
 */
export interface Framing {
  neck: readonly [x: number, y: number];
  span: number;
  at: number;
}
export const SELECT_FRAMING: Readonly<Record<string, Framing>> = {
  gingerbread: { neck: [44, 49], span: 44, at: 0.42 },
  clown: { neck: [37, 49], span: 55, at: 0.52 },
  grex: { neck: [38, 55], span: 62, at: 0.4 },
  hollow: { neck: [51, 50], span: 64, at: 0.4 },
  bigboy: { neck: [49, 50], span: 57, at: 0.52 },
  sawyer: { neck: [45, 40], span: 56, at: 0.57 },
  pig: { neck: [43, 50], span: 55, at: 0.66 },
  alfil: { neck: [35, 52], span: 59, at: 0.55 },
  hopper: { neck: [38, 42], span: 57, at: 0.47 },
  smudgy: { neck: [41, 46], span: 55.5, at: 0.51 },
  moo: { neck: [36, 58], span: 56, at: 0.39 },
  gardener: { neck: [48, 56], span: 57, at: 0.42 },
  // (His bunch of balloons rides high over his head: the neck low in the tile, so the balloons are in it too.)
  tiger: { neck: [31, 78], span: 56, at: 0.69 },
  // (Its long neck: the point under its head, so its head, beak and the near wing's root are in the tile.)
  folio: { neck: [30, 40], span: 58, at: 0.5 },
  recluse: { neck: [33, 47], span: 61, at: 0.5 },
};

/**
 * The color behind each boss's figure (Eric, Oct 23: "make the background kind of appropriate based on their colors, but…
 * it can't be something that makes it so they're difficult to see"): a color from the boss's own palette, chosen to stand
 * apart from the figure's, which the stylesheet softens into a gradient (darker in the dark theme, lighter in the light
 * one). The Hidden Boss's tile is always dark and "?" has a neutral fill: neither is here.
 */
export const SELECT_TINT: Readonly<Record<string, string>> = {
  gingerbread: "#3fae4f",
  clown: "#4aa3ff",
  grex: "#e5566a",
  hollow: "#ffcf3a",
  bigboy: "#a24cf5",
  sawyer: "#e1262c",
  pig: "#fff3b0",
  alfil: "#1d3d8c",
  hopper: "#9fd8ff",
  smudgy: "#0e5c60",
  moo: "#5d7ad8",
  gardener: "#7fe0ae",
  // (His knight balloon's blue: across the wheel from his orange, so his stripes and his red vest stay clear on it.)
  tiger: "#2f7fe0",
  // (Its deep ink: its cream paper and its vermilion seal stand clear on it, in the light theme's lighter wash too.)
  folio: "#575c78",
};
