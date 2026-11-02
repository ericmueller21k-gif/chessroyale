# Handoff: Timber on a computer stands over the board (fix before merge). Haiku

Worktree `/home/user/cr-timber`, branch `claude/boss-timber`, PR #450 open (the director watches CI; don't open or edit it).
Timber is a new boss (admins first). Read `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/timber/pr-body.md` for what he is.

**The bug:** on a computer his figure stands over the board's top-left squares (a8, b8, a7, b7), covering pieces:
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/timber/still-computer-gnaw-teeth.png` (1440 × 900). The rule (docs/areas/bosses.md): no boss's drawing goes
over or under the board; every other boss stands beside the board in the computer layout (#443: the bar at the top,
the side menu on the left). The helper's last change (`timber-figure.ts` / his CSS) lowered his figure "by the board's
corner" so his head wouldn't overlap the boss bar; it wasn't re-shot.

**Fix:** place his figure where the other bosses' figures stand on a computer (compare Folio, `components/Folio.tsx`,
and Babur at 1280 × 800, 1440 × 900, 1920 × 1080), whole, never over the board, the bar or the side menu, and never
changing the board's size or place (the board's box must equal main's for a Boss alone battle at those sizes). If his
figure's frame (made bigger for his entrance drop) is the cause, keep the frame but position him by his feet as the
others are. Check the phone too (his figure in the phone bar must stay as it is).

Add (or extend `e2e/timber.spec.ts`) a check: at 1280 × 800 and 1440 × 900 his figure's box doesn't intersect the
board's box and the board's box is the same as Folio's at that size. Run only `e2e/timber.spec.ts` locally (phone and
desktop). Stills: computer 1440 × 900 and 1280 × 800 at rest and during the Gnaw; phone at rest (4 images).

Push to `claude/boss-timber` (normal commit). Append to `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/timber/pr-body.md` a short "Round 2" section: what
moved, the changed or added checks old → new. Report: the cause, the fix, the stills' paths.
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
