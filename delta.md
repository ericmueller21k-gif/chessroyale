# Delta review: PR #610's fix round

The fixes are `2970b78..2d689d8` on `claude/fable-b2`, explained in `.review-fixes.md` at `2d689d8`. The branch head is `93d4896`:
`2d689d8` with the two note files dropped, and no merge of `main` yet. Line numbers below are at that head. Brief:
`notes/briefs/delta-review-fable-b2.md`. Read-only on the code. Nov 10, 2026.

**Verdict: no blocker, no major.** Every fix does what `.review-fixes.md` says, and M1 is closed: there is no route left where the
reviewer's token bans. Three new minors came out of the fixes (m4-a, m1-a, m6-a). One more (m4-b) only matters once bans go back
to automatic. There are also four nits.

**What I ran:**
- the server unit suite at the head: 70 files, 1,043 tests passed;
- `tsc -p packages/server --noEmit`: clean;
- the app's new `engine-server-refusal.test.ts`: passes;
- `delta-b2.test.ts` (on this branch; copy it into `packages/server/test/`, then
  `npx vitest run packages/server/test/delta-b2.test.ts`): 2 tests, both passing. Each one asserts a finding below.

---

## Minor

### m4-a. A banned player's matches stop at 8 checked moves, and nothing can finish them, so an appeal is decided on part of the evidence
- **Where.**
  - `packages/server/src/fairplay-deep.ts:153`: `cap` is `Infinity` only for `"review"`, so a banned case is capped too.
  - `fairplay-deep.ts:163-166, 186`: a capped match leaves the queue (`deep_done = 0`, `deep_queued = 0`).
  - `fairplay.ts:200` (`appeal`) queues nothing.
  - `admin.ts:354-358`: the page's "Deep re-check" runs `deepCheckRun({ all, userId })`, which only reads rows with `deep_queued = 1`.
- **Failing case (ran it).** `delta-b2.test.ts`, "m4-a":
  1. A person bans a player who has a 12-move match, before any deep re-check has run.
  2. The scheduled run checks 8 of the 12 moves; the match leaves the queue undone.
  3. The player appeals.
  4. The admin presses "Deep re-check": `{ searches: 0, matches: 0 }`.

  The case page shows "deep matches x/8" against `found …/12` for good. The only way to get the other 4 checked is to move the case
  back to review, which lifts the ban (it deletes the identity rows, `fairplay.ts:115-117`).
- **Why it matters.** Every ban is a person's now, and an appeal is the last check on one. Before this round, `setCase(banned)` queued
  a full check. The moves left unchecked are the ones that could clear the player.
- **Answer to the helper's question.** A capped check is fine for watch cases. It isn't fine for appeals. A person can also ban from
  review before the full check finishes (500 searches a day, about 4.5 per move), and that ban gets capped from then on too.
- **Fix (either):**
  - `cap = Infinity` for `"banned"` as well as `"review"`. Bans are rare, and they're queued off-peak, behind watch cases.
  - Or have the admin's "Deep re-check" (and `appeal`) run `queueDeep` and pass an uncapped flag.

### m1-a. Each retry of a result whose fair-play row already went in writes detection's note to the case log again
- **Where.**
  - `fairplay.ts:444-447`: on `!added`, `actOn` runs again.
  - Under a case already in review (or on watch), `raiseCase` (`:302-306`) logs a `note` and sets `updated_at = now`.
  - `now` here is `p.at`, the match's queue time.
  - `writeResult` calls `recordFairPlay` first on every retry (`lobby-do.ts:721`).
- **Failing case (ran it).** `delta-b2.test.ts`, "m1-a":
  1. The first try opens a review.
  2. Five retries follow, as `writeResult` makes them when a later step fails.
  3. Result: five identical `note` lines by `detection`, same time, same reason. Before the fix there were none.
  4. The case's `updated_at` is set back from a later time to the match's time.
- **How many.**
  - XP, the Welcome Crate or a boss token keeps failing: one line a minute for `MATCH_SAVE.strictMinutes` (about 30).
  - The result row itself keeps failing (it's never lenient): one a minute until the lobby closes, up to `MATCH_SAVE.retryHours` past
    its closing time. That is over a thousand lines.

  Only flagged players are affected. Nothing is double-counted: no second case, no email (`actOn` mails only under `"ban"`, and skips a
  case already banned), and the level counts the match once (checked). It is noise in the log that a person and the automated
  reviewer read, and it looks like repeated detections.
- **Fix.**
  - On `!added`, run `actOn` only when the case (`c`, read at the start of this try) is below what the verdict asks for. The retry
    then finishes what the first try missed and logs nothing when it missed nothing.
  - In `raiseCase`, use `updated_at = MAX(updated_at, ?)`.

### m6-a. The Welcome Crate's solo floor is now 60 server seconds a game; the 10 moves are the device's word
- **Where.**
  - `welcome.ts:51`: `play_ms >= 60 s AND moves >= XP.minMoves`.
  - `moves` is the posted number (`api.ts:632`); only `play_ms` is the server's.
  - One open solo game per account (`xp.ts:50`), so games can't overlap.
- **What.** A scripted client earns an account's crate in 5 × 60 s, about 5 minutes. With finding 10's 3-minute floor it took
  15 minutes. Quick boss losses and first-stage knockouts now count, which is what the first review's m6 asked for.
- **Weigh it.** The crate is once per account, and sign-in is the real limit, so this is a call, not a bug. The director decides
  between "a short real game counts" and "farming takes 15 minutes". The decision note records the 60 s, but not this trade-off.

### m4-b (only once bans are automatic again). A "ban" level can come from capped matches without a full check
- **Where.**
  - `fairplay-deep.ts:153`: outside review, each match is checked up to `banMatchChecked` (8) moves, the first 8 counted.
  - `playerLevel`'s two-match bar needs `banDeepChecked` 16, so two capped matches meet it exactly.
  - `fairplay.ts:512`: under `enforcement: "ban"`, `actOn` would ban on that verdict straight from a watch case.
- **What.**
  - Today a "ban" verdict only opens a review (`"review"`), and `setCase(review)` re-queues the capped matches for a full check.
  - Once `"ban"` is back, a ban could rest on the first 8 counted moves of two matches, the early ones. Before this round it rested on
    every counted move of each match.
- **Fix.** When enforcement goes back to `"ban"`, have a "ban" verdict from capped matches open a review first, which runs the full
  check. Or lift the cap. Add one line about it to ROADMAP's fair-play entry, next to "bans stay off until…".

---

## Nits

- **m4.** The cap is `banMatchChecked` (8), but the one-match ban bar needs `banOneDeepChecked` (12), so that bar can't be met outside
  review. It's harmless today:
  - `evidencePer` is 1, so a match at `banOneEvidence` (11) already scores 11 or more, above `reviewOne` (8);
  - that match opens a review, which lifts the cap.

  The comment "as far as a ban could need" holds only because of that coupling. Either use
  `max(banMatchChecked, banOneDeepChecked)` or say so in the settings comment.
- **m2.** While a background write runs, the alarm armed at "a second on" keeps firing every second. Each wake restores the runner,
  stores the record and re-arms. Before this round the alarm waited on the write. That means a few extra wakes per slow batch: cost
  only, nothing breaks.
- **m1.** `AND NOT (lobby = ? AND played_at >= ?)` (`fairplay.ts:415`) also leaves out a row whose `lobby` is NULL and that was played
  after `since`, because `NOT (NULL AND TRUE)` is NULL. Today only lobbies call `recordFairPlay`, always with a code, so no row is
  affected. `lobby IS ?` would be exact.
- **m5 (not new).** When solo's share is spent, `/api/engine/score` answers 503. The app treats that as transient and asks every
  round until the account's 200 calls turn into 429. Answering 429 for "solo's share spent" would stop it at the first refusal.

---

## Checked, fine

**M1: the reviewer's token never bans.**
- The token only works on `/api/admin/fairplay/*` (`admin.ts:305`, `api && tokenOk`).
- Its only write is `decide`, which refuses `status === "banned"` before anything else (`fairplay.ts:251`).
- The page's POSTs, including appeals and "Deep re-check", need an admin session.
- `decideAppeal` is only on the page.
- Evasion bans (`banCheck`) need an identity row owned by a banned account, or one with no case. The token can create neither:
  - it can't ban;
  - an account it puts in review that is then deleted keeps its case as `review`, so a new account with that identity goes to review,
    not to a ban.
- Unit, e2e and `docs/fairplay-reviewer.md` match.

**m1: a retried fair-play write.**
- On `!added`, the level is `levelNow`, which reads the stored row once and doesn't add it again: no double count.
- A person's decision since the first try counts. A clearing moves `decided_at` past the match, so the retry does nothing.
- `queueDeep` is an idempotent UPDATE.
- Under `"review"`, `actOn` sends no email. Under `"ban"`, it skips a case that's already banned.
- `raiseCase` never opens a second case or lowers one.
- The `added` path leaves this lobby's own rows out of the history, so a first try is weighed as before. The PR's "m1" test shows the
  same score and verdict as the control.

**m2: results written in the background.**
- `persist` arms the alarm before it starts the write. While `saveQueue` isn't empty (an item leaves it only once written), every event
  and every alarm re-arms it at `max(now + 1 s, saveRetryAt)`. So no result waits past its retry, and an alarm that comes during a
  write shares it (`this.writing`).
- One write at a time per instance; `close` also goes through `writeResults`.
- A lobby can't close mid-write: `closeIfDue` holds while the queue isn't empty. After `retryHours`, `close` awaits the running write
  before deleting anything, and `writeSome` doesn't store a record that has been closed (`this.record === rec`).
- An eviction or deploy mid-write loses nothing: the queue was stored first, the alarm is already armed, and every write is keyed.
- `writeResults` never rejects, so `waitUntil` sees no unhandled error.
- `core.save()` returns the same record object, so `take()` and the background store act on the live queue.

**m3: lenient by time.**
- `failedAt` is set once, at the first failure, and stored with the record.
- A stored entry without it (or with the dropped `tries`, which never reached `main`) is strict until its first failure, then lenient
  30 minutes later. It drains.
- Lenient only swallows the soft parts' errors and still tries them. The result row stays strict, held at most `retryHours` past
  closing, then `resultsLost`, as before. Nothing is held forever.

**m4: the whole-position budget.**
- `takeBudget(n)` is one conditional `UPDATE … WHERE searches + n <= cap RETURNING`: all or nothing, and it never passes the cap
  (D1 runs each statement atomically, so the 1 v 1 check can't race it past the cap).
- Short of budget: no search, nothing charged, the match stays queued and the run stops.
- The server stops answering at group `i`: the `groups - i - 1` searches never made go back (same `now`, so the same day). `made`
  matches what was charged.
- Earlier positions' results are saved ("waiting").
- `containerScore` catches its errors, so a search can't throw past the refund.
- A capped match costs nothing when re-queued: `checked` is already at the cap, so it's capped again with no search.
- `setCase(review)` re-queues capped matches, and review cases are uncapped. The PR's two new tests cover both.

**m5: the app's refusals.**
- `warmEngineServer` is called once per solo game (`solo.ts:400`, `createRunner`, from `start` and `fill`). It clears the flag and
  lets the ping set it.
- A 401, 429 or 404 on the ping or on a score call ends the asking for that game; the next game asks again.
- Online games don't use this path.
- `soloCap(cap)` = min(1000, ⌊cap / 3⌋).

**m6, m7.** The meter's rule now matches XP's minimum moves. The m7 line is in the decision note.
