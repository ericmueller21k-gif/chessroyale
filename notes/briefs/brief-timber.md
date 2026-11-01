# Brief: Timber the beaver, a new boss, in the game for admins first. Phone and computer. Opus, high

Repo `/home/user/cr-timber`, branch `claude/boss-timber` (from origin/main 58c9dd3; checked out; run `npm ci`). Read
`CLAUDE.md` (all of it: the lanes, "Working lean", the boss lane), `docs/rules/eric.md`, `docs/areas/bosses.md` (above all
**"Adding a boss"**, its checklist, and how the newest bosses were wired: Folio, Moo, Blitz is next after you), the boss
framework (`BossRules` hooks: passive, the ultimate with `warnThenUnleash`, the meter, `afterBossMove`, …), the boss kit's
tests, and `docs/ideas/beaver-builder.md` (Eric's idea and the director's notes).

## Eric's approved design (Nov 1; the art approved Nov 1: "Yes, both")
- **Name: Timber.** A brown beaver standing upright, big buck teeth, an **orange hard hat** and vest, a yellow tool belt,
  planks on his back, no pencil. Sidekick: **a woodpecker foreman**.
- **Workshop strip** (above the board, his side): five pieces with their progress, **pawn 0/2, knight 0/4, bishop 0/4,
  rook 0/6, queen 0/12**; scraps land on them.
- **Passive: scraps.** **1 scrap every 15 s** (a real timer) **plus 2 scraps for each capture he makes**; each scrap goes,
  at random, toward one of the pieces. A finished piece is **dropped onto an empty square of his half** at the end of his
  turn; **at most one drop a turn**; a **per-battle cap set by the sim**; a finished slot starts over at 0. A pawn never on
  a back rank; legal positions only (never leaving a side in an impossible check).
- **Ultimate: Gnaw.** After the usual warning, he gnaws one of your pawns (at random), eating it; it becomes **8 scraps**.
  No pawn: nothing (say so on screen).
- Not in this build: the beaver tokens / beaver hat (stored data, a later PR) and boss shops.

## The art (done and approved; don't redraw)
On `origin/claude/boss-art` (`git fetch origin +refs/heads/claude/boss-art:refs/remotes/origin/claude/boss-art`):
`scripts/boss-art/out/boss-beaver/` (the drawing, every animation: idle, move, thinking, smug, rattled, hurt, check,
capture, cheer, bigCheer, victory, defeat, entrance, build, scrap, gnawWarn, gnaw; GIFs in `gifs/`; `summary.md`) and
`scripts/boss-art/out/sidekick-beaver/`; the report `scripts/boss-art/out/timber-nov1.md`. Copy them in the way the other
bosses' art came in (the area doc says how) with a line saying where they came from. Don't merge that branch.

## Build (follow "Adding a boss")
1. **The rules** in the boss framework: the workshop and scraps (a real-time meter is new: both Timber and Blitz, next,
   use one; build it as one shared block the next boss can reuse, with simulated time in the sim), the drops, Gnaw, his
   events and the views. Solo (Boss alone) and raids both.
2. **Calibrate by sim**, as the other bosses were: the scrap rate, the drop cap, his strength by level, so his win rate
   sits with the roster's (put the numbers in `reports/` like the others). Every number in settings.
3. **On screen**: the workshop strip (nothing shifts: a fixed place, phone and computer, including the new computer
   layout of #443 and the phone's 50 v 50/raid layouts), scraps landing, a drop (the planks off his back), the Gnaw
   (warning, then his gnaw across the board), his lines and moments like the other bosses', the sidekick.
4. **Admins first**: he's in the boss select and playable only for admins (the way test switches are gated) until Eric
   says go; one setting flips him live for everyone. Say in the PR exactly how.
5. Docs: his row in `docs/areas/bosses.md`, a decision note `docs/decisions/2026-11-01-timber.md`, the FAQ if bosses are
   listed there.

## Rules you must keep
- **Frame rate** (eric.md): the strip and the timers must not cost frames: measure a battle against Timber vs one against
  an existing boss the eric.md way (medians of four runs, in turn), phone and computer. Nothing allocated per frame.
- The boss kit's shared tests must pass for him (every boss is checked: king save on altered boards, smoke, etc.).
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
- Stopping a local server: `fuser -k PORT/tcp` (and the inspector port); never `pkill`/`kill`.

## Deliver
1. **Stills and a GIF first**, into `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/timber/`:
   a battle vs Timber on a phone and a computer with the workshop strip filling, a drop, and the Gnaw (`timber.gif`, under
   8 MB); the boss select with his tile (admin).
2. Typecheck, the touched vitest, the boss kit and his own e2e, phone and desktop.
3. Push; PR title "Timber the beaver: a new boss (admins first)"; body (what changed, the sim's numbers, every
   player-visible text, the FPS numbers, changed checks old → new, the lane) to `…/scratchpad/timber/pr-body.md`.
Report briefly: the pushed head, the sim's win rates, the FPS numbers, how to turn him on for everyone.
