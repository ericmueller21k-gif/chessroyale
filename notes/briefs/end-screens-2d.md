# End screens 2d: Big Boy's picture over the XP bar (Nov 25). Opus medium, targeted. Branch `claude/end-screens-2` (PR #944)

PR ericmueller21k-gif/chessroyale#944 CI (run 45584764088, head ffe63ff3): `e2e/boss-review.spec.ts:44` fails on phone AND desktop:
"bigboy: the XP bar under the picture": `.es-track-xp` top 345.30 < `.boss-char-sprite` bottom 346.80 (- 1 allowed), desktop 438.64 < 440.14.
Ginger and Grex pass. Round 2b sized the boss's box from his head to his feet (`end-screen.css`: `.boss-char.place-results` height
`(--bc-fy - --rd-top) * --bc-scale`, `--rd-top` from `drawnBox(...).top` in `components/ResultDuo.tsx`) at 2.25x. Find why Big Boy's sprite
element ends 1.5 px under his box (his frame, his idle's drawn box, a stance offset, rounding?) and fix the CAUSE so no boss's picture
crosses the bar, without editing the check. Check every boss with art, not just these three (a quick loop over the bosses' kits: box
bottom vs sprite bottom at 2.25), and say what you found in `.pr-body.md` (a short "Round 2d" section, checks changed: none).
Also on the branch: the director's 49da03d9 reverted round 2c's phone bubble (his words over his head on every screen; boss-result.spec
:105/:132 failed with it beside his head). Run boss-review.spec (phone + desktop) and boss-result.spec (all) before pushing.
`git fetch origin claude/end-screens-2 && git checkout -B claude/end-screens-2 origin/claude/end-screens-2`, `git rm .done`, push, fix,
push, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Budget about 45 minutes.
