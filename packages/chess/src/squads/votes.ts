import { SQUADS, type PregameVote, type SquadsSettings, type VoteOption } from "@chessroyale/core";

/**
 * Squads' pre-game votes: Start, Pace and Length. Plain data like Crowd's (`core/votes.ts`), so the same machinery
 * runs them: `castPregameVote`, `botVotes`, `closePregameVote` (a tie is drawn, non-voters join the winner). The
 * whole lobby (all 32) votes once, before round 1.
 */

/** The normal starting position / every board from the same opening / each board its own random opening. */
export type SquadsStart = "standard" | "same" | "random";
/** Rounds 1 and 2: play to the end, or a move cap (the final is always to the end). */
export type SquadsLength = "end" | "cap";

export interface SquadsRules {
  start: SquadsStart;
  /** About this many seconds a move. */
  paceSeconds: number;
  length: SquadsLength;
}

export type SquadsVoteId = "start" | "pace" | "length";

export interface SquadsVoteOption extends VoteOption {
  /** What this option sets if it wins (the Crowd `patch` is empty: these aren't Crowd settings). */
  rule: Partial<SquadsRules>;
}

export interface SquadsVote extends PregameVote {
  id: SquadsVoteId;
  options: readonly SquadsVoteOption[];
}

/** The three votes, left to right, with their numbers from settings. */
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
      id: "pace",
      title: "How fast?",
      defaultOption: s.paceDefault,
      options: s.paceSeconds.map((sec, i) => ({
        id: `pace-${sec}`,
        icon: ["⚡", "⏱️", "🧘"][i] ?? "⏱️",
        label: `${sec} s`,
        blurb: `About ${sec} seconds a move`,
        patch: {},
        rule: { paceSeconds: sec },
      })),
    },
    {
      id: "length",
      title: "Rounds 1 and 2: how long?",
      // Nobody votes: the cap, so a lobby of 32 isn't kept waiting on one long game.
      defaultOption: 1,
      options: [
        { id: "end", icon: "🏁", label: "To the end", blurb: "Play every game out", patch: {}, rule: { length: "end" } },
        {
          id: "cap",
          icon: "🧮",
          label: `${s.moveCap}-move cap`,
          blurb: `After ${s.moveCap} moves, most material wins`,
          detail: "Level material is a draw. The final is always played to the end.",
          patch: {},
          rule: { length: "cap" },
        },
      ],
    },
  ];
}

/** The rules from each vote's winning option (a vote not held gives its default). */
export function rulesFromVotes(results: Partial<Record<SquadsVoteId, number>>, s: SquadsSettings = SQUADS): SquadsRules {
  const rules: SquadsRules = { start: "standard", paceSeconds: s.paceSeconds[s.paceDefault] ?? s.paceSeconds[0]!, length: "cap" };
  for (const vote of squadsVotes(s)) {
    const option = vote.options[results[vote.id] ?? vote.defaultOption] ?? vote.options[vote.defaultOption]!;
    Object.assign(rules, option.rule);
  }
  return rules;
}
