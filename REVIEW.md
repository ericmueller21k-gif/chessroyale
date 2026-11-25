# Review: PR #935, the season ladder (`claude/ladder` @ fe44ac86)

Read-only review against `main` (b9c7858). Read: CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/ranked.md`,
`hub.md`, the whole diff. Ran `packages/server/test/ladder.test.ts` and `packages/app/test/ladder.test.ts` (20/20 pass). Measured home
and `/ladder` in Chromium (vite dev, `/api/ladder` stubbed with a 2.5 s delay) at 320 px, iPhone 13 (390 px) and 1280 px.

**Verdict:** no blockers. One major (fair play: the engine pool's quiet breaks on the ladder), five minors, a few nits. Stored data
is safe: the new partial index is created by the normal schema run (the fingerprint changes, `IF NOT EXISTS`, partial indexes are
already used in production: `users_test`, `users_resident`), and the top tiers' place changing to `LEFT_OUT` only moves honest
players up past banned ones, which is the intent.

Checked and fine (no action):
- **Schema:** `ranked_1v1_board` is in `RANKED_SCHEMA`, so `SCHEMA_VERSION` changes and the one batch creates it on a live D1 with
  rows; nothing else in the batch depends on it. `ladder IS NOT NULL` ⇔ `games >= placements.games` holds everywhere the ladder is
  written (core `rankedAfter`, the leave fee, merges `rankedMoves`, deletion), so the list (partial index + `games >=`) and the count
  (`ladder IS NOT NULL`) are the same set; account deletion and guest merges delete the `ranked_1v1` row, so the list's inner `JOIN
  users` can't drop someone the count keeps.
- **Places:** `ladderPlaces` (index-based, ties share) equals `placeOf` (1 + shown above) because both sets are the same; a tie
  straddling the 200 cut is handled by `rowsWithYou` appending you after your ties.
- **Privacy:** the edge key is `/api/ladder/top?mode&season&v` built only after `mode === "1v1"`; `ladderTop` takes no viewer input,
  so the cached body can never hold a viewer's row; the answer itself is `no-store`. `u.email` is read only for `isAdmin`, never
  answered. Banned accounts never reach the route (the ban gate answers every `/api/*` first).
- **SQL:** `mode` is compared to a literal before any use; the only interpolations are constants (`PLACED`, `LEFT_OUT`). `LEFT_OUT`'s
  `IS NOT NULL` guards are right (one NULL would empty a `NOT IN`), and the test proves it. `looksOf` as one `json_each(?)` value
  fixes the 100-bound-values limit for every caller (a 100-player lobby was at the edge before) and still searches by key.
- **Layout:** no shift while loading. Measured at 320 and 390 px, signed out / placing / placed: `.ld-list` and `.ld-mine` keep the
  same y and height from the ghost frame to the loaded frame; no page scroll, no sideways scroll; only the list scrolls. Light and
  dark: tokens throughout; the tier ink is darkened under `[data-theme="light"]`, which `theme.ts` always sets.
- **Home:** `.fd-ladder-a` is `position: absolute` in a `position: relative` `.fd-ranked`, so the RANKED row can't move.
- **Navigation:** a profile from a row unmounts the ladder (App's `profileOpen` branch comes first, and the town layer swaps its page),
  and Back remounts it with the kept answer and scroll. A found duel still takes over (the duel branch renders before `showLadder`).
- **e2e seeding:** the 230 seeded ladders (8771 to 9000) stay in the run's local D1, but every other spec that asserts a top tier
  (`public-profile`, `ranked-1v1`, `ranked-tiers`, `home-ranked`'s rank line) mocks its rank with `rankView({ ..., place })`, so none
  read a server-counted place.

---

## Major

### M1. A pooled player can tell they're hidden: their view of the ladder doesn't add up (fair play)

`packages/app/src/ladder.ts:46-54` (`rowsWithYou`), `packages/server/src/ladder.ts:70-79` (`ladderYou`), `:128-130` (`handleLadder`).

The engine pool's rule is that a pooled player "sees their place as ever" (fairplay.ts; the Top N% does it by adding the player back:
`accounts.ts:1233-1236`, `total = shown + self`, the same count for `above`). Here the server leaves the pooled player out of `rows` and
`total`, computes their own `place` among the shown players, and the client splices them in. What they then see isn't what an honest
player in their spot sees:

1. **Short ladder (pre-launch, the normal case): they're missing from the list entirely.** Ladder of 2 honest players (3000, 2900),
   pooled player at 2800. Server: `rows` = [#1, #2], `total` = 2, `you.place` = 3. `rowsWithYou`: `you.place (3) > last.place (2)` →
   not added. The page reads "2 ranked players", lists two rows, and pins "#3 You" under them. An honest third player sees 3 rows and "3
   ranked players". Any time the whole ladder fits under 200 and the pooled player is below everyone shown, they're dropped. The app
   test pins this as intended (`test/ladder.test.ts:31`, a 4-row list and `row("me", 5)` "never added").
2. **Inside the list: a shared place with someone they outrank, sorted after them.** Honest 3000 and 2900, pooled 2950. Server: `rows` =
   [#1 3000, #2 2900], `you.place` = 2. `rowsWithYou`: `findIndex(place > 2)` is −1 → appended at the end: #1 (3000), #2 (2900), #2 You
   (2950). The pooled player appears below someone with fewer RP, at "the same place". In a full list, every honest row below them keeps
   a place one too good, and `total` is one short. The server test asserts exactly this state (`server/test/ladder.test.ts`, "a
   left-out account still sees its own place": list `[1, 2]` and pooled `place` 2).
3. **The raw answer is a tell anyway.** Even with the splice fixed on the client, `/api/ladder`'s JSON shows a pooled player that
   `rows` omits them while `you.place` falls inside the list. A curious cheater with devtools sees it.

**Fix (server-side, so the JSON is indistinguishable):** in `handleLadder`, after the shared top comes back from the cache, build
the viewer's copy when they're placed and not in the shared rows at a place ≤ the last row's place, or the list is shorter than
`LADDER.size`: insert their fresh row in ladder order (`ladder DESC, user_id DESC`); add 1 to `place` of every shown row with a lower
ladder; add 1 to `total`; trim to `LADDER.size`. Do it only for left-out viewers: have `ladderYou` read `user_id IN LEFT_OUT` in its
own query, never in the answer. Then `rowsWithYou` becomes a no-op for them (or goes). Change both tests above to assert the "as
ever" view: the pooled player in order, the honest rows below them one place lower, `total` + 1, and the bottom-of-a-short-ladder case.

(Inherent and already true of the Top N%, for the record: a third party can still notice that a pooled friend whose profile says
"Transcendent" is missing from the ladder. Pooled players mostly meet the pool, so that seems acceptable, but fairplay should know the
ladder makes it easier to see.)

## Minor

### m1. Home's LADDER › tap box covers the top 3 px of the Squads button (phone and computer)

`packages/app/src/styles.css:10673` `.fd-ladder-a` (`top: -12px; min-height: 40px`). Measured: at 390 px the link is y 179 to 219, the
Squads radio starts at y 216; at 320 px 155 to 195 against 192; at 1280 px 331 to 371 against 368. `elementFromPoint` 2 px inside the
link's bottom-right corner (on Squads' top edge) returns the LADDER button: it's positioned, so it paints over the in-flow radios. A tap
on Squads' top edge opens the ladder instead of picking Squads, on the RANKED row that Eric's home rule guards. On a phone its top 4 px
also run under the hero card's View profile, which wins those taps (harmless but untidy).
**Fix:** keep the 40 px box but let the mode row win the overlap: `.fd-ranked [role=radiogroup] { position: relative; z-index: 1 }`
(or end the link at the radios: `top: -15px`, which pushes more of it under the hero). Add to the e2e: `elementFromPoint` at Squads'
top edge is Squads.

### m2. The edge cache is likely inert where this runs; the D1 reads per open aren't what the docs say

`packages/server/src/ladder.ts:88, 111-127`. This is the codebase's first use of `caches.default`. Cloudflare's Cache API docs say
`put`/`match` have no effect on `*.workers.dev` and aren't available for Workers behind Cloudflare Access (please verify against
the current docs; I didn't fetch them here). `main` is behind Access until launch. If so, every ladder open reads D1 each time: the
200 rows (with `NOT IN LEFT_OUT`), a count over every placed ladder's index entry, the looks, plus your session, record, place count and
looks. That's correct but not "one D1 read a minute per data center" (settings.ts `LADDER` comment, ranked.md, hub.md). It's cheap at
today's size; it just isn't what the docs promise, and the in-Worker test fake can't show it.
**Fix:** the codebase's own pattern (`topPlaces`, the town chat's `caches` Map) works everywhere and is simpler: a module `Map` of
the top per mode, kept `LADDER.cacheSeconds`, in this Worker instance. Or keep `caches.default` with the Map as a fallback. Either
way, check a live open (ops counts or a log line) before stating the read rate in the docs.

### m3. Players in fair-play `review` are on the public ladder; fair play's hook says leaderboards leave them out

`packages/server/src/ranked-schema.ts` `LEFT_OUT` (`status IN ('banned', 'pool')`). `fairplay.ts:62-70`, `eligibleForRanked`:
"Whether a player's results may count for ranked play and leaderboards: not while they're in review or banned. The hook for the
`ranked` delegate." With this PR, a player a person is reviewing for engine use (results held) can sit at #1 on a page every player
sees, for as long as the review takes. That may be the right call (hiding them could also tip them off, like M1), but it contradicts
the documented hook and isn't in the decision note.
**Fix:** a call for the director/fairplay, recorded in `docs/decisions/2026-11-25-ladder.md`. If review is left out, give it M1's
"as ever" view, and note that topPlace would then change for everyone below.

### m4. Your pinned row and your row in the list can disagree for up to a minute

`packages/app/src/ladder.ts:49`. `rowsWithYou` returns the shared rows untouched when they hold your uid, but they may be up to
`cacheSeconds` old while your pinned row is fresh. Example: you win a game and go from #20 to #15. The list still highlights "#20
You" and the pin says "#15". Or you drop from #199 to #203: the list shows you at #199 and the pin says #203. (When you climb *into* the
200, the splice already handles it.)
**Fix:** M1's server-side merge for every placed viewer: drop your stale row from the shared rows and insert your fresh one at its
ladder. One code path fixes both.

### m5. "Back returns to the same place" lapses after a minute, isn't tested, and its flag can leak

`packages/app/src/screens/Ladder.tsx:26, 36-37`, `packages/app/src/ladder.ts:12, 20-23`, `e2e/home-ranked.spec.ts` (last lines).
- `keptLadder` returns null once `LADDER_KEEP_MS` (60 s) has passed since the *load*, so after a minute on a profile, Back refetches
  and the list starts at the top (`loadLadder` resets `scroll: 0`). Reading a profile for a minute is normal.
- `backFromProfile` is a module flag cleared only when a `LadderScreen` next mounts. If a profile opened from the ladder is left
  another way (the side menu's Home), the next ladder open within 60 s gets the old answer and scroll, as if it were Back.
- The e2e clicks `rows.last()`, goes Back, and asserts only `toHaveCount(200)`. It never checks the scroll, so the doc's "same
  list and place" (hub.md, the decision) is unproven.
- `forgetLadder`'s comment says "signing in or out changes your row", but only tests call it.

**Fix:** keep the scroll apart from the answer's age (refetch if stale, then restore the scroll); clear the flag when the profile
closes by anything other than its Back (or carry it on the profile target); in the e2e, after Back assert `.ld-list` `scrollTop` is
near `scrollHeight - clientHeight`.

## Nits

- **n1. The home e2e's "nothing moves" comment isn't checked** (`e2e/home-ranked.spec.ts`, "Out of the flow … the row under it where
  it was"). `homeRow` is measured once, with the link already there, and used only for the right edge. The absolute positioning makes
  it true (verified above), but the test doesn't prove it. Either assert the radiogroup's y equals the label's bottom + the 6 px gap, or
  reword the comment.
- **n2. Two tests encode M1's behavior** (`app/test/ladder.test.ts:28-31`, `server/test/ladder.test.ts` "a left-out account still
  sees its own place"). Update them with the fix so they guard the quiet pool rather than the leak.
- **n3. Rows are `<button role="listitem">`.** The role override drops the button semantics for screen readers (a row is a link to a
  profile), and the row's `aria-label` leaves out "You". A `role="list"` with `<div role="listitem"><button>` keeps both.
- **n4. `ranked_1v1_board`'s `DESC` columns aren't needed** (SQLite walks an ascending index backward for `ORDER BY … DESC`). Harmless;
  leave it, since changing it now means a new index name.
- **n5. A newly banned or pooled player stays in the shared list for up to `cacheSeconds`** (and `topPlace`'s per-instance minute).
  That's fine; worth one line in ranked.md's ladder entry so nobody files it as a bug.

## Test checks changed by the PR (old → new)

- `e2e/desktop-board.spec.ts` and `e2e/home-layout.spec.ts`: the side menu's expected items gain "Ladder" between Play with friends
  and Daily Quests. Neither is a guard in `docs/rules/eric.md`; the home-ranked guard ("home's options panel is always there … home
  never moves") is untouched.
- New: `e2e/home-ranked.spec.ts` "the season ladder …", `packages/server/test/ladder.test.ts`, `packages/app/test/ladder.test.ts`.
