import { DEFAULT_SETTINGS, botSkillSpread, shuffle, type Rng, type Settings } from "@chessroyale/core";
import type { Entrant } from "./runner.ts";

const NAMES = [
  "Rookie Ray", "Pawnstar", "Bishop Bea", "Knightowl", "Castle Cass", "Queenie", "Gambit Gus", "Zugzwang Zoe",
  "En Passant", "Fianchetto", "Blitz Bo", "Endgame Ed", "Tempo Tess", "Fork Lift", "Pin Wheel", "Skewer Sue",
  "Outpost Ollie", "Swindler", "Patzer Pat", "Grandma Moves", "Check Mike", "Stalemate Stu", "Opposition Opal",
  "Kingwalk Kai", "Sac Attack", "Draw Dora", "Back Rank Bob", "Luft Lou", "Hanging Hank", "Prophylaxis Pia",
  "Isolani Ida",
  "Bongcloud Bea", "Rook Lift Rita", "Zwischenzug Zak", "Pawn Storm Pete", "Knight Rider", "Bishop Pair Paul", "Fianchetto Fay", "Gambit Gwen", "Sicilian Sam", "French Fred", "Caro-Kann Kim", "Dutch Dan", "London Larry", "Benoni Ben", "Grünfeld Gil", "Pirc Polly", "Scandi Sandy", "Najdorf Nate", "Dragon Drew", "Marshall Mo", "Ruy Rosa", "Italian Ivo", "Catalan Cat", "Slav Sasha", "Tarrasch Tom", "Alekhine Al", "Philidor Phil", "Petrov Pia", "Vienna Vic", "Evans Eve", "Smith-Morra Sid", "King's Indian Kip", "Nimzo Nina", "Queen's Gambit Quinn", "Trompowsky Trina", "Colle Cole", "Stonewall Stan",
];

/**
 * `count` bots with a wide spread of skill (see `botSkillRange` in settings),
 * named and shuffled. Used to fill empty seats.
 */
export function botRoster(rng: Rng, count = DEFAULT_SETTINGS.lobbySize - 1, settings: Settings = DEFAULT_SETTINGS): Entrant[] {
  const skills = botSkillSpread(count, settings);
  const names = shuffle(rng, NAMES);
  // Past the name list (big lobbies), names repeat with a number: "Queenie 2".
  return skills.map((skill, i) => {
    const lap = Math.floor(i / names.length);
    return { id: `bot${i}`, name: `${names[i % names.length]!}${lap ? ` ${lap + 1}` : ""}`, isBot: true, skill };
  });
}
