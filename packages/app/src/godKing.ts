/**
 * What the God King says while he watches the boss battle: a short line now and
 * then in a speech bubble beside him. Each moment of the game is a cue; a cue
 * has a few lines (picked at random, never the same line twice running) and a
 * kind (Eric, Oct 9, 2026: he talked too much, so only critical moments always
 * speak; the numbers are KING_SPEECH in settings.ts):
 * - critical: one opening line, a new danger to your queen or king, a mate
 *   threat, a queen taken either way, his own strikes and moves, his Last
 *   Stand, a boss's power. Always said (but a warning that still holds isn't
 *   repeated on the next move).
 * - remarks on a move (brilliant, good, bad, captures, a check given, the
 *   boss's slips): a low chance, and at most one every few moves.
 * - small talk (idle, the tap-me nudge, winning or losing): rests for several
 *   moves after any line, then gets a little likelier with each quiet move.
 * Each line then stays up for its time, and takes its turn, by the rule every
 * speaker shares (speech.tsx): a critical line cuts in on a remark or small
 * talk; anything else waits for the line before it.
 */

import { KING_SPEECH } from "@chessroyale/core";
import { applyMove, blunderCost, inCheck, legalMoves, pieceAt, queenInDanger, toSan, type BlunderCost } from "@chessroyale/chess";
import { CRITICAL, LOW, NORMAL, Voice, type Priority, type Spoken } from "./speech.tsx";

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
  | "rise"
  | "blizzard"
  | "blizzardKing"
  | "funhouse"
  | "fireTile"
  | "mateThreat"
  | "queenLost"
  | "queenWon";

export const KING_LINES: Record<KingCue, readonly string[]> = {
  // One of these as the battle begins (Eric, Oct 9: one opening line, from a much bigger pool).
  intro: [
    "My blade is yours. Tap me when it counts.",
    "A boss? I've toppled taller towers.",
    "Steel's ready. Say the word.",
    "I'll be watching. Call me if it gets ugly.",
    "Another tyrant on a borrowed throne. Let's take it back.",
    "Stand tall. Kings bow to no beast.",
    "Sixty-four squares, and not one of them is theirs.",
    "Ready the pawns. Glory starts small.",
    "Fear is a pinned piece. Don't let it move you.",
    "Let's give the bards something to sing about.",
    "Hold the centre, and hold your nerve.",
    "My sword remembers every boss it has met.",
    "Courage. I fight beside you.",
    "Every crowd needs a champion. Today, I'm yours.",
    "Think twice, move once. I'll guard the rest.",
    "Light the torches. We march.",
    "Mind your queen. She's worth more than my crown.",
    "The board is set. Let the reckoning begin.",
    "A good opening is half a crown.",
    "I've waited all day for a worthy fight.",
    "Show me the king you can be.",
    "This throne has a squatter. Evict it.",
    "Patience and steel. That's how bosses fall.",
    "Raise your banners. This one ends on our terms.",
  ],
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
  // A boss's powers: after the blizzard (the queen alone is free; with no queen to move, the king), after the funhouse.
  blizzard: [
    "Looks like our queen withstood the storm!",
    "Frozen solid, all but our queen. She's ready.",
    "Ice everywhere, yet the queen still stands!",
    "That storm couldn't touch our queen.",
  ],
  blizzardKing: ["Frozen solid! Only our king can move.", "The storm spared the king alone. Steady, Majesty."],
  funhouse: ["Upside down? Shake it off!", "That clown played our move! We'll fix it.", "Hold on, the board's spinning. Eyes up!"],
  // A mate threatened against us (as our move begins), and a queen taken, either way.
  mateThreat: ["Mate is near! Shield the king.", "It threatens mate. Look again!", "Danger at the gate. Guard the king!"],
  queenLost: ["Our queen has fallen. Fight on!", "The queen! She'll be avenged.", "They took the queen. Hold the line."],
  queenWon: ["Their queen falls!", "The tyrant's queen is ours!", "Down goes the queen. Press on!"],
  // G-REX: the first time a piece of ours steps onto a burning tile (once a match).
  fireTile: [
    "Careful on that tile, don't stand there too long!",
    "That square's burning! Don't linger.",
    "Hot ground! Step off before it flares up.",
    "Mind the fire underfoot. Move on soon!",
  ],
};

/** Each cue's kind: critical cues always speak; remarks and small talk (`paced`) roll KING_SPEECH.chance. */
type Kind = "critical" | "remark" | "paced" | "info";
const KIND: Record<KingCue, Kind> = {
  intro: "critical",
  idle: "paced",
  nudge: "paced",
  queenDanger: "critical",
  inCheck: "critical",
  mateThreat: "critical",
  queenLost: "critical",
  queenWon: "critical",
  greatMove: "remark",
  goodMove: "remark",
  badMove: "remark",
  crowdCapture: "remark",
  crowdCheck: "remark",
  bossCapture: "remark",
  bossBlunder: "remark",
  staggered: "remark",
  struck: "critical",
  kingPlays: "critical",
  winning: "paced",
  losing: "paced",
  spent: "info",
  lastStand: "critical",
  lastWords: "critical",
  rise: "critical",
  blizzard: "critical",
  blizzardKing: "critical",
  funhouse: "critical",
  fireTile: "critical",
};

/** How much each kind of line matters to his voice: critical cuts in; a remark waits its turn ahead of small talk. */
const PRIORITY: Record<Kind, Priority> = { critical: CRITICAL, remark: NORMAL, paced: LOW, info: LOW };

/** His voice: one line at a time, each for its time (speech.tsx). */
const voice = new Voice();
let lastAt = 0;
let quietMoves = 0;
/** Crowd moves so far, and the move of the last remark. */
let moveNo = 0;
let remarkAt = -Infinity;
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
  moveNo++;
}
const lastLine = new Map<KingCue, string>();
const spoken = new Set<string>();

/**
 * Says a line for `cue` (unless the dice, a recent line or a repeat of `key`
 * say otherwise). `key` names the moment, so a screen drawn twice speaks once.
 */
export function kingSay(cue: KingCue, key: string, now = Date.now(), rng: () => number = Math.random): string | null {
  // Fallen, he stays silent (Eric, Oct 9: the blizzard's word too), but for his last words and his return.
  if (fallen && cue !== "lastWords" && cue !== "rise") return null;
  if (spoken.has(key)) return null;
  spoken.add(key);
  if (spoken.size > 300) spoken.clear();
  const kind = KIND[cue];
  if (kind !== "critical") {
    if (now - lastAt < KING_SPEECH.quietMs) return null;
    if (kind === "remark" && moveNo - remarkAt < KING_SPEECH.remarkGapMoves) return null;
    const base = KING_SPEECH.chance[cue] ?? 0;
    const chance = kind === "paced" ? Math.min(1, base + KING_SPEECH.perQuietMove * Math.max(0, quietMoves - KING_SPEECH.restMoves)) : base;
    if (rng() >= chance) return null;
  }
  const lines = KING_LINES[cue];
  const options = lines.length > 1 ? lines.filter((l) => l !== lastLine.get(cue)) : lines;
  const text = options[Math.floor(rng() * options.length)]!;
  lastLine.set(cue, text);
  voice.say(text, key, PRIORITY[kind], now);
  lastAt = now;
  quietMoves = 0;
  if (kind === "remark") remarkAt = moveNo;
  return text;
}

/**
 * The line on screen right now, if any, and when it started. Every screen of a
 * turn draws its own God King; they all show the same line from the same moment,
 * so a screen change carries on where the bubble was instead of starting over.
 */
export function kingLine(now = Date.now()): Spoken | null {
  return voice.line(now);
}

/** For tests: forget everything said. */
export function resetKingSpeech() {
  voice.reset();
  fallen = false;
  lastAt = 0;
  quietMoves = 0;
  moveNo = 0;
  remarkAt = -Infinity;
  lastLine.clear();
  spoken.clear();
  turns.clear();
}

/**
 * The God King's word on the crowd's move once it lands: the boss's queen taken (always), how good it was (points lost
 * against the best move), a check, a capture.
 */
export function crowdMoveCues(fen: string, played: string, loss: number | null): { cue: KingCue; key: string }[] {
  const key = `crowd-${fen}`;
  const out: { cue: KingCue; key: string }[] = [];
  const took = pieceAt(fen, played.slice(2, 4));
  if (took?.type === "q") out.push({ cue: "queenWon", key });
  if (loss !== null && loss >= 12) out.push({ cue: "badMove", key });
  if (inCheck(applyMove(fen, played))) out.push({ cue: "crowdCheck", key });
  if (took) out.push({ cue: "crowdCapture", key });
  if (loss !== null && loss <= 1) out.push({ cue: "greatMove", key });
  else if (loss !== null && loss <= 4) out.push({ cue: "goodMove", key });
  return out;
}

/** The side to move in `fen` (the crowd, as its move begins) is threatened with mate in one: if it passed, the other side could mate. */
export function mateThreatened(fen: string): boolean {
  if (inCheck(fen)) return false;
  const parts = fen.split(" ");
  // The same position with the other side to move (no en passant): can it mate at once?
  const passed = [parts[0], parts[1] === "w" ? "b" : "w", parts[2], "-", "0", parts[5] ?? "1"].join(" ");
  try {
    return legalMoves(passed).some((m) => {
      const after = applyMove(passed, m);
      return inCheck(after) && legalMoves(after).length === 0;
    });
  } catch {
    return false;
  }
}

/**
 * What he might say as the crowd's move begins (the play screen), most important first: his strike, a new danger
 * (your queen attacked, your king in check, a mate threatened: each only when it wasn't so at the crowd's last move,
 * `prevFen`), his opening line, out of charges, how it's going, the nudge, small talk. `ours`: the crowd's chances.
 */
export function turnCues(s: { fen: string; side: "w" | "b"; charges: number; ply: number; ours?: number; struckAt?: number; prevFen?: string }): { cue: KingCue; key: string }[] {
  const { fen, side, prevFen } = s;
  const out: { cue: KingCue; key: string }[] = [];
  if (s.struckAt) out.push({ cue: "struck", key: `struck-${s.struckAt}` });
  if (queenInDanger(fen, side) && !(prevFen && queenInDanger(prevFen, side))) out.push({ cue: "queenDanger", key: `queen-${fen}` });
  if (inCheck(fen) && !(prevFen && inCheck(prevFen))) out.push({ cue: "inCheck", key: `check-${fen}` });
  if (mateThreatened(fen) && !(prevFen && mateThreatened(prevFen))) out.push({ cue: "mateThreat", key: `mate-${fen}` });
  out.push({ cue: "intro", key: "intro" });
  if (s.charges <= 0) out.push({ cue: "spent", key: "spent" });
  if (s.ours !== undefined) {
    if (s.ours >= 0.85) out.push({ cue: "winning", key: `winning-${fen}` });
    else if (s.ours <= 0.15) out.push({ cue: "losing", key: `losing-${fen}` });
  }
  if (s.charges > 0 && s.ply >= 6) out.push({ cue: "nudge", key: `nudge-${Math.floor(s.ply / 12)}` });
  out.push({ cue: "idle", key: `idle-${fen}` });
  return out;
}

/** His word on the boss's move: your queen taken (always; its banner plays too), then his strike's effect, a capture. */
export function bossMoveCues(fen: string, move: { captured?: string | null; staggered?: boolean }): { cue: KingCue; key: string }[] {
  const key = `boss-${fen}`;
  const out: { cue: KingCue; key: string }[] = [];
  if (move.captured === "q") out.push({ cue: "queenLost", key });
  if (move.staggered) out.push({ cue: "staggered", key });
  if (move.captured && move.captured !== "q") out.push({ cue: "bossCapture", key });
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
