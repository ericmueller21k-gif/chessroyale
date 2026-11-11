# Review: PR #629, fair play near-best + one-match pool + sustained strength (full lane, one pass, read-only)

**Verdict: merge after the one fix round for M1.** The never-ban guarantee holds. The verdict paths do what Eric chose. No stored-data
changes. Nothing reaches a player. The 7 touched test files pass locally (81 tests).

## Findings
- **M1, the evidence model: a near-best pick ranked 4th or lower counts as engine evidence whatever the crowd did.** `packages/core/src/fairplay.ts:175-176`:
  outcome 1 now covers "near best", but the honest chance for outcome 1 is still `p3 - p1`, and that comes from the crowd's share of the
  top 3 only, which leaves out the pick. Measured: a 2400 player's rank-4 pick 0.8 off, with 30 of 40 in the crowd on that same move,
  gives evidence **+0.27** (was −3.37). The crowd on the pick changes nothing (+0.27 with 5 of 40). That is a swing of about 3.6 nats per
  such pick toward a pool/review, and it lands mostly on honest players in quiet or winning positions. It probably accounts for part of the honest
  review rise in the report (Maia 2200 likeliest 99.8 → 150.6 per 1,000). **Fix:** when `rank > 3 && nearBest`, use
  `share([...top.slice(0, 3), m.move])` for p3.
- **m1, sustained strength is a "ban" level that rests on the judges' numbers alone** (`fairplay.ts:409`, `server/src/fairplay.ts:594`).
  Under "pool" that's fine. If `enforcement` is ever "ban", it auto-bans with no deep re-check, which contradicts `playerLevel`'s own
  "confirmed by the deep re-check" (and the Nov 10 finding 6). **Fix:** tag the verdict (`path: "strength"`) and have `actOn` raise a
  review for it when the mode is "ban".
- **m2, the brief's targets aren't met (calibration, not code; the report is honest about it).** In the sim, Eddie-like players pool 0.1% / 19% / 80% within
  1 / 2 / 5 matches (the brief: 1-2). The bars weren't revisited ("Bars unchanged"; brief item 2 asked for it). The 2nd/3rd-choice cheater Eric
  named is caught 0% by sustained strength. The director should tell Eric this plainly. Also, live Eddie pooling is shown only on a
  synthetic 15/20 match. After the first scheduled run, check his case. If a person or the reviewer has decided his case since his matches
  (`decided_at`), those matches don't count and he won't pool.
- **m3, `recountDeep` runs for ever** (`fairplay-deep.ts:233-237`). Every 15 minutes it scans and `json_extract`s every open case's
  matches, and pool cases never close, so that set only grows. It is idempotent and stays off closed, cleared (released) and banned cases,
  as it should. **Fix:** add `AND m.played_at < <Nov 12 cutoff>` (uses `fairplay_matches_user`), and remove it after a week of returning 0.
- **m4, sustained strength is unmeasured outside Crowd.** The sim plays Crowd 50 v 50 and its bot-filled variant only. 1 v 1 (no crowd,
  long games, winning positions compressing losses) isn't measured. The honest margin is thin: the report's max is 2,940 against the
  3,000 bar, while the decision note says "honest max 2,882". **Fix:** correct the note, and add one 1 v 1 row to the sim or say it's unmeasured.
- **m5, tests.** The catch-up test proves "no case → untouched" but not cleared, closed or banned: add one cleared case.
  `review-engine-pool.test.ts:146` (m1): both branches now end in the pool, so "a review case's matches are deep-checked in full" is
  no longer tested with a review case. Give the review branch a non-bar match.

## Checked, fine
- Never a ban: `actOn`'s ban branch is unreachable under "pool". The reviewer still can't ban or move pool cases (review-b2's M1 test).
- One match pooling forged one-lobby judges (#618 M3 replaced): this is Eric's call. Release undoes it, and the pool tab's `why` shows "one match".
  The PR body must list review-b2 M1 and review-engine-pool M3 as changed checks, old → new. Neither guards a rule in `docs/rules/eric.md`.
- `recountDeep`: rank and loss stored, no searches. It always writes `deepExact`, so it doesn't run twice. Unreadable moves are marked done.
  It runs before the re-check, inside its own `catch`.
- Sustained-strength inputs: the same records as the bars. Unvouched matches record nothing (lobby-do.ts:738). Power and token turns are skipped.
  Squads records no fair play. The window is 30 days and the 10 newest matches, since the last decision. A released player needs 5 new matches.
- Data: no schema or migration. The summary JSON gains an optional `deepExact`, and its readers handle it missing. `deepLoss` and `deepNear` appear only on the
  admin case page and in the reviewer's API, and `deepExact` only in the gated test-accounts report.
