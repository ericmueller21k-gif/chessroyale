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
  // Her freeze (the ice cracking over a piece).
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
  // The Hidden Boss: his low, ominous hum (the stare).
  recluse: "recluseHum",
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
