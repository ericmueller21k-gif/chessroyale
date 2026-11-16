/**
 * The quick chat of the meeting before round 1 (Eric, Oct 24: "your greetings, one's like good luck, have fun, or hello… we'll have some funny
 * ones"). One list: the lines you can tap, and the ones the bot picks from (its answer is a random one of them). To add a line, add it here.
 */
export const QUICK_CHAT: readonly string[] = ["Good luck, have fun!", "Hello!", "May the best army win.", "Nice outfit."];

/** The bot's opening line, when you haven't chatted by the time it is due (settings: `introOpenMs`). */
export const BOT_OPENER = "Good luck, have fun!";

/** A line from the quick chat list, at random: `rng` gives a number in [0, 1). */
export function chatLine(rng: () => number): string {
  return QUICK_CHAT[Math.floor(rng() * QUICK_CHAT.length)] ?? BOT_OPENER;
}

/** How long the bot takes to answer, in ms: a random time between the two numbers (settings: `introReplyMs`). */
export function replyMs(rng: () => number, [from, to]: readonly [number, number]): number {
  return from + (to - from) * rng();
}
