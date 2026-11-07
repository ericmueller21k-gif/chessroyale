/**
 * Dash's lines (Nov 3; docs/decisions/2026-11-03-dash.md): a lanky, cocky cheetah who tries way too hard to talk like the
 * younger crowd (Eric, Nov 3: "Yo, this game is chopped, bro", broski, fam, cuz) and doesn't quite pull it off; a sneaker
 * hustler, always eyeing your shoes. Friendly-cocky, never mean. The director's draft (Nov 3, Eric liked the direction) merged
 * with the art session's (scripts/boss-art/out/blitz-lines-draft.md on claude/boss-art), two or three a moment, short enough
 * for the bubble. His name is always Dash.
 *
 * - `power`: his Clock Slap (the rules' `slap`: a capture of his stole your time); `capture`: his capture as it lands (a short
 *   one, seldom: his slap's line comes as your turn begins).
 * - `ultimateWarn`: Time Scramble's warning; `ultimate`: Time Scramble (`scramble`); `flag`: your time ran out, a random move
 *   played for you (`flag`).
 * - `thinking`: he never thinks (his moves come at once): what he says while you do.
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const DASH_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Yo yo yo! Dash in the building, fam!", "Sup, cuz. Ready to get cooked?", "Bet. Let's run it, broski."],
  move: ["Speed, baby.", "Too easy, fam.", "Ayo, what size? Asking for a friend."],
  capture: ["That piece? Chopped. Fully chopped.", "Sheesh!"],
  power: ["Yoink! That time's mine now, cuz.", "Sheesh! Clock slap, baby!", "W in the chat. W on my clock."],
  hurt: ["Yo, that's lowkey rude.", "Okay, okay. W for you, fam. Small W."],
  strike: ["Yoink!", "Too slow, cuz!"],
  thinking: ["Bro, I already know my move. No cap.", "Clock's ticking, fam. Tick tock.", "Yo, where'd you cop those kicks, broski?"],
  check: ["Check, broski. It's giving… checkmate.", "Check! Bussin. Is that the word?"],
  smug: ["Chopped, bro. Chopped.", "Main character? Kinda, yeah.", "Real quick: you wanna try these on?"],
  rattled: ["Not sweating. It's just humid.", "Deadass did not see that coming."],
  ultimateWarn: ["Speed run, broski! Let's gooo!", "Lace up, fam. This is gonna be quick."],
  ultimate: ["Three seconds a move, cuz. Skrrt!", "Tick tock, my guy. Tick tock."],
  flag: ["Too slow, cuz! I picked one for you.", "No cap, you need Cheetahs.", "Bro moved like he's in flip-flops."],
  victory: ["Too fast, fam! Built different!", "W! Big W! Hashtag no cap.", "W in the chat. Shoes are 20% off, broski."],
  defeat: ["GG, cuz. Lowkey you're goated.", "I'm cooked. Bro, I'm so cooked."],
  // His attack on a king (the God King's Last Stand after your blunder, and his mate).
  kingAttack: ["Too slow, my guy! Swipe, swipe, swipe!", "Blunder tax, fam. Paid in full.", "Zoom zoom! That one's on you, cuz."],
};

/**
 * Dash v2's lines (Eric, Nov 6; docs/decisions/2026-11-06-dash-v2.md), in his voice:
 * - `fit`: his clock fit (at most twice a battle, a few quick smacks): a quirk, he just loves that clock (Eric's two, and three more);
 * - his Scramble Rush: its warning a turn ahead (`warn`, with RAGE!, "Next turn: Scramble Rush"; Eric, Nov 6: "hope you were
 *   watching"), as the sweep ends (`done`), a piece put down one square off (`close`) or further (`far`), and the crowd too few
 *   back, as he moves again (`fail`). The God King's are his (godKing.ts: rushAsk, rushWell).
 */
export const DASH_FIT_LINES: readonly string[] = [
  "Nothing beats that click. I love this clock.",
  "Best sound in the world, fam.",
  "Click click! Sorry, it's a whole vibe.",
  "My guy, listen to that. Pure music.",
  "Can't help it, cuz. This clock is my therapy.",
];
export const DASH_RUSH_LINES = {
  warn: ["Hope you were watching.", "Eyes on the board, fam. Trust me.", "Take a good look, cuz. Real good.", "Memorize it, my guy. No cap."],
  done: ["Hope I wasn't too quick for you.", "Blink and you missed it, fam.", "Too fast? My bad, cuz. Not really."],
  close: ["Close, but not quite!"],
  far: ["Not even close."],
  fail: ["Guess I'll move again. Clearly you weren't paying attention.", "My turn again, fam. Rules are rules.", "Nah, that's not it. I'll take another one, cuz."],
} as const;

/** How often each moment speaks: every boss's beats, his slap, his scramble and your flag always. */
export const DASH_CHANCE: Partial<Record<Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.25,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.3,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 1,
  ultimateWarn: 1,
  ultimate: 1,
  flag: 1,
  kingAttack: 1,
};
