# Brief: every crowd bot plays with Maia (human-like), at varied strengths. Opus, high

Worktree `/home/user/cr-maia-bots`, branch `claude/maia-bots` (from main 58c9dd3).

Eric, Nov 1, after a bots-only Crowd 50 v 50: "these bots seem to be playing very stockfishy… I think it must be loading
stockfish… the base bots should all be playing off of a Maia engine at this point… with varying strength, and that would
also add some more variety to the game. Same with squad in any mode where there's bots, except for where we've already
made the exceptions and use cases for stockfish."

What's there today (check it): the Crowd's and Squads' bots pick from Stockfish's candidates with a skill temperature
(`packages/chess/src/bots.ts`, `botCandidateMoves`, `botSkillRange`, `botRandomMoveChance` in
`packages/core/src/settings.ts`). Maia already plays for bosses (`boss-brain.ts`, `maia.ts`, runner's `bossMoveFrom`),
duels and the town's bots (`town/world.ts`).

## Step 1: map it (short, in your report)
Every place a bot picks a move, in every mode (Crowd 50 v 50, Squads, raids if bots play there, the solo and online paths,
the sims, the e2e bot drivers), what brain it uses, and where it runs (this device, the host's, the server, the engine
server). The exceptions to keep on Stockfish: anything that is the judge (scoring), the God King, the bosses' own brains as
they are, tests that need fixed moves, and anything else you find that's deliberately Stockfish. Name each.

## Step 2: build it
- **Bots' moves from Maia** (the same Maia the town's bots and bosses use: its rating input), each bot a fixed rating for
  the match, spread over a range like a real lobby (your call from the data; say it: e.g. 800 to 2200, seeded by the bot's
  name so a bot is the same player every match). Maia's own move sampled from its policy (human mistakes included), not
  Stockfish's.
- **Cost:** a bots-only Crowd game asks for up to 50 bot picks a turn. Measure Maia's time for that on this machine and
  estimate a phone (batch the positions: every bot on a team sees the same position, so one inference per rating, or one
  policy per rating band, may serve many bots). A bot's pick must never hold up a turn: if Maia isn't loaded or is slow,
  that bot falls back to today's pick, and the fallback share is counted (say how often it happened in your runs).
- **Online:** wherever the online bots' picks come from today, make them Maia's too if that path can run it without new
  servers or paid services (never add one: that's Eric's call with a price). If it can't, say exactly why and what it
  would take, and leave online as it is.
- **Fair play and the cuts:** bots compete with players in the standings. Check with the existing sims (`reports/`,
  `npm run` scripts for the crowd sims) that bots' scores still spread sensibly (a 2200 bot usually beats an 800 one; not
  every bot dies in cut 1, not every bot reaches the final), and that `?weakbots=1` and the e2e helpers still work. Report
  the numbers before → after.
- Settings: every number in `settings.ts`.

Out of scope: the cut schedule (Eric's choosing), the scoreboard panel (another helper is on `MiniTower`, the chat tab and
`.under-board`: don't touch those files).

## Deliver
Push `claude/maia-bots`. PR title "Crowd and Squads bots play with Maia". Body in `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body-maia.md`. Report:
the map, the rating spread, the cost numbers and fallback share, online's answer, the sim before → after, changed checks
old → new, anything you need Eric to decide.
## Rules you must keep (every brief)
- Don't change any check that guards a rule in `docs/rules/eric.md`; list every changed check old → new in the PR body.
- Never base anything on, name or hint at a real person.
- **Working lean (CLAUDE.md, Nov 1 audit):**
  - You can't sit idle: ending your turn ends your run. **Don't wait with `Monitor`, and don't use `ps`/`pgrep`.** Wait in
    one foreground Bash call (timeout 600000): `timeout 590 bash -c 'until <done>; do sleep 30; done'`, repeated if
    needed. Never poll more often than every 30 s.
  - Locally, run only the tests you're writing or changing. Don't re-run whole area specs before pushing: CI does that.
  - Look at final stills only (about 10 images in the job). Big output goes to a file; read its tail or a grep.
  - The machine is shared with other helpers today: run local e2e under the shared lock (`flock /tmp/claude-0/e2e.lock …`).
- Ports: 8797, 9229, 9331, 8788, 8811 may be taken; use others (and `--inspector-port`). Free a port you started with
  `fuser -k PORT/tcp`; never kill PIDs. Don't list processes, inspect /proc or the environment, print environment
  variables, read auth or config files, or call session or agent tools. Never force-push, rebase or push empty commits.
  Don't merge.
- **Don't open the PR** (not with `gh`, not through GitHub's REST API, not any other way). Push the branch and write the
  PR's title and full body to the file named in Deliver; the director opens it and watches CI. The body: what changed,
  every player-visible change and new text, changed checks old → new, the lane; it ends with these two lines:

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
- Commits end with your own `Co-Authored-By` line for the model you are and
  `Claude-Session: https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim`.
