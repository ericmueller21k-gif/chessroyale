import { DEFAULT_SETTINGS, botSkillSpread, shuffle, type Rng, type Settings } from "@chessroyale/core";
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
 * `count` bots with a wide spread of skill (see `botSkillRange` in settings),
 * named and shuffled. Used to fill empty seats.
 */
export function botRoster(rng: Rng, count = DEFAULT_SETTINGS.lobbySize - 1, settings: Settings = DEFAULT_SETTINGS): Entrant[] {
  const skills = botSkillSpread(count, settings);
  const names = shuffle(rng, BOT_NAMES);
  // Past the name list (big lobbies), names repeat with a number: "Queenie 2".
  return skills.map((skill, i) => {
    const lap = Math.floor(i / names.length);
    return { id: `bot${i}`, name: `${names[i % names.length]!}${lap ? ` ${lap + 1}` : ""}`, isBot: true, skill };
  });
}
