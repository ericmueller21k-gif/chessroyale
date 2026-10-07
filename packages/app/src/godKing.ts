/**
 * What the God King says while he watches the boss battle: a short line now and
 * then in a speech bubble beside him. Each moment of the game is a cue; a cue
 * has a few lines (picked at random, never the same line twice running), a
 * chance of being said at all, and a priority: urgent cues (your queen in
 * danger, your king in check, a boss blunder) always speak. Small talk is paced
 * by moves: every move he stays quiet makes it likelier, so he speaks up about
 * every four or five moves (5 to 10 lines in a typical boss battle).
 */

import { applyMove, blunderCost, inCheck, pieceAt, toSan, type BlunderCost } from "@chessroyale/chess";

export type KingCue =
  | "intro"
  | "idle"
  | "nudge"
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
  | "spent"
  | "lastStand"
  | "lastWords"
  | "rise";

export const KING_LINES: Record<KingCue, readonly string[]> = {
  intro: ["My blade is yours. Tap me when it counts.", "A boss? I've toppled taller towers.", "Steel's ready. Say the word.", "I'll be watching. Call me if it gets ugly."],
  idle: ["I'm ready when you are.", "My sword grows restless.", "Think like a king.", "Take your time. Not too much.", "I've seen this kind of position before…"],
  nudge: ["Need a hand? Tap me.", "I'm right here if you need me.", "Say the word and I'll strike."],
  queenDanger: ["Your queen is under attack!", "Guard the queen!", "Eyes on your queen. She's in danger!", "They're after your queen. Move her or shield her!"],
  inCheck: ["Your king's in check! Answer it.", "Check! Shield the king."],
  greatMove: ["Masterful! Even I'd play that.", "A move worthy of a crown!", "Brilliant. The boss trembles."],
  goodMove: ["Well struck!", "A fine move.", "Now that's a plan.", "Keep that pressure on."],
  badMove: ["Hm. We'll recover.", "Steady… no more gifts.", "That one hurt. Regroup.", "Careful, the boss smells blood."],
  crowdCapture: ["Spoils of war!", "One less piece to worry about.", "Into the bag it goes!"],
  crowdCheck: ["Check! Make it squirm.", "Their king is running. Chase it!"],
  bossCapture: ["A loss, not the war.", "It bites back. Stay sharp.", "Avenge that piece!"],
  bossBlunder: ["The boss blundered! Pounce!", "A gift from the enemy. Take it!", "It slipped. Make it pay.", "It's reeling! Want me to finish it?", "A blunder! Find the punishing move."],
  staggered: ["My strike still rings in its ears!", "See? It stumbles."],
  struck: ["That'll rattle it.", "Feel my steel, tyrant!"],
  kingPlays: ["Watch and learn.", "Leave this one to me."],
  winning: ["The tide is ours.", "Victory is close. Don't get careless."],
  losing: ["Dark days. I'm here if you need me.", "We're behind. A charge might turn it."],
  spent: ["My strength is spent. The rest is yours.", "No charges left. I believe in you."],
  // His Last Stand: one of these in its banner (lastStandLine), his last words as he falls, and his return.
  lastStand: ["Fall back! This blow is mine.", "Not while I stand!", "Retreat — I'll hold the line!", "Go! I'll take it from here."],
  lastWords: ["Finish… it… for me."],
  rise: ["A god does not stay down."],
};

/**
 * How likely each cue is to be said, whether it cuts in over the pause between
 * lines, and (`paced`) whether its chance grows with every quiet move.
 */
const CUE_RULES: Record<KingCue, { chance: number; urgent?: boolean; paced?: boolean }> = {
  intro: { chance: 1, urgent: true },
  idle: { chance: 0, paced: true },
  nudge: { chance: 0.1, paced: true },
  queenDanger: { chance: 1, urgent: true },
  inCheck: { chance: 1, urgent: true },
  greatMove: { chance: 0.8 },
  goodMove: { chance: 0.35 },
  badMove: { chance: 0.75 },
  crowdCapture: { chance: 0.5 },
  crowdCheck: { chance: 0.7 },
  bossCapture: { chance: 0.5 },
  bossBlunder: { chance: 1, urgent: true },
  staggered: { chance: 0.8 },
  struck: { chance: 1, urgent: true },
  kingPlays: { chance: 1, urgent: true },
  winning: { chance: 0.1, paced: true },
  losing: { chance: 0.1, paced: true },
  spent: { chance: 1 },
  lastStand: { chance: 1, urgent: true },
  lastWords: { chance: 1, urgent: true },
  rise: { chance: 1, urgent: true },
};

/** How long a line stays up, and the least time between two lines that aren't urgent. */
export const SPEECH_MS = 3800;
const QUIET_MS = 8000;
/** Paced small talk rests for a few moves after any line, then gets likelier with each quiet move. */
const REST_MOVES = 3;
const PER_QUIET_MOVE = 0.3;

let current: { text: string; at: number; until: number } | null = null;
let lastAt = 0;
let quietMoves = 0;
/** He has fallen (his Last Stand): silent for the rest of the battle, but for his last words and his return. */
let fallen = false;
export function setKingFallen(on: boolean) {
  fallen = on;
}

/** The line in his Last Stand's banner: the same on every screen for the same move. */
export function lastStandLine(seed: string): string {
  const h = [...seed].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return KING_LINES.lastStand[h % KING_LINES.lastStand.length]!;
}
const turns = new Set<string>();

/** A new move for the crowd (`key` names it, so a screen drawn twice counts once): one more quiet move. */
export function kingTurn(key: string) {
  if (turns.has(key)) return;
  turns.add(key);
  if (turns.size > 300) turns.clear();
  quietMoves++;
}
const lastLine = new Map<KingCue, string>();
const spoken = new Set<string>();

/**
 * Says a line for `cue` (unless the dice, a recent line or a repeat of `key`
 * say otherwise). `key` names the moment, so a screen drawn twice speaks once.
 */
export function kingSay(cue: KingCue, key: string, now = Date.now(), rng: () => number = Math.random): string | null {
  if (fallen && cue !== "lastWords" && cue !== "rise") return null;
  if (spoken.has(key)) return null;
  spoken.add(key);
  if (spoken.size > 300) spoken.clear();
  const rule = CUE_RULES[cue];
  if (!rule.urgent && now - lastAt < QUIET_MS) return null;
  const chance = rule.paced ? Math.min(1, rule.chance + PER_QUIET_MOVE * Math.max(0, quietMoves - REST_MOVES)) : rule.chance;
  if (rng() >= chance) return null;
  const lines = KING_LINES[cue];
  const options = lines.length > 1 ? lines.filter((l) => l !== lastLine.get(cue)) : lines;
  const text = options[Math.floor(rng() * options.length)]!;
  lastLine.set(cue, text);
  current = { text, at: now, until: now + SPEECH_MS };
  lastAt = now;
  quietMoves = 0;
  return text;
}

/**
 * The line on screen right now, if any, and when it started. Every screen of a
 * turn draws its own God King; they all show the same line from the same moment,
 * so a screen change carries on where the bubble was instead of starting over.
 */
export function kingLine(now = Date.now()): { text: string; at: number; until: number } | null {
  return current && now < current.until ? current : null;
}

/** For tests: forget everything said. */
export function resetKingSpeech() {
  current = null;
  fallen = false;
  lastAt = 0;
  quietMoves = 0;
  lastLine.clear();
  spoken.clear();
  turns.clear();
}

/** The God King's word on the crowd's move once it lands: how good it was (points lost against the best move), a check, a capture. */
export function crowdMoveCues(fen: string, played: string, loss: number | null): { cue: KingCue; key: string }[] {
  const key = `crowd-${fen}`;
  const out: { cue: KingCue; key: string }[] = [];
  if (loss !== null && loss >= 12) out.push({ cue: "badMove", key });
  if (inCheck(applyMove(fen, played))) out.push({ cue: "crowdCheck", key });
  if (pieceAt(fen, played.slice(2, 4))) out.push({ cue: "crowdCapture", key });
  if (loss !== null && loss <= 1) out.push({ cue: "greatMove", key });
  else if (loss !== null && loss <= 4) out.push({ cue: "goodMove", key });
  return out;
}

/** The Last Stand's record, as far as the words need it. */
export interface StandFacts {
  move: string;
  reply?: string;
  mateIn?: number;
  before?: number;
  after?: number;
}

const PIECE_WORD = { n: "knight", b: "bishop", r: "rook", q: "queen" } as const;
const pctOf = (x: number) => `${Math.round(x * 100)}%`;

/** What the blunder cost (from the boss's best reply and any mate it allows), for the words below. */
export function standCost(fen: string, s: StandFacts): BlunderCost {
  return blunderCost(fen, s.move, s.reply, s.mateIn);
}

/**
 * The Last Stand's warning and results card, in plain words instead of numbers: "loses your knight", "allows
 * mate", or (the boss's reply wins nothing a player could name) "your chances 52% → 9%".
 */
export function blunderWords(fen: string, s: StandFacts): string {
  const c = standCost(fen, s);
  if (c.kind === "piece") return `loses your ${PIECE_WORD[c.piece]}`;
  if (c.kind === "mate") return "allows mate";
  if (s.before !== undefined && s.after !== undefined) return `your chances ${pctOf(s.before)} → ${pctOf(s.after)}`;
  return "throws the game away";
}

/** The crowd's chances before and after the blunder ("52% → 9%"), if known. */
export function chancesWords(s: StandFacts): string | null {
  return s.before !== undefined && s.after !== undefined ? `${pctOf(s.before)} → ${pctOf(s.after)}` : null;
}

/** The boss's best reply to the blunder (SAN) and what it wins: "wins your knight", "checkmate", "mate in 3" or nothing. */
export function replyWords(fen: string, s: StandFacts): { san: string; note: string } | null {
  if (!s.reply) return null;
  const after = applyMove(fen, s.move);
  let san: string;
  try {
    san = toSan(after, s.reply);
  } catch {
    return null;
  }
  const c = standCost(fen, s);
  const note = c.kind === "piece" ? `wins your ${PIECE_WORD[c.piece]}` : c.kind === "mate" ? (c.in === 1 ? "checkmate" : `mate in ${c.in}`) : "";
  return { san, note };
}

/** "Move 7: Nb5??" (or "Move 7: …Nb5??" for Black): the blunder as the results card names it. */
export function blunderLabel(fen: string, move: string): string {
  const [, side, , , , full] = fen.split(" ");
  return `Move ${full ?? "1"}: ${side === "b" ? "…" : ""}${toSan(fen, move)}??`;
}

export const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
