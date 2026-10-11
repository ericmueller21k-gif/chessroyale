import { SQUADS, type PregameVote, type SquadsClock, type SquadsSettings, type VoteOption } from "@chessroyale/core";

/**
 * Squads' pre-game votes: Start and Clock. Plain data like Crowd's (`core/votes.ts`), so the same machinery runs them:
 * `castPregameVote`, `botVotes`, `closePregameVote` (a tie is drawn, non-voters join the winner). The whole lobby
 * (all 32) votes once, before round 1.
 */

/** The normal starting position / every board from the same opening / each board its own random opening. */
export type SquadsStart = "standard" | "same" | "random";

export interface SquadsRules {
  start: SquadsStart;
  /** The team clock: each squad's starting bank, its top-up a round, the free seconds a move, any increment. */
  clock: SquadsClock;
}

export type SquadsVoteId = "start" | "clock";

export interface SquadsVoteOption extends VoteOption {
  /** What this option sets if it wins (the Crowd `patch` is empty: these aren't Crowd settings). */
  rule: Partial<SquadsRules>;
}

export interface SquadsVote extends PregameVote {
  id: SquadsVoteId;
  options: readonly SquadsVoteOption[];
}

/** A time as chess players write it: "4" (minutes), "1:30", or "0:45". */
export function minutesName(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return sec ? `${m}:${String(sec).padStart(2, "0")}` : `${m}`;
}

/** "4+2": minutes plus the increment in seconds. */
export function clockName(c: { bankSeconds: number; incrementSeconds: number }): string {
  return `${minutesName(c.bankSeconds)}+${c.incrementSeconds}`;
}

/** A Clock option in one line: "Team clock 6 min · +1 min a round · 5 s free a move". */
export function teamClockLine(c: SquadsClock): string {
  const parts = [`Team clock ${minutesName(c.bankSeconds)} min`, `+${minutesName(c.topUpSeconds)} min a round`, `${c.delaySeconds} s free a move`];
  if (c.incrementSeconds) parts.push(`+${c.incrementSeconds} s a move`);
  return parts.join(" · ");
}

/** The votes, left to right, with their numbers from settings. */
export function squadsVotes(s: SquadsSettings = SQUADS): readonly SquadsVote[] {
  return [
    {
      id: "start",
      title: "How do the boards start?",
      defaultOption: 0,
      options: [
        { id: "standard", icon: "♟️", label: "Normal", blurb: "The usual starting position", patch: {}, rule: { start: "standard" } },
        { id: "same", icon: "📖", label: "One opening", blurb: "Every board from the same opening", patch: {}, rule: { start: "same" } },
        {
          id: "random",
          icon: "🎲",
          label: "Random openings",
          blurb: "Each board its own opening",
          detail: "Each opening is played on two boards of a match, colours swapped",
          patch: {},
          rule: { start: "random" },
        },
      ],
    },
    {
      id: "clock",
      title: "How fast?",
      defaultOption: s.clockDefault,
      options: s.clocks.map((c, i) => ({
        id: c.id,
        icon: ["⚡", "⏱️", "🧘"][i] ?? "⏱️",
        label: `${c.label} ${minutesName(c.bankSeconds)} min`,
        blurb: teamClockLine(c),
        detail:
          "One clock per squad for the whole tournament: what's left carries into the next round. It runs past the free seconds while your squad thinks, faster when two of you move at once. At zero it's sudden death: every move within the free seconds.",
        patch: {},
        rule: { clock: c },
      })),
    },
  ];
}

/** The rules from each vote's winning option (a vote not held gives its default). */
export function rulesFromVotes(results: Partial<Record<SquadsVoteId, number>>, s: SquadsSettings = SQUADS): SquadsRules {
  const rules: SquadsRules = { start: "standard", clock: s.clocks[s.clockDefault] ?? s.clocks[0]! };
  for (const vote of squadsVotes(s)) {
    const option = vote.options[results[vote.id] ?? vote.defaultOption] ?? vote.options[vote.defaultOption]!;
    Object.assign(rules, option.rule);
  }
  return rules;
}
