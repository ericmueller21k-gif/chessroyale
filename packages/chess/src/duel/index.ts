/**
 * Ranked 1 v 1: normal chess between two players with real clocks, after a vote on the time control on the board
 * (docs/areas/ranked.md). Pure rules and the protocol, shared by the server's game object and the app (which plays its
 * bot game by the same rules). Import from "@chessroyale/chess/duel".
 */
export * from "./rules.ts";
export * from "./protocol.ts";
