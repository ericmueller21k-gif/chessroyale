/**
 * Don Dough's lines (Nov 11; docs/decisions/2026-11-11-don-dough.md): a pudgy zebra kingpin who runs "just a bakery", really a chess
 * nut, light and funny, never mean ("he's always right"). His power lines are the art round's (scripts/boss-art/out/
 * zebra-openings-nov10.md on `claude/boss-art`); the rest in his voice.
 *
 * - `power`: a lump of dough dropped (Rising Dough's `doughDrop`); `cheer`, `bigCheer`: it rose into his piece (a queen: the big one);
 *   `squashed`: your piece squashed it.
 * - `ultimateWarn`: Gold Plate's warning; `goldClose`: its closing line (Eric, Nov 11: "a note about how your pawns are worthless vs
 *   it", one of six at random); `clink`: a pawn of yours tried to take a gold piece.
 * - His opening comment: OPENING_LINES, by the library's name ("starts with", the first family that matches, top to bottom).
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const ZEBRA_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Welcome to the bakery. Nothing here but bread.", "You want a game? Sit down, kid.", "Pop! Ha! Relax, it's just a roll."],
  move: ["Mm-hm.", "Like I always say.", "Textbook."],
  capture: ["Pop! Gotcha.", "That one's mine now.", "Into the bread basket."],
  hurt: ["Hey! Watch the vest!", "Oof. Okay, okay.", "Who taught you that?"],
  strike: ["Pop!", "Nothing personal."],
  thinking: ["Let me think. Rook b1, takes, check…", "Hm. I've seen this one."],
  check: ["Check. Nothing here but a bakery.", "Check. Hands where I can see 'em."],
  smug: ["Fresh out of the oven.", "Told you. I'm always right."],
  rattled: ["This wasn't in the recipe!", "Relax. Relax. I'm relaxed."],
  power: ["Let it proof.", "A little something for later.", "Fresh dough, coming up."],
  cheer: ["Out of the oven!", "Hot and fresh. Mind the crust.", "Told you. Never rush good dough."],
  bigCheer: ["Out of the oven! A queen, no less!", "Told you. Never rush good dough."],
  squashed: ["Hey! That was proofing!", "My dough! You flattened my dough!", "Rude. That was a good batch."],
  ultimateWarn: ["Time to get fancy."],
  ultimate: ["Gold plated. Pawns, hooves off the lady."],
  goldClose: [
    "Your pawns? Worthless now. Cute, but worthless.",
    "Go ahead, throw a pawn at her. I'll wait.",
    "Pawns versus gold? That's not a trade, that's a joke.",
    "Every pawn you've got, and not one can touch her.",
    "Your pawns just became decoration, kid.",
    "Solid gold. Your pawns can look, not touch.",
  ],
  clink: ["Ha! Pawns can't touch gold.", "Boing. Try a bigger piece, kid.", "That's real gold, pal. Not for pawns."],
  victory: ["Nothing here but a bakery. Move along.", "Fresh bread, fresh win."],
  defeat: ["My roll… my hat… my whole operation…", "Okay. You win. Don't tell the crew."],
};

/** How often each moment speaks: every boss's beats, his powers always. */
export const ZEBRA_CHANCE: Partial<Record<Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 1,
  cheer: 1,
  bigCheer: 1,
  squashed: 1,
  ultimateWarn: 1,
  ultimate: 1,
  goldClose: 1,
  clink: 1,
};

/**
 * Gold Plate's closing line for a gilded piece that isn't a queen ("the lady" fits only her: the art round's note): the cast's
 * line and the closes that say "her" become "it".
 */
export const goldFor = (line: string, queen: boolean): string => (queen ? line : line.replace(" off the lady", " off").replace(/\bher\b/g, "it"));

/**
 * His opening comment (Eric, Nov 11: "since he's a chess enthusiast he throws out a comment on whatever opening you do"): each
 * family by the start of the library's name (the first that matches, top to bottom), two lines each; none: the fallback.
 */
export const OPENING_LINES: readonly { match: string; lines: readonly [string, string] }[] = [
  { match: "Italian Game", lines: ["Bc4, staring at f7. Classic, like Grandma's sourdough.", "Slow-cook it with c3 and d3. That's how pros bake."] },
  { match: "Ruy Lopez", lines: ["The Spanish. Bb5 leans on the knight guarding e5.", "Centuries old and still fresh. Like my starter."] },
  { match: "Scotch Game", lines: ["The Scotch! d4 on move three. Bold.", "Center's open now. Don't just stand in it."] },
  { match: "Petrov's Defense", lines: ["The Petrov. Copycat. I respect a copycat.", "Just don't copy with Nxe4. Qe2 says hello."] },
  { match: "King's Gambit", lines: ["King's Gambit! Romantic. Also a little reckless.", "Take it, then ...g5 to hold it. Old school."] },
  { match: "Sicilian Defense", lines: ["The Sicilian. Fighting for d4 from the side.", "Open Sicilian? Nf3, d4, takes. Now we're cooking."] },
  { match: "French Defense", lines: ["The French. Solid crust, cramped crumb.", "That c8 bishop. Trade it or break with ...c5."] },
  { match: "Caro-Kann Defense", lines: ["Caro-Kann. The c6 pawn backs up d5. Sturdy.", "Get the bishop to f5 before ...e6. Smart dough."] },
  { match: "Scandinavian Defense", lines: ["The Scandinavian. Queen out on move two? Brave.", "Nc3 hits her right away. Free tempo, kid."] },
  { match: "Pirc Defense", lines: ["The Pirc. Let him build it, then bite it.", "Bishop on g7, castle, wait. Patience is a recipe."] },
  { match: "Modern Defense", lines: ["The Modern. Bishop on g7 aiming at d4. Sneaky.", "No pieces in the center yet. Very fancy."] },
  { match: "Alekhine Defense", lines: ["Alekhine's! Let him chase the knight. Love it.", "e5, c4, d4. Big center, big target."] },
  { match: "Queen's Gambit Declined", lines: ["Queen's Gambit Declined. Solid as day-old bread.", "Castle, then hit back with ...c5 when it's ready."] },
  { match: "Queen's Gambit Accepted", lines: ["Took on c4? Fine. Just don't try to keep it.", "It's not a real gambit. The pawn comes back."] },
  { match: "Slav Defense", lines: ["The Slav. c6 backs d5, and the bishop stays free.", "Take on c4, then Bf5. Bishop first, always."] },
  { match: "Queen's Pawn Game: London System", lines: ["The London. Same moves every game. Cute.", "...c5, ...Qb6, and his b2 pawn gets nervous."] },
  { match: "King's Indian Defense", lines: ["King's Indian. Give him the center. For now.", "...e5, ...Nc6, ...f5. Race you to the king."] },
  { match: "Nimzo-Indian Defense", lines: ["Nimzo-Indian. Pin the knight. Classy.", "Bishop for knight, and his c-pawns double up. Worth it."] },
  { match: "Queen's Indian Defense", lines: ["Queen's Indian. ...b6, ...Bb7, and e4 is mine.", "Quiet. Like a bakery at 4 a.m."] },
  { match: "Dutch Defense", lines: ["The Dutch! ...f5 on move one. Feisty.", "Stonewall? c6, d5, e6, f5. A fortress of crust."] },
  { match: "English Opening", lines: ["The English. c4 first, the center later.", "...e5 against it? A Sicilian in reverse, a tempo up."] },
  { match: "Réti Opening", lines: ["The Réti. Hit d5 from the side. Hypermodern.", "No pawns in the middle? Fancy. I like fancy."] },
];
export const OPENING_FALLBACK: readonly [string, string] = ["Huh. Never seen that. Gutsy, kid.", "Off the menu. Let's see if it bakes."];

/** His comment on an opening the library names `name` (null: none), with line `pick` of its two (the rules' pick, from the seed). */
export function openingLine(name: string | null | undefined, pick: number): string {
  const fam = name ? OPENING_LINES.find((f) => name.startsWith(f.match)) : undefined;
  const lines = fam?.lines ?? OPENING_FALLBACK;
  return lines[Math.abs(pick) % 2]!;
}
