# Delta re-review of #683: the review round and the merge of main

Independent, read-only. Reviewed `origin/claude/recluse-server-only` at `964c8811` (the director's merge of main) against `main` at
`efb3da70`, following `notes/briefs/review-683-delta.md`. The fix round is `f000aa44..30bb86a6`; its claims are in the review
round's PR body (`c6abf5aa:.pr-body.md`, "Review round"). Line numbers are at `964c8811`.

**Ran:**
- `npm run typecheck`: clean.
- `npx vitest run packages/server packages/core packages/app`: 293 files, 4,038 tests, all passed.
- One throwaway timing probe of `withMates` (not committed).

**Verdict: no blockers, no majors.** Every major and minor of the first review is fixed as the PR body says, and the merge of main
(the child form online, the cutscene) left this PR's code untouched and main's working. I found **3 minors and 2 nits**, all small:
- m1: his searches wait on a D1 write they never use;
- m2: the daily digest misses about ten hours of each day's no-results;
- m3: the stated reason for "bots device-first" doesn't hold; a call to write down, not a code bug.

## The first review's findings: fixed as claimed

### M1: his searches have the engine server's queue to themselves in a fight. Fixed

- **Fair play's numbers go to fair play's instance.** lobby-do.ts:323 sends `fair` searches to `"fairplay-1"`, with up to 60 s.
  The engine-server test checks the instance.
- **A bot's move goes to the host's device first** (recluse.ts:372, `toDevice` at 392). The engine server is asked only with no
  host, or no answer in `askMs` (6 s; recluse.ts:275). It's a plain search: no `boss` flag, on the match's budget.
- **His moves go only through `searchHis`** (recluse.ts:373-375 and 382-389). Within a fight, `engine-1` now gets only his
  searches, plus a bot's when no device answered.
- **A try is bounded.** `end` is set before the D1 count (engine.ts:214), and each group gets only what's left (engine.ts:224-227).
  The engine-server test covers a hang in the first group and in a later one.
- **No new try while one could still be running:**
  - `SERVER_LOST_MS` is `searchMs` + 5 s (recluse.ts:297).
  - `step` and `arm` use `retryAt`, else `at + SERVER_LOST_MS` (recluse.ts:268 and 319).
  - An earlier try's empty answer adds no try (`id === w.ask`, recluse.ts:576), and any try's answer plays (recluse.ts:570).
  - The caveat is nit 1.
- **Each of his searches is logged with its time** (lobby-do.ts:325).
- **A risk that stays (no finding):** other lobbies' judges still share `engine-1`, as the PR says. Also, when four of his positions
  are asked together, their groups take turns in the one queue, so all four tend to finish together. On the PR's own estimate,
  that's about 4 × 5 × 0.15 s ≈ 3 s, right at `pauseMs`. The logs will tell; nothing to change before measuring.

### M2: never refused for the day's budget, counted once. Fixed

- **Never refused:** `takeBudget` for `"recluse"` bumps his own row and returns true, even when counting fails (engine.ts:72-81).
  `servePhase2` passes `pool: "recluse"` for `boss` (lobby-do.ts:323).
- **Counted once:** `again` is set on every try after the first (recluse.ts:388), the lost-search re-send included, and `again`
  skips counting (`uncounted`, engine.ts:221).
- **Bots and fair play stay on the match's budget** (call 5).
- **Monitoring:**
  - The health view has his row and `<day>:recluse-none` (engine.ts:168-169).
  - The ops page has its line (ops-admin.ts:127), and `ops:report` lists any no-result under "Needs attention".
  - The digest's line has a gap: see m2.

### M3: no result covers phase 2's board players only. Fixed

- **Who gets no result:** `phase2NoResultFor` (recluse.ts:658) uses `names`, as `phase2Unvouched` does.
- **The board players** (lobby.ts:4093-4109) are marked `noResult` and unranked. `writeResult` stops after fair play for them
  (lobby-do.ts:783).
- **A watcher's result stands.**
  - Their placement, `ranked` (`rankedFor`), XP and result row are unchanged.
  - `teamWon` is null for everyone. A Crowd final's watcher never reached the boss, so their `teamWon` is null in a normal finish
    too: nothing they had is taken away.
  - Their fair play is written in full.
  - The new Crowd test covers this.
- **The right line for each:**
  - The results message says `noResult: "watched"` with `bossResult: "draw"`; the board players' copy overrides it to `"board"`
    and `ranked: false` (lobby.ts:4233-4241).
  - Results.tsx shows "…Nothing counts for or against you." or "…Your place stands.", and hides the unranked line only for
    `"board"`.
  - A board player's XP box ends at "No XP for this game." once its asks find no row.
- **Someone who left a board before the end:** their loss is written as they leave (`leaveMatch`, lobby.ts:1377-1383, not
  deferred), and it stands. Someone who leaves after the end is deferred, so they get no result too. That matches call 4.

### m1: the pause and a bot handover. Fixed

`queue` starts a bot's thinking at `p.paused ?? now` (recluse.ts:368). On resume, `hold` adds the pause (recluse.ts:441), so the
bot plays its while after the resume. Its bank is charged only what stood before the pause, and the move isn't slow because of
the pause. The new test checks both. The away sweep goes through the same `handOver` → `queue`.

### m2: each position counted once. Fixed (see M2)

### m3: the alarm's check. Fixed

- Both of `step`'s paths for his move check `lobby.search` before `searchHis`: the old device-asked one (recluse.ts:260) and the
  retry or lost one (recluse.ts:269).
- `queue` (373) and `toServer` (405) check it too.
- `searched` only sets `retryAt`.
- The new test removes `phase2Search` mid-fight: no throw, the quick move, and phase 2 unvouched.

### The nits. Fixed

- **`withMates`** reads the position once (`matingMoves`, the new `matingMoves960`) and no longer touches `gameEnd`'s cache.
  - My probe: Chess960 starts with 20 moves took 0.1 to 0.3 ms.
  - Standard positions with 43 and 48 moves took about 4 ms each.
  - That's about the PR's "0.3 to 3.5 ms", and far under the old 30 ms.
- **`resend`** skips anything that isn't a bot's (recluse.ts:493).
- **The no-result test** asserts that phase 1's move is what `INSERT INTO fairplay_matches` gets.

## The merge of main (the child form online #684, the cutscene)

- **No hand edits in the source.** `020a6308`'s combined diff is empty for `packages/*/src`; Git merged every source file on its
  own. The conflicts were in `e2e/hidden-boss-room.spec.ts` and `packages/app/test/recluse-online.test.ts`, and both kept both
  sides. `964c8811` adds nothing to `020a6308`'s tree (it only brings in `ec8ec4e4`'s `.done`, which is gone at the tip).
- **His child and adult forms:** this PR's diff doesn't touch `startPhase2` (lobby.ts:2756), the forms' code or phase 1's boss moves.
- **The cutscene's hold:** `begin`'s `cutAt` / `at` / `clocksAt`, `step`'s `told` broadcast of `recluseCutscene` and `arm`'s
  `cutAt` are main's, unchanged. The pause and no result only act once `playing` (after `clocksAt`), so neither can fire during the
  fall, the cutscene or the countdown.
- **Tests:** the child-first tests in `crowd-hidden-boss.test.ts` and `recluse-online.test.ts` pass, as does the cutscene's
  phase-change test.

## Minor

### m1. His searches wait on a D1 write they never use

**Where:** `serverAllMovesAt` awaits `takeBudget` before its first group (engine.ts:221). For `"recluse"`, `takeBudget` awaits
`bump` (engine.ts:72-74) and then returns true whatever happened.

**Case:** every first try at a position of his makes one D1 round trip (an `INSERT … RETURNING`) before Stockfish starts.
1. On a typical D1 that's tens of milliseconds on each of his moves, counted toward `pauseMs`.
2. On a slow D1 (a spike of a few seconds), the whole fight pauses for it.
3. On a D1 that hangs rather than errors (the D1-down test covers only an error), the try can't start. Past 20 s the lobby
   re-sends it as lost. That re-send skips the count (`again`), so it goes straight to the container, but the fight has been
   paused that whole time.

The code already keeps D1 off the match's path elsewhere: "a slow D1 never holds up the match's next event" (lobby-do.ts:278).

**Fix:** for his pool, start the count without waiting for it. Run the groups first, and await the count at the end, or not at all.
Nothing depends on the number. In the Durable Object, `servePhase2` already runs under `waitUntil`, so the write still finishes.

### m2. The daily digest misses about ten hours of each day's no-results

**Where:**
- alerts.ts:327 reads `h.engine.recluse.noResults` from `health(…, now)`. That's `engineHealth(env, now)` (health.ts:123), which
  reads the row of `now`'s UTC day (engine.ts:165).
- The digest posts once a day at 8 am Central (settings.ts:3556, alerts.ts:281), which is 14:00 UTC this time of year.

**Case:**
1. A fight ends with no result at 15:00 UTC (9 am Central).
2. That evening's ops page shows it.
3. The next morning's digest reads the new UTC day's row and never mentions it.

Every no-result from 8 am to 6 pm Central (7 pm in summer), most of the US day, is missing from the digest. Yet the PR body and the
decision note say "the daily digest names any no-result", and the digest's own header says "(the last 24 hours)".

**Fix:** have the digest read yesterday's UTC row too, and say "yesterday N, today so far M". Or reword the claim to say the
digest names only those since midnight UTC. The day's searches line already in the digest has the same window, but it's labeled
"today" and was there before.

### m3. "A bot plays for its own team, so it can't be used to cheat him" doesn't hold (a call to write down)

**Where:**
- `toDevice` and `ask` (recluse.ts:392-413) now send every bot's move to the host first.
- `answer` (recluse.ts:596-604) checks only that the move is legal.
- The reason is given at recluse.ts:18 and 594, settings.ts:2022, the protocol comment, and the decision note (lines 11 and 68).

**Case:**
- **His room fight (one person, three bots):** the person is the host. A modified app can answer `phase2Ask` with a full-strength
  move. It has up to `askMs` (6 s) to think, where a bot's moves come every 0.9 to 2.6 s; his own move is about 600,000 nodes. That
  wins the three bots' boards for the team. Fair play scores only the person's own moves.
- **A Crowd final:** the host may be a watcher. A modified watcher's app can throw the bots' boards, so he wins and the finalists
  take the loss.

In #677 the engine server played the bots, and the device was only a fallback when the server failed. Now the device plays every
bot move.

This isn't new in kind: phase 1 already takes the bots' picks from the host with only a legality check (lobby.ts:3071-3074). So it
may well be acceptable.

**Suggest:** write down the director's call. Say plainly in the decision note that the host chooses the bots' moves, as in phase 1,
and that this was accepted. If the director wants it closed instead, send a bot's search to `"fairplay-1"` (still never his queue),
with the host's device as the fallback, as #677 had it on `engine-1`.

## Nits

- **"Never while it could still be running" is true of the lobby, not of the container.** When a try times out at `searchMs`, the
  group it was waiting on stays in the container's queue. The next try, 1 s later, waits behind it: at most one group, about 0.15 s.
  That's harmless, but the settings comment, the decision note and the PR body overstate it. Also, a timed-out try throws away the
  groups it already has. If those were kept for the next try at the same position, a slow server that is still answering (a
  position taking 15 to 30 s) could finish his move instead of reaching `serverWaitMs` and no result.
- **A normal end doesn't clear `p.fair`, and results are written about 3.2 s later** (`RECLUSE_PHASE2.endMs`). Phase 2's fair-play
  numbers now wait up to 60 s on `fairplay-1`, which nothing wakes and which may be busy with a deep re-check (2M nodes, about
  2.5 s a search). So the numbers for the move that decides the last board can arrive after `writeResult` has written that player's
  fair play, and are lost. It's at most the last move or two of a fight, and only fair play's sample. Mentioned only because the
  move to `fairplay-1` widens the window.
