# Quick review (boss lane): Chub & Chirp Turf, branch `claude/hopper-turf`. Opus, high, read-only, ~40 min

Read `notes/briefs/rules-common.md` first. Review `git diff origin/main...origin/claude/hopper-turf` against `notes/briefs/hopper-turf-build.md`.
Look hardest at the rules: Long legs (never a capture, en passant or promotion by a 2-3 step; the squares passed empty), Double hop (never a
first move that checks; the passed turn), Short fuse (your clock cut only while he holds it; the server's clock agrees), the hop-around's
picks (never a square with a piece), squares flipping on every kind of move (captures, castling, promotions, his hops and bounces); solo and
online the same (the server decides; nothing a client sends claims a square or a hold); Battle Tower fully off; the protocol's new fields
optional (an older client still plays). Then: the prints and logos never over pieces, last move, check or dots; the count's text at 320 px.
Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on branch `claude/hopper-turf-review`
from the PR head, push, `.done`. Don't fix code, open PRs or comment on GitHub. No re-review loop.
