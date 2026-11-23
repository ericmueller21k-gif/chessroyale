# Tower specs: phone only, except the computer-layout tests (the Nov 23 sweep's N4). Haiku, medium

Why: `e2e/battle-tower.spec.ts` is the slowest spec (phone 620 s, desktop 576 s); its desktop run repeats the phone's flows. Most specs'
desktop run is 15-35% of phone. `@phone-only` already exists (e.g. `e2e/alfil.spec.ts:64`: `{ tag: "@phone-only" }`).
Branch: `git fetch origin main && git checkout -B claude/tower-phone-only origin/main`. Light lane.

Steps:
1. Read `e2e/battle-tower.spec.ts` and `e2e/tower-party.spec.ts`, and how `@phone-only` is used (grep `phone-only` in `e2e/` and
   `playwright.config.ts`) so you add it the same way (a test with other tags gets `tag: ["@x", "@phone-only"]`).
2. Tag every test in those two files `@phone-only`, EXCEPT a test that checks the computer layout. A test checks the computer
   layout when it reads `info.project.name`/`isMobile`/viewport width to assert something different on a computer, or its title or
   body is about the computer layout: the floor title over the right column (PR #872) and the accordion bar (PR #871). Leave those
   untagged. When unsure, leave it untagged and list it.
3. Run `npx playwright test e2e/battle-tower.spec.ts e2e/tower-party.spec.ts --list` for both projects and count the tests per
   project, old and new.
4. A five-line decision note `docs/decisions/2026-11-23-tower-phone-only.md` (the sweep's N4; what's still on desktop and why).
   `.pr-body.md`: what changed, the list of tests kept on desktop, "Changed checks (old → new): N tests no longer run on desktop,
   each still runs on phone; none removed", the counts. `.done`, push, stop. Don't open a PR.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
