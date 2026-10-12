import { SQUADS, type BotVote, type PregameVote, type Rng, type SquadsClock, type SquadsSettings, type VoteOption } from "@chessroyale/core";

/**
 * Squads' pre-game votes: Mode, Start and Clock. Plain data like Crowd's (`core/votes.ts`), so the same machinery runs
 * them: `castPregameVote`, `botVotes`, `closePregameVote` (a tie is drawn, non-voters join the winner). The whole lobby
 * (all 32) votes once, before round 1.
 */

/**
 * Classic: just chess (same-move tokens in Pairs; no blocks, no coins). Mercenary (Eric, Oct 12): coins earned by play,
 * a team shop between rounds, items for the next round, and move blocks as in Squads v2.
 */
export type SquadsMode = "classic" | "mercenary";

/** The normal starting position / every board from the same opening / each board its own random opening. */
export type SquadsStart = "standard" | "same" | "random";

export interface SquadsRules {
  /** Classic or Mercenary (missing in records from before the mode vote, and in tests: Classic). */
  mode?: SquadsMode;
  start: SquadsStart;
  /** The team clock: each squad's starting bank, its top-up a round, the free seconds a move, any increment. */
  clock: SquadsClock;
}

/** The lobby's mode: Classic unless its rules say Mercenary. */
export const modeOf = (rules: Pick<SquadsRules, "mode"> | null | undefined): SquadsMode => rules?.mode ?? "classic";

export type SquadsVoteId = "mode" | "start" | "clock";

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

/** The mode vote's options: Classic, Mercenary, and a third mode shown as "Coming soon" (it can't be voted for). */
export const MODE_OPTIONS: readonly SquadsVoteOption[] = [
  {
    id: "classic",
    icon: "♟️",
    label: "Classic",
    blurb: "Just chess: no coins, no blocks",
    detail: "Same-move tokens in Pairs, as always",
    patch: {},
    rule: { mode: "classic" },
  },
  {
    id: "mercenary",
    icon: "💰",
    label: "Mercenary",
    blurb: "Earn coins, shop between rounds",
    detail: "Coins for captures and wins; spend them between rounds on items for the next one. Blocks are on.",
    patch: {},
    rule: { mode: "mercenary" },
  },
  { id: "soon", icon: "🔒", label: "Coming soon", blurb: "A third mode is on its way", patch: {}, rule: {}, disabled: true },
];

/** The votes, left to right, with their numbers from settings: Mode, then Start, then Clock. */
export function squadsVotes(s: SquadsSettings = SQUADS): readonly SquadsVote[] {
  return [
    { id: "mode", title: "Which mode?", defaultOption: 0, options: MODE_OPTIONS },
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

/** The votes a lobby holds: all three, or (a test lobby whose mode is set: `?mode=`) Start and Clock only. */
export function heldVotes(forcedMode: SquadsMode | null | undefined, s: SquadsSettings = SQUADS): readonly SquadsVote[] {
  const all = squadsVotes(s);
  return forcedMode ? all.filter((v) => v.id !== "mode") : all;
}

/** Whether an option of a vote may be voted for (not "Coming soon"). */
export const votable = (vote: Pick<PregameVote, "options">, option: number): boolean => Number.isInteger(option) && option >= 0 && option < vote.options.length && !vote.options[option]!.disabled;

/**
 * The bots' mode votes: the lobby draws how strongly its bots lean to Classic (a share in `modeVote.classicLean`), and
 * each bot votes Classic with that chance, else Mercenary, at a random moment in the window; a share (`skip`) doesn't
 * vote (they join the winner). Never the third mode.
 */
export function botModeVotes(rng: Rng, ids: readonly string[], windowMs: number, skip = 0, s: SquadsSettings = SQUADS): BotVote[] {
  const [lo, hi] = s.modeVote.classicLean;
  const lean = lo + rng() * (hi - lo);
  const classic = MODE_OPTIONS.findIndex((o) => o.id === "classic");
  const mercenary = MODE_OPTIONS.findIndex((o) => o.id === "mercenary");
  return ids.flatMap((id) => {
    const option = rng() < lean ? classic : mercenary;
    const atMs = Math.round((0.1 + 0.8 * rng()) * windowMs);
    return skip > 0 && rng() < skip ? [] : [{ id, option, atMs }];
  });
}

/**
 * The rules from each vote's winning option (a vote not held gives its default). `mode`: a test lobby's mode, set by
 * its link, whatever the vote (it doesn't hold one then).
 */
export function rulesFromVotes(results: Partial<Record<SquadsVoteId, number>>, s: SquadsSettings = SQUADS, mode?: SquadsMode | null): SquadsRules {
  const rules: SquadsRules = { mode: "classic", start: "standard", clock: s.clocks[s.clockDefault] ?? s.clocks[0]! };
  for (const vote of squadsVotes(s)) {
    let option = vote.options[results[vote.id] ?? vote.defaultOption] ?? vote.options[vote.defaultOption]!;
    if (option.disabled) option = vote.options[vote.defaultOption]!;
    Object.assign(rules, option.rule);
  }
  if (mode) rules.mode = mode;
  return rules;
}
