/**
 * What the God King says while he watches the boss battle: a short line now and
 * then in a speech bubble beside him. Each moment of the game is a cue; a cue
 * has a few lines (picked at random, never the same line twice running), a
 * chance of being said at all, and a priority: urgent cues (your queen in
 * danger, your king in check) always speak, small talk waits its turn.
 */

export type KingCue =
  | "intro"
  | "idle"
  | "queenDanger"
  | "inCheck"
  | "greatMove"
  | "goodMove"
  | "badMove"
  | "crowdCapture"
  | "crowdCheck"
  | "bossCapture"
  | "bossBlunder"
  | "staggered"
  | "struck"
  | "kingPlays"
  | "winning"
  | "losing"
  | "spent";

export const KING_LINES: Record<KingCue, readonly string[]> = {
  intro: ["My blade is yours. Tap me when it counts.", "A boss? I've toppled taller towers.", "Steel's ready. Say the word.", "I'll be watching. Call me if it gets ugly."],
  idle: ["I'm ready when you are.", "My sword grows restless.", "Think like a king.", "Take your time. Not too much.", "I've seen this kind of position before…"],
  queenDanger: ["Your queen is under attack!", "Guard the queen!", "Eyes on your queen. She's in danger!", "They're after your queen. Move her or shield her!"],
  inCheck: ["Your king's in check! Answer it.", "Check! Shield the king."],
  greatMove: ["Masterful! Even I'd play that.", "A move worthy of a crown!", "Brilliant. The boss trembles."],
  goodMove: ["Well struck!", "A fine move.", "Now that's a plan.", "Keep that pressure on."],
  badMove: ["Hm. We'll recover.", "Steady… no more gifts.", "That one hurt. Regroup.", "Careful, the boss smells blood."],
  crowdCapture: ["Spoils of war!", "One less piece to worry about.", "Into the bag it goes!"],
  crowdCheck: ["Check! Make it squirm.", "Their king is running. Chase it!"],
  bossCapture: ["A loss, not the war.", "It bites back. Stay sharp.", "Avenge that piece!"],
  bossBlunder: ["The boss blundered! Pounce!", "A gift from the enemy. Take it!", "It slipped. Make it pay."],
  staggered: ["My strike still rings in its ears!", "See? It stumbles."],
  struck: ["That'll rattle it.", "Feel my steel, tyrant!"],
  kingPlays: ["Watch and learn.", "Leave this one to me."],
  winning: ["The tide is ours.", "Victory is close. Don't get careless."],
  losing: ["Dark days. I'm here if you need me.", "We're behind. A charge might turn it."],
  spent: ["My strength is spent. The rest is yours.", "No charges left. I believe in you."],
};

/** How likely each cue is to be said, and whether it cuts in over small talk. */
const CUE_RULES: Record<KingCue, { chance: number; urgent?: boolean }> = {
  intro: { chance: 1, urgent: true },
  idle: { chance: 0.25 },
  queenDanger: { chance: 1, urgent: true },
  inCheck: { chance: 1, urgent: true },
  greatMove: { chance: 0.8 },
  goodMove: { chance: 0.35 },
  badMove: { chance: 0.75 },
  crowdCapture: { chance: 0.6 },
  crowdCheck: { chance: 0.7 },
  bossCapture: { chance: 0.6 },
  bossBlunder: { chance: 0.9 },
  staggered: { chance: 0.8 },
  struck: { chance: 1, urgent: true },
  kingPlays: { chance: 1, urgent: true },
  winning: { chance: 0.3 },
  losing: { chance: 0.3 },
  spent: { chance: 1 },
};

/** How long a line stays up, and the least time between two lines of small talk. */
export const SPEECH_MS = 3800;
const QUIET_MS = 6000;

let current: { text: string; until: number } | null = null;
let lastAt = 0;
const lastLine = new Map<KingCue, string>();
const spoken = new Set<string>();

/**
 * Says a line for `cue` (unless the dice, a recent line or a repeat of `key`
 * say otherwise). `key` names the moment, so a screen drawn twice speaks once.
 */
export function kingSay(cue: KingCue, key: string, now = Date.now(), rng: () => number = Math.random): string | null {
  if (spoken.has(key)) return null;
  spoken.add(key);
  if (spoken.size > 300) spoken.clear();
  const rule = CUE_RULES[cue];
  if (!rule.urgent && now - lastAt < QUIET_MS) return null;
  if (rng() >= rule.chance) return null;
  const lines = KING_LINES[cue];
  const options = lines.length > 1 ? lines.filter((l) => l !== lastLine.get(cue)) : lines;
  const text = options[Math.floor(rng() * options.length)]!;
  lastLine.set(cue, text);
  current = { text, until: now + SPEECH_MS };
  lastAt = now;
  return text;
}

/** The line on screen right now, if any. */
export function kingLine(now = Date.now()): string | null {
  return current && now < current.until ? current.text : null;
}

/** For tests: forget everything said. */
export function resetKingSpeech() {
  current = null;
  lastAt = 0;
  lastLine.clear();
  spoken.clear();
}
