# Fix main: zebra-home.spec:273 music carry missing (Nov 24). Opus high, targeted lane, fix forward

Main f0e89d7 (#920: quests 12 h gap + boss crates "Show unowned") is RED. `[desktop] e2e/zebra-home.spec.ts:273` "Rolling Dough:
Challenge plays the beat ... and the battle against Don Dough" failed BOTH tries at line 369: the music log was
`["music:splash:zebra"]`, expected `["music:splash:zebra", "music:carry:zebra"]` (his splash's music is no longer carried into the battle).
Run 45447937791, shard 4 (job 138637043793; the retry's trace is in the shard's `e2e-report-shard-4` artifact). Main's previous run,
8423926 (#919), was green, so #920 is the suspect (`packages/app/src/quests.ts` `autoOpenWaits`/`noteQuestsClosed`/`manual`,
`components/QuestsOverlay.tsx` `QuestsLayer`, `screens/Crates.tsx`, `boss-crate-rows.ts`), but prove it: run the test on 8423926 and on
f0e89d7 locally (desktop project), under the shared e2e lock (`flock /tmp/claude-0/e2e.lock`).

Start: `git fetch origin main && git checkout -B claude/fix-zebra-music-carry origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/town-square.md` (his rooms, the music carry), the music carry code (`music:carry`).

Find the cause (e.g. the quests layer now mounting/unmounting or re-rendering home in a way that ends or restarts the music before the
carry; or an unrelated cause if 8423926 fails too), fix it in the app, with the failing spec as proof (passes 3 times in a row on desktop,
and on phone once). If the cause is in #920's change, keep #920's behavior (12 h gap, Show unowned). Decision note of about five lines.
PR body in `.pr-body.md` (cause, fix, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By, no model names). Never images under docs/.
