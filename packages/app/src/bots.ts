import { shuffle, type Rng } from "@chessroyale/core";
import type { Entrant } from "@chessroyale/chess";

const NAMES = [
  "Rookie Ray", "Pawnstar", "Bishop Bea", "Knightowl", "Castle Cass", "Queenie", "Gambit Gus", "Zugzwang Zoe",
  "En Passant", "Fianchetto", "Blitz Bo", "Endgame Ed", "Tempo Tess", "Fork Lift", "Pin Wheel", "Skewer Sue",
  "Outpost Ollie", "Swindler", "Patzer Pat", "Grandma Moves", "Check Mike", "Stalemate Stu", "Opposition Opal",
  "Kingwalk Kai", "Sac Attack", "Draw Dora", "Back Rank Bob", "Luft Lou", "Hanging Hank", "Prophylaxis Pia",
  "Isolani Ida",
];

/** 31 bots with a wide spread of skill (T from 0.25, strongest, to 32, loosest), named and shuffled. */
export function botRoster(rng: Rng): Entrant[] {
  const skills = Array.from({ length: 31 }, (_, i) => Math.round(0.25 * Math.pow(128, i / 30) * 1000) / 1000);
  const names = shuffle(rng, NAMES);
  return skills.map((skill, i) => ({ id: `bot${i}`, name: names[i]!, isBot: true, skill }));
}
