# Moo cinematic (#776): the review's fixes, into the PR. Opus, high (timing solo/server, overlays)

Branch `claude/moo-cinematic` (PR #776, head 87aff8d): `git fetch origin claude/moo-cinematic && git checkout -B claude/moo-cinematic
origin/claude/moo-cinematic`, push to it. About 1 h. Read CLAUDE.md and the review: `git show origin/review/moo-cinematic:review.md`.

The director's calls, each with a focused test where it's logic (simple beats flashy: the least code):
1+4. **Nothing hidden is tappable:** while the field is up, `.mo-area` takes taps (no blind premoves, no hidden menu taps); and if the
   match menu is already open, it shows above the cinematic (mirror the Hidden Boss's `body.cs-on .mm-scrim` rule with a body class).
2. **Reload / late join mid-cinematic:** the cheap way. If the Full Moon moment is first seen on a resent round (reconnect) or with
   under ~1 s of his think left, skip the cinematic and treat the swap as already past (he's drawn powered at once). No protocol change.
3. **Queen slain on the same move:** the cinematic starts after QUEEN SLAIN! (`bossBannerMs() + 500`), and the think is the sum, the
   same in solo and on the server; a test that both agree.
5. **Wide windows:** clamp his stand point inside the area and cap his scale; the close-up fits instead of covering past ~4:3.
6. **Tail margin:** pad `fullMoonMs` by 200 ms beyond the cinematic's total (setting), solo and server.
7. **Measure live:** read the board's and his spot's boxes each render (or at the hop back), not once at mount.
Plus one computer still/check of the cinematic (frames:moo on a computer, or one e2e assertion on desktop) since the spec skips it.

Run: typecheck; moo unit tests and the boss kit; `e2e/moo.spec.ts` phone. Rewrite `.pr-body.md` (add "Review fixes", changed checks
old → new), push it with `.done`, end. No PRs, no CI waits.
