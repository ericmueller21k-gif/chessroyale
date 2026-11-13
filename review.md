# Review of #683: the Hidden Boss's phase 2 moves from the engine server only

Independent, read-only. Reviewed `origin/claude/recluse-server-only` at `f000aa44` against `main` at `bfb60782`, following
`notes/briefs/review-server-only.md`. Line numbers are on the PR branch.

**Ran:** `npx vitest run packages/server packages/core packages/app`: 292 files, 4,007 tests, all passed. `npm run typecheck`:
clean. I also ran two throwaway probe tests (not committed) for m1 and m3, and timed `withMates`.

**Verdict:** no blockers, 3 majors, 3 minors and 3 nits. The code does what the PR says, and every item on the brief's list
checks out (below). The majors are about what happens on the real engine server under load or once the budget runs out (M1,
M2), plus one product call for Eric or the director (M3). The unit tests can't see M1 or M2: they answer every search
instantly, and the e2e suite has no engine server.

## Checked and fine (the brief's list)

- **His moves never come from a device.** `queue` sends his work only to `search`, or to the quick move when there is no
  engine server. `searched` sends only a bot's empty answer to `toDevice`. `step`'s lost-search branch `continue`s before the
  bot path. `answer()` requires `who === "bot"`, and `ask()` always sends a bot's strength. A move of his that an older
  server asked of a device (a deploy mid-fight) is moved to the engine server in `step`'s `since === undefined` branch.
- **The pause:**
  - `turnAt` (set only on a person's or bot's turn) and `botAt` are shifted by exactly `by` (recluse.ts:389-401).
  - `arm` drops the flag times while paused, and `step` skips `phase2Flags` and `phase2Timeouts`. `move()` is refused
    (recluse.ts:496), `ult()` is refused, and `playReady` holds the moves that are in.
  - His ultimate's few seconds per move and the slow-move count are both based on `turnAt`, so the shift covers them.
  - A reconnect sees the pause: `tell` stores the view in `last` (lobby.ts, `phase2Lobby.broadcast`).
  - The app freezes the board tag at `paused` and holds the dock clock at its last value.
  - `LEAVING.awayMs` (120 s) is longer than the longest pause (57 s), so nobody is swept for waiting it out.
- **No result:**
  - `writeResult` returns right after fair play (lobby-do.ts:765): no XP, no result row, no crate, no token.
  - `humanResults` marks everyone, and the results message says `noResult` with `ranked: false`.
  - Phase 1's fair-play moves are kept and phase 2's are cut at `fairFrom`. That count is right: phase 1's FairMoves are
    pushed when each round locks (`noteFair`), before `startPhase2`. Fair-play answers still in flight are dropped
    (`p.fair = {}`).
- **Retries:** the waits are 1, 2, 4, 8, 8… s. An earlier try's empty answer adds no new try, any try's answer plays, and a
  search lost on the way is sent again at 20 s.
- **His own day row:** while `<day>:recluse` is within 3,000, his searches don't touch the day's row. Past it, they count
  against the day's budget as a match's do (engine.ts:63). That matches the decision note.
- **`withMates`:** marks mates correctly. It uses `gameEnd` with the board's own rules (Chess960 included), and the moves
  come from `legalMoves(fen)`, so it can't throw on an unknown castling notation. Its cost is in the nits.
- **The "no engine server" path in production:** it needs `ENGINE_OFF=1` or a missing `ENGINE` binding. `ENGINE_OFF` is
  "never production's" (docs/decisions/2026-11-09-admin-abilities.md:56), and production's `wrangler.jsonc` has the
  binding and no `ENGINE_OFF`. So production can't reach it through its settings. A mid-fight change is m3.
- **Protocol:** `NetPhase2.paused?`, `done.noResult?`, the results message's `noResult?` and `HumanResult.noResult?` are all
  optional. No client message changed, and no other lobby is affected.

## Major

### M1. Under phase 2's own load, the pause will fire on many of his moves, and timed-out searches pile up

**Where:**
- engine.ts:176: every all-moves search goes to the one container instance `"engine-1"`.
- engine/server.mjs:79 and 143: one Stockfish, one thread, a strictly serial queue.
- engine.ts:114: the 6 s timeout (`ALL_MOVES_GROUP_MS`, engine.ts:155) is a `Promise.race`. It returns null, but the
  container still runs the request.
- recluse.ts:506: every person's move adds a fair-play all-moves search. recluse.ts:346: so does every bot move.
- recluse.ts:268: `SERVER_LOST_MS` is 20 s. settings.ts:2002: `pauseMs` is 3000.

**Case.** These are estimates from the PR's own numbers: 120,000 nodes take about 0.15 s at 0.8 million nodes a second, and
one position is five sequential requests.

- **A Crowd final (four people):** each person's move queues two all-moves searches at once (fair play's and his reply).
  That's up to 8 searches, or about 40 requests, in one serial queue. Each of his 5 requests waits behind about 7 others:
  about 5 × 8 × 0.15 s ≈ 6 s per reply. That is past `pauseMs`, so all four boards freeze on most of his moves.
- **His room fight (one person, three bots):** 4 or 5 searches in flight, about 3 to 3.75 s per reply. That's right at
  `pauseMs`.
- **Other load on the same instance:** every match's judges' re-checks (2M/boards nodes, at least 400,000 each), Squads'
  bot work and solo's `/api/engine/score` (index.ts:224) all use `"engine-1"` too.
- **The feedback loop:** near 6 s a group times out and the search returns null. He tries again (5 more requests) while
  the abandoned ones are still queued. A search that is slow but still answering can take 30 to 40 s (the first group tried
  twice at 6 s, then 4 or 5 groups at up to 6 s each), yet it is sent again at 20 s.

Before this PR, a slow reply froze nothing: the person's clock doesn't run on his turn. Now a slow reply freezes all four
boards. That's smooth play, the first of Eric's computing priorities.

**Suggest (any of):**
- Measure his answer times on production's engine server before relying on `pauseMs` 3000. An admin's room fight is
  enough: each pause is already logged with its length.
- Move phase 2's fair-play searches off `"engine-1"`. They aren't urgent: use `"fairplay-1"`, or score them after the
  fight.
- Give his searches their own instance or the front of the queue. A third container (`max_instances` 2 → 3) is Eric's spend.
- Don't send a new try while an earlier one could still be running: the lost-search cutoff should be longer than a slow
  search's worst case.

### M2. Once his share and the day's budget are spent, every later phase 2 ends in a silent "no result"

**Where:**
- engine.ts:63: past `dailySearches`, his searches come out of the day's budget and are refused once it's spent.
- engine.ts:173: a refusal returns null before any call to the container, so `markEngine` never records a failure, and the
  health view's "last failure" stays clean.
- recluse.ts:533 and 243: he is retried until `serverWaitMs`. recluse.ts:242: then `noResult`.

**Case.** A busy day after launch. The judges and solo have spent the day's 3,000 (the reason solo got its own cap), and
this is the 21st long fight: 3,000 ÷ about 150 searches a fight, the note's number.
1. His adult form is beaten: the fall, the cutscene, the 34 s phase change and the countdown all play.
2. His first reply is refused for budget, and so is every retry.
3. Everyone sits through 57 s of "He's thinking…", then "No result".

That happens to every phase 2 until midnight UTC. With M3, each one voids a 100-player Crowd match. Nothing alerts anyone:
the health view shows only the day's row (the note's "Not done"), and budget refusals don't count as engine failures.
Before this PR, past the budget his move went to the host's device.

**Suggest:**
- Either never refuse his searches for the day's budget (they're already bounded by the fights), or check his budget before
  `begin` and, if it can't cover the fight, end at the adult form's defeat. That second option is a design call.
- Add an alert, or a health-view line, for his row and for each "no result".

### M3. "No result" voids the whole match for everyone, including a Crowd final's 96 watchers (a call for Eric or the director)

**Where:** lobby.ts:4058 and 4087 (every human is marked `noResult` and unranked), lobby-do.ts:765 (nothing but fair play is
written), and the decision note's call 3.

**Case.** A Crowd 50 v 50, about 15 minutes long. The top 4 beat his adult form, then in phase 2 the engine server
doesn't answer for 60 s. The other 96 players' placements, and the 50 v 50 itself, were settled before phase 2 began. Even
so, they get no XP for their minutes, no result row and no rank change.

That differs from the unvouched case, where "a Crowd final's watchers stand" (recluse.ts:108). The director's brief says
"the fight ends … Nothing counts for or against anyone", which reads as phase 2's players. Eric hasn't ruled on it.

**Suggest:** scope it like `phase2Unvouched`. Only those who played a board (`p.names`) get `noResult`, and everyone else's
result stands at their placement (the boss's `teamWon` null). Or keep it as it is if Eric confirms, with the note citing
his call.

## Minor

### m1. A board handed to a bot during a pause has the pause charged to its clock, plus a slow move

**Where:** recluse.ts:588 calls `queue`, which sets `botAt = now + think` during the pause (recluse.ts:337). `hold` then adds
the whole pause on top (recluse.ts:401).

**Case** (a probe on a room fight, 2 people and 2 bots, the engine answering on demand):
1. The pause begins.
2. 40 s in, p2 resigns.
3. His reply arrives and the clocks resume.

The bot on p2's board then plays 41.0 s after the resume instead of about 0.9 s. Its bank goes from 120.0 s to 76.1 s:
43.9 s charged (3 s before the pause, 40 s of pause, 0.9 s thinking). The move also counts as slow, toward his ultimate. On
a short bank the board flags, and a team board lost means he can't be beaten. The same happens when the away sweep hands
over a player who was gone since before the pause.

**Fix:** in `queue`, while paused, set `p.botAt[b.id] = (p.paused ?? now) + think`. `hold`'s shift then lands it at the
resume plus the thinking time.

### m2. Every retry is charged to the budget again

**Where:** recluse.ts:357 → lobby-do.ts:307 → `takeBudget` on every try.

**Case.** With the engine server down, the tries go out at 0, 1, 3, 7, 15, 23, 31, 39, 47 and 55 s. That's 10 units of
`<day>:recluse` per position, with up to 4 positions waiting at once (one a board): about 40 per failed fight. The 20 s
re-send of a search that's still running counts twice too. It's cheap, but the settings comment ("counts once against the
day's budget", settings.ts:1983) and the note's cost math assume one charge per position.

**Fix:** charge a position once (take the budget on the first try only), or correct the docs.

### m3. Turning the engine server off mid-fight throws in the alarm

**Where:** recluse.ts:243 calls `searchHis`, which calls `lobby.search!` at recluse.ts:357 without a check. `queue` and the
`since === undefined` branch do check.

**Case** (a probe):
1. His first try is answered null.
2. `phase2Search` is removed: a deploy with `ENGINE_OFF=1` or no binding, i.e. a production misconfiguration.
3. `retryMs` passes, and `core.alarm()` throws `TypeError: lobby.search is not a function`.

The alarm keeps throwing until `serverWaitMs`, when `noResult` runs first.

**Fix:** before `searchHis`, `if (!lobby.search) return noResult(lobby, p)` (or play the quick move and unvouch, as `queue`
does).

## Nits

- **`withMates`'s cost.** On a position's first answer it takes 3 to 30 ms of the Durable Object's CPU (measured: Chess960
  positions with 19 moves, 3 to 14 ms; a position with 43 moves, 30 ms). Each legal move is a full chess.js or 960 replay.
  Each call also adds one entry per legal move to `gameEnd`'s shared 256-entry cache, which pushes other boards' entries out.
  Testing only the moves that give check would cut it to a few replays.
- **`resend()`** (recluse.ts:444) can re-ask the host for a move of his that an older server asked of a device, before `step`
  moves it to the engine server. `answer()` refuses the reply (the `who` check), so it only wastes one device search at a
  bot's strength.
- **The no-result test's write check** (`expect(queries).toEqual(["SELECT rating FROM users WHERE id = ?"])`) shows that
  `recordFairPlay` ran, not that phase 1's move was written: a single stub move makes no case. Asserting on the moves passed
  to `recordFairPlay` would prove "phase 1 kept".
