# Delta review of #574 (8afb5f0: the review fixes)

Scope: only `git show 8afb5f0`. Checks at 8afb5f0: `npm run typecheck` passed; `vitest run` accounts, xp, rewards: 3 files, 62 tests passed.

**One blocking finding (B1). It's in the hunk this commit edits, though the merge before it (f6f8df1) introduced it. M1 is closed; m4 is correct.**

## Blocking

### B1. The FAQ ships merge-conflict markers and a duplicate paragraph
- `packages/app/src/faq/content.ts:1118-1126` (`xpAndLevels`): `<<<<<<< HEAD`, `=======` and `>>>>>>> origin/main` are committed
  inside the template literal. The merge of main (f6f8df1) brought them in, and 8afb5f0 edited the HEAD side without removing them.
  `tsc` can't catch it because the markers are plain text inside a string, and no unit test caught it either.
- Scenario: every player who opens the FAQ's XP section sees the three marker lines and two "After each game the result screen's XP
  box…" paragraphs (the new one and main's older "with your win bonus when there is one").
- Fix: keep the HEAD side (the daily reward, level-up rewards and the edited paragraph) and delete lines 1118, 1124, 1125 and 1126.
  Optional guard: a unit test that no FAQ section's text contains `<<<<<<<`, `=======` or `>>>>>>>` on its own line. A repo-wide
  `grep -rn '^<<<<<<<\|^>>>>>>>' packages` in check.yml would be cheaper.

## M1: closed
- `api.ts:588-590`: `/api/xp/test` now checks `env.TEST_SWITCHES !== "1"` instead of `testSwitchesOn`, so an admin on production
  gets 403. The new test (`accounts.test.ts:317-319`) covers an admin on production (403) and a test server (200).
- Other routes that write XP: only `grantXp`'s own ops (time, win, daily: `xp.ts:198-212`, `rewards.ts:37`), which a real game
  earns, and `setTestXp` (`xp.ts:289`, called only from this route). The `?xpgame` route was already fixed: on production even an
  admin's `?xpgame` makes the game a test game (SOLO_TESTED → `test`), so it earns no XP. A guest merge (`ledger.ts:392`) is the
  earlier m3, unchanged. Nothing else on production can raise XP off a real game.
- The app: `App.tsx:401` calls `setTestXp(xp).catch(() => undefined)`, so on production the 403 is swallowed and only the profile
  reload after it is skipped. No player sends `?xp=` (the switch is gated client-side to test servers and admins). Admins lose
  `?xp=` on production by design, as the decision note says. The e2e server passes `--var TEST_SWITCHES:1`
  (`playwright.config.ts:40`), and staging sets it too (`wrangler.jsonc:91`), so `xp.spec`, `xp-rewards.spec` and `perf.spec`
  keep working.

## m4: correct, two nits
- `xp.ts:240-247`: `payLevels` is one `sql.batch` (all owed levels or none), and each op's id is `level:<n>:<ledger id>`. A throw
  leaves those levels owed, so they're paid at the next counted game and never twice. Nothing is lost: the time, win and daily ops
  went in before. The box keeps its XP and parts; only `rewards` is undefined, and the result row stores `xp_rewards` NULL, so
  only the display is off.
- n1 (minor): the catch swallows the error silently. Before this commit the callers' `.catch` at least logged it. Add a
  `console.error("payLevels", e)` (or similar) in the catch so a failing payout shows up in the logs.
- n2 (minor): `gameRewards` sits inside the same try, so a `payLevels` failure also hides the **daily reward's crate**, which was
  already paid in the first batch. Moving `gameRewards` out of the try, or into its own try, keeps that crate on the screen.

## Docs: accurate, with stale "and admins" mentions left over
- The decision note's lines (pause scope: Squads' placement coins and crates not paused; admins' XP jump test-only) and the FAQ's
  "earns no XP, daily reward or level rewards" match the code.
- Minor: these still say the `?xp=` switch works for test servers *and admins*:
  - `xp.ts:286` (the `setTestXp` doc: "the caller checks testSwitchesOn")
  - `account.ts:577` and `App.tsx:399` (comments)
  - `docs/decisions/2026-11-09-xp-storage.md:18`
  - `docs/decisions/2026-11-09-xp-phase2-levels.md:8` (lists "a test switch's jump (`?xp=`)" as a way levels become owed; now
    true only on test servers)
  - `docs/decisions/2026-11-09-admin-abilities.md:34` (counts `/api/xp/test` among the admin-allowed switches)

  Fix: say "test servers only" (one word each), or leave them until that area is next touched.

No other findings.
