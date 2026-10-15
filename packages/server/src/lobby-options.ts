import { BOSS_TIERS, POWER_IDS, WEAK_BOT_SKILL, bossDef, bossIdFromLink, isPlayable, LOBBY_LIFE, CROWD_KNOCKOUTS, RAID_SETTINGS, DRAW_RULES, MAX_OPENING_MOVES, QUICK_PACE, definedOnly, modeSettings, speedOption, type DrawRule, type FinalFormat } from "@chessroyale/core";
import type { LobbyRecord } from "./lobby.ts";

/**
 * A new lobby's settings, from POST /api/lobby's query (index.ts). Two kinds of options:
 *   - the creator's choices, which anyone may make (the home screen's): the mode (`mode=classic|crowd|raid`), Crowd's
 *     augments (`augments=0|1`), Classic's opening moves (`moves=0-10`) and the raid's boss (`boss=<id>`, a playable
 *     one);
 *   - test switches (playtests and the e2e; docs/areas/ops.md, "Test switches"): the keys in LOBBY_TEST_SWITCHES, a
 *     boss's fixed strength (`boss=1600`, one of the tiers) and a boss for any mode but a raid. Only where `test` (an
 *     admin, or TEST_SWITCHES on: testSwitchesOn in admin.ts); for anyone else they're dropped, silently, so the lobby
 *     is exactly the one made without them.
 */
export const LOBBY_TEST_SWITCHES = ["rounds", "clock", "finalTurns", "bossMoves", "draw", "power", "format", "speed", "weakbots", "keep", "pace"] as const;

/** `?boss=` is the creator's pick only in a raid, as a boss's id: a fixed strength (a tier), or a boss in another mode, is a test's. */
const testBoss = (q: URLSearchParams) => q.has("boss") && (q.get("mode") !== "raid" || BOSS_TIERS.includes(Number(q.get("boss"))));

/** Whether this query asks for any test switch (so the caller looks up who's asking only then). */
export function asksTestSwitches(q: URLSearchParams): boolean {
  return LOBBY_TEST_SWITCHES.some((k) => q.has(k)) || testBoss(q);
}

/** The query without its test switches: what someone who may not use them gets. */
function withoutTestSwitches(q: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(q);
  for (const k of LOBBY_TEST_SWITCHES) out.delete(k);
  if (testBoss(q)) out.delete("boss");
  return out;
}

export function lobbyOptions(query: URLSearchParams, test: boolean): { overrides: NonNullable<LobbyRecord["overrides"]>; keepMs?: number } {
  const q = test ? query : withoutTestSwitches(query);
  // Playtest overrides, e.g. POST /api/lobby?rounds=2&clock=15
  const n = (k: string) => (q.has(k) ? Math.max(1, Math.min(600, Number(q.get(k)) || 0)) : undefined);
  const draw = q.get("draw") as DrawRule | null;
  // The mode first (its own pace and rules), then playtest overrides on top.
  const raid = q.get("mode") === "raid";
  const mode = raid || q.get("mode") === "crowd" ? "crowd" : "classic";
  const overrides = {
    ...(raid ? RAID_SETTINGS : modeSettings(mode, { augments: q.get("augments") !== "0" })),
    // ?pace=quick: a shorter reveal and less settling in (for testing).
    ...(q.get("pace") === "quick" ? QUICK_PACE[mode] : {}),
    // Playtest overrides and the creator's choices: only the ones that are set.
    ...definedOnly({
      // Boss raid: the boss the creator picked (a playable one), else a random one; a test link's tier fixes its
      // strength (else a step above the group, plus the boss's offset). ?power= brings a power at once (tests).
      ...(() => {
        const b = bossIdFromLink(q.get("boss"));
        const tier = Number(b);
        if (raid && BOSS_TIERS.includes(tier)) return { bossFixedElo: tier, bossFixed: tier };
        return b && isPlayable(bossDef(b)) ? { bossId: b, bossPicked: b } : {};
      })(),
      ...(() => {
        const p = q.get("power");
        return p && (POWER_IDS as readonly string[]).includes(p) ? { bossPowerTest: p } : {};
      })(),
      roundsPerStage: n("rounds"),
      firstStageRounds: n("rounds"),
      moveClockSeconds: n("clock"),
      finalMaxTurns: n("finalTurns"),
      bossMaxMoves: n("bossMoves"),
      drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
      // Opening moves per side on each board (0-10), chosen by the lobby's creator.
      openingMoves: mode === "classic" && q.has("moves") ? Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(Number(q.get("moves")) || 0))) : undefined,
    }),
    // ?format=team|boss|duel: skip the pre-game votes and play that ending (for testing).
    ...(() => {
      const f = q.get("format") as FinalFormat | null;
      return mode === "crowd" && f && f in CROWD_KNOCKOUTS ? { finalFormat: f, knockoutsPerStage: CROWD_KNOCKOUTS[f], augments: false } : {};
    })(),
    // ?speed=bullet|blitz|rapid: that time control (for testing, with ?format=; old ids map over, unknown ones are Blitz).
    ...(mode === "crowd" ? (speedOption(q.get("speed"))?.patch ?? {}) : {}),
    // ?weakbots=1: every bot plays loosely (for testing: a strong player surely survives the cuts).
    ...(q.get("weakbots") === "1" ? { botSkillRange: WEAK_BOT_SKILL } : {}),
  };
  // ?keep=SECONDS: its results stay up this long (5 s up to the usual 15 minutes), for tests.
  const keepMs = q.has("keep") ? Math.max(5, Math.min(LOBBY_LIFE.lobbyResultsKeepMinutes * 60, Number(q.get("keep")) || 0)) * 1000 : undefined;
  return { overrides: JSON.parse(JSON.stringify(overrides)) as NonNullable<LobbyRecord["overrides"]>, ...(keepMs ? { keepMs } : {}) };
}
