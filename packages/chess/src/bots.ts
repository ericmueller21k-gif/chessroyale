import { BOT_MAIA, DEFAULT_SETTINGS, botStrength, shuffle, type Rng, type Settings } from "@chessroyale/core";
import { within, type HumanCandidate, type HumanEngineLike } from "./boss-brain.ts";
import type { Entrant } from "./runner.ts";

/** Bot names: chess terms, openings and puns, short enough for a 360 px scoreboard. */
export const BOT_NAMES: readonly string[] = [
  "Rookie Ray", "Pawnstar", "Bishop Bea", "Knightowl", "Castle Cass", "Queenie", "Gambit Gus", "Zugzwang Zoe",
  "En Passant", "Fianchetto", "Blitz Bo", "Endgame Ed", "Tempo Tess", "Fork Lift", "Pin Wheel", "Skewer Sue",
  "Outpost Ollie", "Swindler", "Patzer Pat", "Grandma Moves", "Check Mike", "Stalemate Stu", "Opposition Opal",
  "Kingwalk Kai", "Sac Attack", "Draw Dora", "Back Rank Bob", "Luft Lou", "Hanging Hank", "Prophylaxis Pia",
  "Isolani Ida", "Bongcloud Bea", "Rook Lift Rita", "Zwischenzug Zak", "Pawn Storm Pete", "Knight Rider",
  "Bishop Pair Paul", "Fianchetto Fay", "Gambit Gwen", "Sicilian Sam", "French Fred", "Caro-Kann Kim", "Dutch Dan",
  "London Larry", "Benoni Ben", "Grünfeld Gil", "Pirc Polly", "Scandi Sandy", "Najdorf Nate", "Dragon Drew",
  "Marshall Mo", "Ruy Rosa", "Italian Ivo", "Catalan Cat", "Slav Sasha", "Tarrasch Tom", "Alekhine Al",
  "Philidor Phil", "Petrov Pia", "Vienna Vic", "Evans Eve", "Smith-Morra Sid", "King's Indian Kip", "Nimzo Nina",
  "Queen's Gambit Quinn", "Trompowsky Trina", "Colle Cole", "Stonewall Stan",
  // More (Oct 7, 2026), so a 100-player Crowd lobby never repeats a name. Each fits the scoreboard's name column on a
  // 360 px phone (103 px) with room to spare (97 px at most, measured).
  "Mate Mabel", "Castling Carl", "Promotion Pru", "Discovery Dee", "Ladder Lola", "Battery Bart", "Overload Otto",
  "Decoy Dex", "Deflect Della", "Windmill Winnie", "Smothered Sol", "Perpetual Percy", "Fortress Flo",
  "Zeitnot Zelda", "Flagfall Flora", "Blunder Bert", "Brilliancy Bree", "Arabian Ari", "Theory Theo", "Novelty Nell",
  "Tactics Tia", "Rook and Roll", "Knight Shift", "Pawn Shop Pam", "Open File Fiona", "Half-Open Hal", "Passer Penny",
  "Desperado Dez", "Scholar Sally", "Fool's Mate Finn", "Gambiteer Gina", "Hedgehog Hope", "Hippo Hilda",
  "Orangutan Oona", "Budapest Buddy", "Latvian Lottie", "Danish Daisy", "Scotch Scotty", "Corridor Cora",
  "Berlin Wally", "English Emma", "Modern Molly", "Elephant Ellie", "Halloween Holly", "Bad Bishop Bill",
  "Good Knight Gia", "Knightmare", "Rookery Rory", "Queen Bee", "Check Please", "O-O-O Olga", "Shuffle Shelly",
  "Premove Priya", "Bullet Bella", "Classical Clara", "Simul Simon", "Blindfold Blair", "Pin Pippa",
  "J'adoube Jade", "Kibitz Kiki", "Woodpusher", "Coffeehouse", "Royal Fork Roy", "Family Fork Fern", "X-Ray Xena",
  "Greek Gift Greta", "Quiet Quentin", "Pawn Island Isla", "Midgame Milo", "Nine Sixty Nia", "Epaulette Etta",
  "Tiebreak Tilly",
];

/**
 * `count` bots, named and shuffled, to fill empty seats. Each plays at its name's rating (botStrength: BOT_MAIA's bell
 * curve, the same player every match), with Maia where this device runs it and at that rating's temperature otherwise.
 */
export function botRoster(rng: Rng, count = DEFAULT_SETTINGS.lobbySize - 1, settings: Settings = DEFAULT_SETTINGS): Entrant[] {
  const names = shuffle(rng, BOT_NAMES);
  // Past the name list (big lobbies), names repeat with a number: "Queenie 2".
  return Array.from({ length: count }, (_, i) => {
    const lap = Math.floor(i / names.length);
    const name = `${names[i % names.length]!}${lap ? ` ${lap + 1}` : ""}`;
    return { id: `bot${i}`, name, isBot: true, skill: botStrength(name, settings).skill };
  });
}

/** The bots' Maia over a match: picks by Maia, picks that fell back to the Stockfish-style one, Maia's asks and their time. */
export interface BotBrainStats {
  maia: number;
  fallback: number;
  asks: number;
  askMs: number;
  slowest: number;
}

/**
 * Maia's likeliest moves for bots about to pick in one position: asked once per rating among them (`ratings`, one per
 * bot; the most common first), within BOT_MAIA.budgetMs in all, and no more once `stop` says the round is being scored
 * (a person locked in: nobody waits for the bots). A rating not asked by then, or not answered, is left out: its bots
 * pick Stockfish-style. Never waits for Maia to load (not ready: nothing).
 */
export async function botMaiaLists(
  engine: HumanEngineLike,
  fen: string,
  ratings: readonly number[],
  stats?: BotBrainStats,
  stop: () => boolean = () => false,
  now: () => number = Date.now,
): Promise<Map<number, HumanCandidate[]>> {
  const out = new Map<number, HumanCandidate[]>();
  const count = new Map<number, number>();
  for (const r of ratings) count.set(r, (count.get(r) ?? 0) + 1);
  const t0 = now();
  for (const [rating] of [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const left = BOT_MAIA.budgetMs - (now() - t0);
    if (left <= 0 || stop() || !engine.ready()) break;
    const t = now();
    const answer = await within(engine.candidates(fen, rating, null, { temperature: BOT_MAIA.temperature, topP: BOT_MAIA.topP, multipv: BOT_MAIA.multipv }), left);
    if (stats) {
      const ms = now() - t;
      stats.asks++;
      stats.askMs += ms;
      stats.slowest = Math.max(stats.slowest, ms);
    }
    if (answer?.moves.length) out.set(rating, answer.moves);
  }
  return out;
}
