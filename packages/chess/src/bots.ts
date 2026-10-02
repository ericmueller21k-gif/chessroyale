import { shuffle, type Rng } from "@chessroyale/core";
import type { Entrant } from "./runner.ts";

const NAMES = [
  "Rookie Ray", "Pawnstar", "Bishop Bea", "Knightowl", "Castle Cass", "Queenie", "Gambit Gus", "Zugzwang Zoe",
  "En Passant", "Fianchetto", "Blitz Bo", "Endgame Ed", "Tempo Tess", "Fork Lift", "Pin Wheel", "Skewer Sue",
  "Outpost Ollie", "Swindler", "Patzer Pat", "Grandma Moves", "Check Mike", "Stalemate Stu", "Opposition Opal",
  "Kingwalk Kai", "Sac Attack", "Draw Dora", "Back Rank Bob", "Luft Lou", "Hanging Hank", "Prophylaxis Pia",
  "Isolani Ida",
];

/**
 * `count` bots with a wide spread of skill (T from 0.25, strongest, to 32, loosest),
 * named and shuffled. Used to fill empty seats.
 */
export function botRoster(rng: Rng, count = 31): Entrant[] {
  const skills = Array.from({ length: count }, (_, i) => Math.round(0.25 * Math.pow(128, i / Math.max(1, count - 1)) * 1000) / 1000);
  const names = shuffle(rng, NAMES);
  return skills.map((skill, i) => ({ id: `bot${i}`, name: names[i % names.length]!, isBot: true, skill }));
}
