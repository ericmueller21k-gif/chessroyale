# Fair play

Lane: `fairplay`. The reviewer's brief: `docs/fairplay-reviewer.md`. The numbers behind the thresholds:
`reports/fairplay.md`.

## How it works today

- **Signals come from the server's own judged data** (the judges' or the engine server's scores for each human pick),
  never numbers a browser makes up: strength, hard finds measured against the crowd, timing. The one exception is the
  look-away count (only the browser can see the page hidden), weak evidence that can add a few points, never ban.
- **Recording.** During a match the lobby records each human pick's signals (`noteFair`, the `fair` record). Turns a
  boss power touches (`powerTurn`) don't count.
- **The suspicion score** turns a player's evidence into a level; every threshold is in `FAIRPLAY`.
- **A case** is one player's file. Its status: **watch** (recorded only), **review** (a person or the automated
  reviewer decides; meanwhile their online results are held off ranking and `eligibleForRanked` says no), **banned**
  (no online play, solo stays open; an appeal a person decides; their sign-in identities are kept hashed so a new
  account with them is banned too, and a device they played from puts new accounts in review), **cleared** (held
  results count again), **closed** (a watch with nothing new for `FAIRPLAY.evidenceDays`).
- **Reports** never ban anyone: they raise a player's review priority and record their moves.
- **A ban needs the deep re-check:** a flagged player's counted moves searched again on the engine server (its own
  instance, `fairplay-1`, its own daily budget, from the Worker's schedule: cases in review at once, the rest
  off-peak). The judges' quick numbers can open a review, never a ban.
- **The review page** `/admin/fairplay` (admins only, `ADMIN_EMAILS`) and the reviewer's API `/api/admin/fairplay/*`
  (a bearer token, `FAIRPLAY_REVIEW_TOKEN`). Every decision goes in the case's log with who and why; the automated
  reviewer never decides appeals nor changes a ban.
- **Emails:** a ban notice and a clearing go to the player's sign-in address through Resend.

## Where the code is

| What | Where |
| --- | --- |
| Signals, the suspicion score, levels (pure) | `packages/core/src/fairplay.ts`; thresholds `FAIRPLAY` in settings.ts |
| Recording each human pick's signals | `packages/server/src/lobby.ts` (`noteFair`, the `fair` record only) |
| Reports, cases, bans, appeals, device markers, `eligibleForRanked` | `packages/server/src/fairplay.ts`, tables `fairplay-schema.ts`, emails `fairplay-mail.ts` |
| The deep re-check | `packages/server/src/fairplay-deep.ts`, `fairplay-engine.ts`; the cron in `wrangler.jsonc`, `scheduled()` in `index.ts` |
| Enforcing bans | small checks in `index.ts` (PLAY, lobbies) and `lobby-do.ts` (the lobby's hello) |
| The review page and API | `packages/server/src/admin.ts` |
| The report sheet, ban notice and appeal form, look-away counter | `packages/app/src/screens/PlayerProfile.tsx`, `components/FairPlay.tsx`, `lookaway.ts`, `net.ts` |
| Simulations | `packages/sim/scripts/fairplay-bank.ts` (the position bank in `packages/sim/data/`), `fairplay-sim.ts` → `reports/fairplay.md` |

## Settings

`FAIRPLAY` in settings.ts; Worker secrets/variables `ADMIN_EMAILS`, `FAIRPLAY_REVIEW_TOKEN`, `RESEND_API_KEY`,
`EMAIL_FROM`.

## Tests

- Unit: `packages/core/test/fairplay.test.ts`, `packages/server/test/fairplay.test.ts`, `fairplay-lobby.test.ts`,
  `fairplay-deep.test.ts`, `fairplay-admin.test.ts`.
- e2e: `e2e/fairplay.spec.ts` (reporting, a banned account; the review token is set in `playwright.config.ts`).

## Rules for this area

- Measure false bans before switching anything on: simulate every threshold change (catch rates per cheater type
  within 1, 2 and 5 matches; false flags and bans per 1,000 honest players at every strength).
- Borderline cases go to review (a person), not a ban. A false ban of an honest player is the worst outcome.
- No invasive fingerprinting; admin emails live in a Worker variable or secret, never in the repo.
