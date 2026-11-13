# Fix round: PR #677 (the Hidden Boss online: phase change + four boards)

Effort xhigh, full lane. Branch `claude/recluse-online-phase2` (`git pull` first: the director merged main and moved the stills off
docs/). Read CLAUDE.md, then the review: `git fetch origin review/recluse-online-phase2 && git show FETCH_HEAD:review.md`.
The director's calls:
- **M1: fix as the review says.** Unvouch whenever the quick move plays HIS move (`recluse.ts:195`, `:286`); on a host change,
  leave or reconnect, re-point open device work to the current host and re-send the ask with a fresh time (as `resendHostWork`).
  A unit test for each.
- **M2: options 1 and 2.** `warmEngine` at phase 2's `begin()` (the fall + the phase change is time to boot), and a search's first group
  gets a longer timeout or one retry before the device path. A device-played BOT move never unvouches (a bot only plays for its own
  team). A device-played move of HIS unvouches phase 2's result only (the top 4's team win and XP), not the whole match's ranked flag
  and fair-play records, if that's a small, clear change; if it isn't, keep match-wide and say why in the PR body. Unit tests.
- **m1: fix** (broadcast the lean phase 2 message; the extras only in what a reconnect gets).
- **m2: fix** (`ply` in `phase2Move`, refused on a mismatch; the app keeps your pending move over incoming states until the server has
  it or refuses it). This is a protocol field of his phase 2 only.
- **m3: fix** (the fall's message says who takes the boards; `exitFor` uses it).
- **m4: fix** (no fair-play search when `tested`). The tested boss token in `writeResult` is pre-existing: leave it, list it.
- **m5: fix** (no bot search queued from the wrap-up).
- **m6: fix** (`cutAt` in `NetPhase2` so a reload during the hold knows the scene). The cutscene helper (`claude/recluse-cutscene`)
  reads `NetMatch.phase2.cutscene` today: keep that working.
- **Nits:** a bot prefers a mating move when one scores as mate; the player list nit: leave.
Prove it with the server/core/app unit tests, typecheck, and `e2e/hidden-boss-room.spec.ts` (both projects). Append a short "Review
round" section to `.pr-body.md` (start from `notes/briefs/recluse-online-phase2-pr-body.md` on the notes branch) and to the decision
note. Push work in progress at each real step; push `.done` and stop. Don't open PRs or wait on CI. No model names in commits. Never stop
silently.
