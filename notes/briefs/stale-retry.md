# #942 follow-up: a dropped file's retry must work in older Chromium too (Nov 25). Opus high, targeted. Same branch `claude/fix-xp-start`

PR ericmueller21k-gif/chessroyale#942 (branch `claude/fix-xp-start`, head f09c6110; read its body and two comments). It stops `stale.ts` from
reloading the page (and sending players home) when a file drops with no deploy; the import fails and its caller retries. CI run
45573284583 shard 13: its own new test `xp.spec.ts:476` fails both tries: the page shows Boss Battle + "Couldn't load the game. Check your
connection and try again." (no reload, but the retry of the refused `openings-*.js` also failed). Locally (Playwright Chromium 1243) it passes;
CI's is older (1194). Likely: older Chromium caches a failed dynamic import() in its module map, so a retry of the same URL fails without a
fetch. Verify that (run the test with CI's Chromium build, or prove the module-map caching), then fix so a dropped file recovers in BOTH:
e.g. retry the failed chunk with a fresh URL (cache-busting query on the failed module's URL from Vite's preloadError payload), or, when a
second try fails on the same build, reload while KEEPING the screen (setPlace/takePlace already restore places: make Boss Battle one, so the
reload lands back on it, never home). Simplest robust option wins (Eric: least code, fewest ways to break). The test must pass on CI's
Chromium; keep the no-deploy and real-deploy behaviors tested. `git fetch origin claude/fix-xp-start && git checkout -B claude/fix-xp-start
origin/claude/fix-xp-start`. Push there, update `.pr-body.md` (a section "Older Chromium"), `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high.
