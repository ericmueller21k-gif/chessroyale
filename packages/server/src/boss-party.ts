import { BOSS_PARTY, bossDef, bossPartySettings, isPlayable } from "@chessroyale/core";
import type { LobbyRecord, PartyLobby } from "./lobby.ts";
import type { BossStart } from "./squads-party.ts";

/**
 * Boss Battle's live party (Eric, Oct 29 and 30; docs/decisions/2026-10-30-boss-party.md): its battle is a private raid
 * of up to BOSS_PARTY.max, made by the party's Durable Object at START (squads-do.ts, SquadsParty with kind "boss"):
 * - everyone picks every move, seeing the others' picks as they come; the last pick resolves the turn (the draw rule
 *   "party": a majority is played, else the engine's best pick, or one of two within BOSS_PARTY.closeCp at random);
 * - one team clock, BOSS_CLOCK (10 + 10), the turn's length off it; out of time loses; the boss has none;
 * - any member's call for the God King acts for the team (kingAnyCall);
 * - the boss at the leader's difficulty: its Maia rating and its offset on the members' strength, as Boss alone;
 * - never ranked (LobbyCore.ranked), scored as a raid.
 */
export function bossPartyOverrides(s: Pick<BossStart, "boss" | "difficulty">): NonNullable<LobbyRecord["overrides"]> {
  const pick = s.boss && isPlayable(bossDef(s.boss)) ? { bossId: s.boss, bossPicked: s.boss } : {};
  return JSON.parse(JSON.stringify({ ...bossPartySettings(s.difficulty), ...pick })) as NonNullable<LobbyRecord["overrides"]>;
}

/** The battle's party record (LobbyRecord.party) from START, its members given until `startBy` to arrive. */
export function partyLobby(s: BossStart, partyCode: string, now: number): PartyLobby {
  return { pass: s.pass, size: s.size, bots: s.bots, leaderSeat: s.leaderSeat, startBy: now + BOSS_PARTY.joinWaitSec * 1000, seats: {}, partyCode };
}
