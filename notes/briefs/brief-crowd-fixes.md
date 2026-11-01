# Brief: the Crowd 50 v 50 on a phone: the scoreboard flashing, "Black" out of line, streaks from move 1?, bots chatting in a bots-only game. Opus, high

Worktree `/home/user/cr-crowd-fixes`, branch `claude/crowd-panel-fixes` (from main 58c9dd3; #446, the chat tab, is in).
Eric played a Crowd 50 v 50 on his iPhone (Safari, about 390 × 750), alone with bots. His screenshot:
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1c/eric-crowd-nov1.png` (look at it once). His words, Nov 1:

1. **The scoreboard flashes.** "the container with the score, it still seems like it's flashing, which is a problem we've had
   previously. So the outside of the container seems like it's reloading on every new instance of something that's
   happening… there should never… the container should be static, and anything inside of it should be loading or fading in
   and out and moving, but not flashing… it seemed like that scoreboard was flashing or being rebuilt in a weird way… we'll
   also get some extra frames out of it if we see why it's flashing and rebuilding."
   - Find the **root cause** ("flake" or "Safari" is not one). Likely suspects, check each: the panel (`.under-board`,
     MiniTower, the Black · White · All · Chat header) re-mounting (a changing `key`, a component defined inside a render, a
     conditional wrapper that swaps element types between phases: picking / waiting / reveal / cut), a CSS animation or
     transition on the box itself replaying (an `animation` on mount, a class toggled per phase), the box's size or
     background changing per phase, images or fonts reloading. Prove it: count mounts (a MutationObserver or a mount counter
     in a test page) and record frames across several turns and a cut on a 390 × 750 phone in WebKit (`playwright`'s
     webkit if it's installed here; else Chromium, and say so). Fix it so **the box and its header never re-mount or
     repaint as a whole** through a match (rows may move and fade inside it). Add an e2e check that guards it (the panel
     element is the same node, and its box doesn't change, across picking → reveal → the next turn → a cut).
2. **"Black" out of line:** the header's first tab ("Black") sits further right than the "POS" column under it. Line its
   text up with the text below (the same left edge as "POS"), keeping the 24 px tap targets.
3. **Streaks from move 1?** "I thought the hot streak moves didn't start until after a few moves in… it seems they were
   starting to count right away." The rule (`streakCounts`, `packages/core/src/scoring.ts`; `CROWD_SCORING.streakFromMove`
   6): on the usual start streaks count from a player's 6th picked move; on Random opening and Freestyle from the first. In
   his screenshot the leader shows 🔥12 at Move 12. Find out whether that's right (which start did a bots-only game use? is
   "Move 12" counting the same thing as the streak?) or a bug, and fix it if it's a bug. If it's right, say why in the
   report in one or two plain sentences I can pass on.
4. **Chat in a bots-only game:** "there's no chat here. I assume that's because it's just bots only… I think we should have
   it in the bot-only game and have the bots just chatting still." Show the Chat tab in a bots-only (solo) Crowd game too,
   and have bots send quick-chat picks now and then: only from the picks players already have (`ChatPicks`/`QuickChat`), at
   a calm pace (your call; say it), to the team or All as players can, never during the cut screen. Nothing changes for
   online games.

Out of scope: the cut schedule (Eric is choosing a new one), anything on a computer's layout (check it doesn't change).

## Deliver
- Push `claude/crowd-panel-fixes`. PR title "The Crowd on a phone: a steady scoreboard, "Black" in line, bots chat"
  (adjust if the streak turns out to be a fix too). Body in `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body.md`.
- Report (short): the flashing's root cause in plain words, how you proved it's gone (mount count, frames), the streak
  answer, the bots' chat pace, every player-visible change and new text, changed checks old → new. Stills (phone 390 × 750,
  dark): the reveal, the chat tab with bot messages; one before/after frame strip of the flash if you can.
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
