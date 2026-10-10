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
  /** Every board's chess clock: each side's bank and increment in rounds 1 and 2, and the final's own. */
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

/** "4+2": minutes (or m:ss) plus the increment in seconds, as chess players write a clock. */
export function clockName(c: Pick<SquadsClock, "bankSeconds" | "incrementSeconds">): string {
  const m = Math.floor(c.bankSeconds / 60);
  const sec = c.bankSeconds % 60;
  return `${sec ? `${m}:${String(sec).padStart(2, "0")}` : m}+${c.incrementSeconds}`;
}

/** An option's final clock, written the same way ("4+5"). */
export const finalClockName = (c: Pick<SquadsClock, "finalBankSeconds" | "finalIncrementSeconds">) =>
  clockName({ bankSeconds: c.finalBankSeconds, incrementSeconds: c.finalIncrementSeconds });

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
        label: `${c.label} ${clockName(c)}`,
        blurb: `Rounds 1 and 2: ${clockName(c)}. The final: ${finalClockName(c)}`,
        detail: `Minutes each side, plus seconds a move. Run out of time and you lose that board (a draw if the other side can't mate). Every game is played to the end.`,
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
