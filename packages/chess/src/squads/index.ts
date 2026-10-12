/**
 * Squads: 8 squads of 4 play team chess in a bracket (docs/areas/squads.md), in Classic or Mercenary mode. Pure rules,
 * no engine (a same-move token's refund and a brilliant move weigh the judge's numbers, given as data); bots use the
 * bot engine like every other mode's. Import from "@chessroyale/chess/squads".
 */
export * from "./board.ts";
export * from "./lobby.ts";
export * from "./schedule.ts";
export * from "./votes.ts";
export * from "./blocks.ts";
export * from "./tokens.ts";
export * from "./mercenary.ts";
export * from "./match.ts";
export * from "./bots.ts";
export * from "./protocol.ts";
