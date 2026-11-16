# Design + sim: the 50 v 50 rework (move-pick vote, equal cuts to a 1v1, soft reset, podium, RP). Opus, high. No game changes

About 2-3 h. Orphan branch `design/crowd-rework` (design doc, sim script and report, one mockup). Nothing merged into the game.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/crowd.md`, `docs/areas/engine.md` (the judge, the opening allowance), `packages/sim`
(the bot sim), `notes/designs-eric-50v50-redesign.md` and `notes/briefs/mode-ranks-design.md` on `claude/director-notes`, and
`git show origin/design/mode-ranks:notes/designs/mode-ranks.md` (the rank engine this must feed).

**Eric, Nov 16 (his words, summarized):**
- A pre-game vote on how the team's move is picked, replacing the endings vote (the speed vote stays): **Strong** (the top 3 moves
  the team played; close in score: one at random; one clearly best: it), **Majority** (most votes), **Chaos** (totally random among
  the team's moves). Games ending early is fine.
- No more endings (team final, boss battle, duel). Play till the game ends, with a 60-move limit (director: a draw on the board).
- **Cuts:** each round removes the same number from each side, by score relative to your own team, down to a 1v1 that plays normal
  chess to the end (director: aim for the 1v1 around move 40).
- **Scores:** a **soft reset** each round (part of your score carries over; director: try 0%, 25%, 50%, 75%), so recent play counts.
- **Podium:** top 3 pawns on pedestals of different heights, the full chart below. Both the **winner** (last standing, won the game)
  and the **best player** (top whole-match engine score, with a minimum: survived at least half the rounds) shown; one player if both.
- **RP:** from where you finished against what your rating expected in that lobby (leagues ahead: little gain; a tight lobby: a win is
  worth more; a strong lobby: an early cut costs little). Director: Glicko-style expected vs actual over the real players outside
  your party, plus a narrow **tie band**: a pair split by a cut but within a hair in relative score counts as a draw.
- Strong's "close": director's default within ~3% expected score (~30 cp).

**Write `notes/designs/crowd-rework.md`** (2 pages at most): the rules as one plain spec; what changes in today's code (engine, server,
protocol, screens) and the build steps with lanes and effort; risks.
**Sim** (`packages/sim/scripts/crowd-rework-sim.ts` on the design branch; one run, `reports/crowd-rework.md`): bots of known strengths
in 100-seat lobbies, each pick mode; measure for each carry (0/25/50/75%) and tie band: how often the strongest bots survive to the
end, the cut's luck (rank correlation of true strength and finish), game length (how many end early), RP spread per match for a strong,
an average and a weak player in a strong, a mixed and a weak lobby. Recommend the settings.
**Mockup:** one still of the podium results (phone), `notes/mockups/crowd-podium.png` on the design branch (images on that branch only,
never under docs/).
**Questions for Eric:** only what the sim can't settle, few and plain, each with a default.
Commits end with the `Claude-Session:` line only, no model names. Push and end your turn.
