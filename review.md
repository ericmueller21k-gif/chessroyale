# Review: PR #678 (the Hidden Boss's child form) and PR #677's fix round (delta)

Independent, read-only. Brief: `notes/briefs/review-678-and-677-delta.md`. Nothing on either PR branch was changed.

| PR | Head reviewed | Checks run here | Verdict |
| --- | --- | --- | --- |
| #678 | `8b497ebc` (`claude/recluse-child-form`) | `npx vitest run packages/chess packages/app packages/core`: 267 files, 3,973 passed, 2 skipped. `npm run typecheck`: green. | No blockers, no majors. 2 minors, 2 nits. |
| #677 | `b79dd925` (`claude/recluse-online-phase2`; delta `5eefa1f3..`) | `npx vitest run packages/server packages/core packages/app`: 291 files, 3,989 of 3,989 passed. | All 2 majors and 6 minors fixed as the PR body says. 1 minor (the nit's fix doesn't reach production), 2 nits. |

---

## 1. PR #678: the Hidden Boss's child form (boss lane, quick pass)

### Minor

**m1. The guard of Eric's Nov 4 rule (and the one-side-size check) now test the child, not the man, against the man's frames; the PR doesn't list it.**
- `e2e/boss-side.spec.ts:101` (the guard in `docs/rules/eric.md:31`, "Eric's rule (Nov 4): <boss> and the God King whole on screen…")
  and `e2e/side-same-size.spec.ts:24` open Boss alone with `boss=recluse`, without `&form=adult`.
- Since `App.tsx:1240` turns on `recluseChild` for every solo match, both now meet the child (`RECLUSE_CHILD_KIT`, `RECLUSE_GROWING`).
- They still measure him with the adult kit: `restBoxes(kit.ch / kit.bar)` (boss-side) and `kitOf("recluse").ch.w` (side-same-size).
  They pass because `RECLUSE_GROWING` has the same `W`, `H` as `RECLUSE` (CI's full 15-shard run is green). But:
  - the man in Boss alone is no longer checked by either spec;
  - the child's own frames (his taller ages, the growing step's silhouettes) are never checked against the rule.
- The PR's "Changed checks" lists only `recluse.spec.ts` and `crowd-hidden.spec.ts`. CLAUDE.md asks every PR to list the checks it
  changed, and this one changes what a guard of Eric's rules checks.
- **Failing case:** a later change that pushes the adult figure off-screen in Boss alone passes `boss-side.spec.ts`. That spec only
  ever meets the child now, so the guard no longer covers the man.
- **Fix:** add `&form=adult` where these two specs open `recluse` (as `meetHim` does). For the child, either a case measured against
  `RECLUSE_CHILD_KIT`'s frames, or a line in the PR saying the guard doesn't cover him yet.

**m2. A kid's entrance line doesn't fit Boss alone.** `recluse-lines.ts` `RECLUSE_CHILD_LINES.intro[1]`: "Four against one? Okay. I'm
ready." Its chance is 1 (`kits.ts` `chance.entrance: 1`), and Boss alone is one player against him, so a third of admin playtests open
with a wrong line. It's a placeholder, but Eric will read it in his next playtest. **Fix:** a line without a head count.

### Nits
- The level pop now keys on `up:${lv}` (`Boss.tsx:175`). I checked that this changes nothing for the other bosses: their lifted level is
  constant while lifted (`ENGINE_MAX_ELO`), so their pop still plays once.
- `bossView`'s `threat` for the child still comes from the adult's `b.elo` (`runner.ts`, `bossThreat(b.elo)`). It isn't shown for him
  today, so this is harmless.

### The power-up row flake (`e2e/crowd-play.spec.ts:187` [desktop], "power-up row top at 390×844")
Very unlikely to be this PR's.
- That test plays a solo Crowd's ordinary 50 v 50 turns (`?mode=crowd&augments=0`) and never reaches a boss.
- What this PR draws on screen is boss-only: `BossLevel`, `BossFace` and `BossCharacter` (each behind `form === "child"`), the music
  (behind `boss.id === "recluse"`) and `talkWhen`.
- `App.tsx`'s one change adds `recluseChild` to the settings, which only `runner.firstForm` reads, at the boss battle's start.
- Nothing the match screen's rows depend on (`.history-nav`, `.play-slot`, the table) is touched.
- **Likely cause, in the test:** on the desktop project the page loads at 1280×800 and the first loop sets 390×844. The first snapshot is
  taken with no wait for the new layout, and screens with resize listeners (e.g. `Crowd.tsx:653`) re-fit a moment later. A snapshot from
  before that settles would give one phase a different `nav.top`.
- **Suggested, for the director's flake list (not this PR):** wait for two stable frames after `setViewportSize` before the first
  `snap()`. I couldn't confirm this without the failed attempt's trace.

### Checked, no findings
- **The Maia ramp:**
  - `childRating`: 1800, then +100 every 4 plies on the board (both sides'), capped at Maia's top, 2500 (seven steps, the last at ply
    28). The ply count is from the form's own `startPly`, so the `?win=1` opening moves don't count.
  - The runner overrides `humanBrain.rating` per move.
  - Stockfish's fallback (Maia loading, failed or dropped, or an admin's `brain=stockfish`) plays at `levelForMaia(child)`, the inverse
    of `maiaRating`'s lines: 1800 gives 2367, 2500 gives 2650 (the adult's fixed level). `bossMoveFrom` gets that `elo`, never the
    adult's.
  - The admin's brain line shows the child's rating now.
- **The form order:**
  - The child beaten (by mate, by eval at `maxMoves`, or by the 🏆) returns early from `finishBossBattle`: nobody is placed, and
    `bossForceWin` is cleared. Solo shows his fall for `fallMs`, then `nextForm` (`nextBossForm`): board from the start, fresh powers
    and banks, and strikes, King moves and Last Stand cleared. Then his entrance plays again.
  - The child winning, a draw, or a timeout goes through `finishBoss` as before and ends the fight. `phase2Due` only follows the
    adult.
  - When you're out, the bots' loop (`solo.ts:1624`) plays the adult form too.
- **The 🏆:** `winFormShown` keys on `id === "recluse"`, so it shows in the child form. It arms `bossForceWin`, which gives the child
  beaten, then the adult. The admin's 🏆 is available again in the adult form.
- **Other bosses, and the adult form with the child off:**
  - `bossPowers` and `bossRules` change only for `form === "child"`. `firstForm` sets the form only for `recluse` with `recluseChild`.
  - `recluseChild` is set nowhere but `App.tsx`'s `SoloMatch`. Online lobbies never carry it.
  - `?form=adult` and `?phase=2` skip the child, and `form` is a test switch (no XP).
  - `kingHelpBlocked` reads `bossPowers`, so the God King helps against the child, as the decision says, and is blocked again for the
    man.
- **The growing step plays once:** `growingRun` keeps module state per battle, keyed on `(form, formStep, result)`. A redraw or a second
  placement returns null. A battle first seen midway shows his age without playing the step. The beaten growth plays once (`shown.up`).
  `resetBeats` resets it before the adult's battle.
- **Music:** the child's theme plays through his fall, with the adult's theme as `next`. After `nextBossForm` the form is gone, so it
  switches to `RECLUSE_MUSIC.adult` with the existing fade. The results end it.
- **Lines:** the kid's lines never use his name. `talkWhen` keeps the man's muttering out of the child form.
- **Voice keys:** the adult battle's `startMove` equals the child's, so the beat, fall and voice keys repeat. `nextForm` clears them
  (`bossVoice.reset` clears `said`; `resetBeats`, `resetBattleBanners`, `resetKingSpeech`), so the adult's lines aren't swallowed.

---

## 2. PR #677: delta re-review of the fix round (`5eefa1f3..b79dd925`)

### Each finding against its "Review round" entry

| Finding | Fixed? | Where |
| --- | --- | --- |
| **M1** quick move didn't unvouch; asks not re-sent | **Yes** | `quick()` unvouches *his* move from both paths (`step`, and `toDevice` with no host). `resend()` re-points every open device ask to `hostNow()` with a fresh `at`. It runs on disconnect (`lobby.ts:1097`), on leave (`:1396`), and from `resendTo` (`:1081`, a reload), where the host itself coming back is asked again (`host === back`). `answer()` takes the move only from the re-pointed device. |
| **M2** one miss unvouched the whole match | **Yes** | `begin()` calls `lobby.warm?.()`, which is `warmEngine` under `waitUntil` in `lobby-do.ts`. The first group is retried once (`engine.ts:171`), with the budget still taken once. A bot's device or quick move never unvouches. His sets `recluse2.unvouched` only. `phase2Unvouched(r, id)` (anyone in `p.names`, leavers and bots included, watchers not) is read by `rankedFor` (the results row and a leaver's result), by the results message (per person: `ranked: false, unvouched: true` for the board players only) and by `lobbyXpGame`'s cap. `r.unvouched` is no longer set by phase 2, so phase 1's ranked flag, fair-play moves (`lobby-do.ts:756`) and watchers' XP are untouched. |
| **m1** 25 KB broadcasts | **Yes** | Everyone gets the lean `phase2`. `r.last[h]` gets the full one, one object shared by all. `store()` puts `last` in one `storage.put`, and structured clone keeps shared references, so it's stored once (before this, it was 100 copies). Reconnect: `resendTo` sends `last`, which has the battle and the standings. |
| **m2** stale second move | **Yes** | `phase2Move.ply` must equal `b.board.history.length`. The view's `history` is the full board history, the same number the app sends. A refusal is `refused: true` and not remembered. The app keeps `pending` over the server's word until the history moves past `ply`, the board is decided, or it's refused, and re-sends it in `onWelcome`. A duplicate is refused by `ply`, and the refusal's view already has the move. |
| **m3** leave confirm in the fall | **Yes** | `phase2Boards` comes with the fall's `boss` message. `phase2Seat` gives `exit` "resign" and `seatToBot` true. The fall message is the remembered `last`, so this holds after a reload too. |
| **m4** test fights write fair play | **Yes** | `!lobby.r.overrides?.tested` gates the fair-play search. |
| **m5** wasted searches | **Yes** | `handOver` queues only if `anyoneHere(from)`. That's the same `present()` test `wrapUpIfEmpty` uses, in the same event, with the leaver excluded before `humans` is filtered (`lobby.ts:1371` vs `:1379`). So "nobody here" always means the match ends this event, and no bot board is left without work. |
| **m6** reload during the hold | **Yes** | `NetPhase2.cutAt`. `begins()` sets `cutscene` from the view. |
| **Nit** a bot doesn't mate | **No** in production (see m1 below) | |

### Minor

**m1. The "a mate scored is played" fix can never fire online: the engine server never sends `mate`.**
- `pick()` (`bosses/recluse.ts`) prefers `scores` with `mate > 0`. Online, those scores come from `serverAllMovesAt` → `containerScore`,
  which returns the engine server's `body.moves` as they are.
- The engine server's `/score` drops the mate. `engine/server.mjs:42`'s `parseInfo` has no `score mate`, and `:70`'s `pick` maps to
  `{ move, expected }` only.
- The unit test ("a mate scored: the quickest…") passes because it builds the scores by hand.
- **Failing case:** a bot (or he) in a won position with mate in one available. Every move scores `expected` ≈ 1 (WDL 1000/0/0), so a bot
  picks at random within `botLoss` and can shuffle, as the first review's nit said. The PR body and the decision note say this is fixed.
- **Fix (pick one):** mark mate-in-one moves on the server with the rules (`gameEnd(applyMove(fen, m)) === "checkmate"`). That's cheap,
  covers both devices and the engine server, and needs no container change. Or add `mate` to `engine/server.mjs`, which means
  redeploying the container. Until then, the PR body shouldn't list the nit as fixed.

### Nits
- **No cap on re-asks.**
  - Each host disconnect, leave or reconnect re-asks every open device ask with a fresh `askMs` (6 s). The PR body says this is
    deliberate.
  - In a Crowd final the host can be any of the 100, a watcher included. A host whose connection drops and returns more often than every
    6 s keeps his moves (and a bot's) waiting. Nobody's clock runs meanwhile, so it's a stall, not an unfair result.
  - A cap of about 3 fresh times per ask, then the quick move, would bound it.
- **The retry can pass `SERVER_LOST_MS`.**
  - With the first group retried, a slow first group costs up to 12 s, and a position of 3 or more groups (17 or more legal moves) can
    pass `SERVER_LOST_MS` (20 s) when the server is slow.
  - Then his work has already gone to the device, and the late answer is ignored. That's correct and never doubled; it just gives up
    one device move.
  - Separately: the timed-out first request isn't aborted, so the retry queues behind it in the container's serial queue.
- (Cosmetic) `rankedFor` with its doc comment was inserted between `ranked()`'s doc comment (`lobby.ts:4088`) and `ranked()`, so that
  comment now sits above `rankedFor`.

### The fixes broke nothing else (checked)
- **Phase 1:**
  - `r.unvouched` keeps its old sources (`lobby.unvouch` from BOSS_CHECK and the judges), and `ranked()` / `lobbyXpGame` still read it.
  - Phase 2 no longer writes it, so a phase 2 miss can't reach phase 1's fair play (`lobby-do.ts:756`) or the watchers.
- **Results:** the per-person `results` send keeps `remember` (a reconnect at the results gets that person's own message).
- **Broadcast:** the new phase 2 broadcast is exactly `lobby.broadcast` (every human, remembered) with the extras moved to `last`.
  Refusals and asks aren't remembered.
- **Leavers:** a leaver's own result is written at the leave with `rankedFor` as it stands then. That's always a loss, so a later
  unvouch can't inflate it.
- **Old apps:** an old app's `phase2Move` (no `ply`) is now always refused. The app and server deploy together from `main`, so this only
  matters for a tab left open across the deploy.
