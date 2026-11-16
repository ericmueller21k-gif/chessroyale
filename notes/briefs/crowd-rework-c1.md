# 50 v 50 rework, step C1: the rules in core. Opus, xhigh (rules, scoring, cuts). Targeted lane

Branch `claude/crowd-rework-c1` from main. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/crowd.md`, and the design:
`git show origin/design/crowd-rework:notes/designs/crowd-rework.md` (rules 1-7, section 3's core part, the C1 row), its sim report
`reports/crowd-rework.md` on that branch.

**Eric, Nov 16:** "Yeah, the 50v50 rework. We're doing away with the hidden boss on that for now." The director's defaults stand for his
open questions: move 60 = the judge's verdict (75%+ wins, else a draw); Chaos = every distinct picked move equally likely; a game over
before the 1 v 1 = the winning side's survivors place first. The Hidden Boss's 50 v 50 final goes (his code stays, unreached; C4).

**C1 (core only, `packages/core`):** the pick vote and its three modes (`votes.ts`: "How are moves picked?" strong / majority / chaos,
nobody votes: strong; the start and speed votes stay), the played move by mode in `match.ts` (Strong: the 3 most-picked, the judge's
best, any within `CROWD_PICK.strongClose` 0.03 drawn equally; Majority; Chaos; a miss's move never counts; nobody picked: engine top 5),
the cut schedule `CROWD_CUTS` (after moves 14, 18, 22, 26, 30, 33, 39, 42; equal from each side by round score relative to own team;
today's tie rules), `crowdCarry` 0.5 at each cut, `crowdMoveLimit` 60, the places (rule 5), `bestPlayer()` (fewest points given away a
move among those who survived at least half the cuts made). Every number in `settings.ts`. Raids keep what they use.
**Not in C1:** the runner, server, protocol, screens (C2, C3), removing the old endings (C4), RP (C5). C1 must not change how today's
50 v 50 plays until C2 wires it: new code paths behind the settings C2 switches, or the old ones untouched.
**Checks:** a new `packages/core/test/crowd-rework.test.ts` (each mode's pick, the schedule to the 1 v 1, the carry, ties, the places,
best player, a 2-a-side and 1-a-side round), the existing `votes`, `cut-ties`, `crowd-bot-spread` tests (old → new in the PR body);
typecheck. Push at each real step; `.pr-body.md` (short, under 60 lines) and `.done`. Commits end with the `Claude-Session:` line only,
no model names. No PR, no waiting on CI.
