# Handoff: Crowd and Squads bots play with Maia, round 2 (finish a stopped job). Opus, high

Worktree `/home/user/cr-maia-bots`, branch `claude/maia-bots`. A first helper was stopped mid-work (a usage rule, not a
problem with its work); the director committed and pushed all it had as one WIP commit (`git show --stat HEAD`). Its last
words: "Let me write the docs updates now (numbers filled after the sims)", so the sims may not have been run yet.

The original brief still holds in full: `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/brief-maia-bots.md`. **Plus Eric's later words (Nov 1), which win
where they differ:**
1. The bots are far too strong today: Eric used the engine's help on every move of a bots-only Crowd 50 v 50 and still
   finished about 20th. His rule: **a player making the engine's best moves should finish 1st or 2nd.**
2. The bots' ratings should look like a real lobby of whoever is online: **mostly about 800 to 1500**, some range above and
   below. (Matchmaking for 50 v 50 and Squads stays "whoever is available"; no skill matching.)
3. **Add an internal test** (a sim, no Eric needed): a 50 v 50 of the new bots at that spread plus one "player" who always
   plays the engine's best move; it should finish 1st or 2nd in nearly every run. Report its finishing places before
   (today's bots) and after.
4. **Speed decides** (Maia runs on our devices, no money): if Maia is noticeably slower for a turn on a phone, say so with
   numbers; then keep the Stockfish-style picks but tuned down to the same lobby strength, so test 3 passes either way.
   Build whichever you recommend and say why.
5. The town's kids at the park tables already use Maia (confirm in your map; no change there).

Check what the WIP has done against the brief and the five points; finish the rest; merge `origin/main` in (normal merge);
run only the tests you change; push as you go; write the PR body to `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body-maia.md`. Report as the brief
asks, with test 3's numbers first.
## Rules you must keep (every brief)
- Don't change any check that guards a rule in `docs/rules/eric.md`; list every changed check old → new in the PR body.
- Never base anything on, name or hint at a real person.
- **Push as you go:** commit and push your branch at each real step (WIP commits are fine), so a container restart or a
  stop loses minutes, not hours.
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
