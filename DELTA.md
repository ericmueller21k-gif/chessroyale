# Delta review: PR #935's review fixes (the season ladder)

Read-only delta review of `fe44ac86..b83450a9` (fixes 370bb408..a8c092a1, then a merge of main) against `REVIEW.md` on
`review/ladder`. Read: the whole fix diff (server, core, app, e2e, docs), `fairplay.ts`'s status semantics, every caller of
`topPlace`/`rankOf`, every `PlayerProfileScreen` mount and `closeProfile` caller.

**Verdict: the fixes are correct and complete. No blockers, no majors.** Two new minors (one is the helper's own URL report:
worth fixing now, a few lines) and a few nits. The merge of main (b83450a9) changes none of the ladder's files; its only
overlap is `index.ts`'s duel lines (ranked colors).

## What I ran

- **Unit tests at b83450a9:** `server/test/ladder.test.ts` (21), `server/test/ranked-store.test.ts` (42), `app/test/ladder.test.ts`
  (5): 68/68 pass. `npm run typecheck`: clean.
- **A fuzz of `ladderFor`** (a throwaway vitest file, not committed) against a brute-force model of "an honest player in the same
  spot": the ladder with the viewer in it, sorted `ladder DESC, user_id DESC`, places from `ladderPlaces`, ranks from `rankView`,
  cut at 200. 16,000 random ladders over 4 seeds: 0 to 260 players, spreads from 1 RP (all tied) to 600, so ties at the 200 cut and
  rows across the Transcendent/Pearlescent lines are common.
  - **Left-out viewer** (shared top without them): **identical in every case**: rows, order among ties, places, recounted ranks,
    `total`, the cut.
  - **Honest viewer whose kept row is a minute old** (at a random older ladder): identical except the one case the tests already
    pin as intended (you dropped out of a full list within the minute: 199 rows; nit 1 below).
- **Mutations** (each reverted): `review` taken out of `LEFT_OUT` → 3 tests fail; no place shift in `ladderFor` → 4 fail; `total`
  ignoring `leftOut` → 2 fail; no append at a short ladder's bottom → 3 fail; `cameBack` ignoring how the profile closed → 1 fails.
  `openProfile` not clearing `backed` → nothing fails, but that line is redundant (the identity check in `cameBack` already covers
  it), so this is not a gap.

## The review's findings: each fix checked

### M1 + m4: each viewer's own copy (`ladderFor`): fixed, proven

`packages/server/src/ladder.ts:106-128`, `:79-90` (`ladderYou` reads `left_out` in its own query), `:163`.

**Can a pooled or reviewed player's answer still differ from an honest player's in the same spot? No.** Checked one by one:

- **Places and order.** The viewer goes in at `l < mine || (l === mine && r.uid < you.uid)`, the SQL's own order. Rows strictly
  below move one down, ties keep their shared place (`by = mine > l`). For a kept row the old contribution comes off
  (`- (was > l)`). The fuzz confirms it, ties included.
- **Ranks across the top-tier lines.** `movedTo` recounts each moved row's rank from its new place (`rankView` depends on `games`
  only for the placement check, so `games: PLACED` is exact). Test: "under review, in a full list across the Transcendent line"
  (p099 → #101 Pearlescent). The viewer's own rank comes from `placeOf`, the same count `topPlace` uses.
- **`total`.** `shown + 1` exactly when the shared count didn't hold the viewer (`counted`). A left-out viewer is never in the
  shared count, except when they were left out within the kept minute: then they're in the kept rows, so `kept !== undefined` and
  nothing is added. Test: "pooled within the kept minute".
- **The 200 cut.** Inside a full list: inserted, then the last row comes off. Below it: the same 200 rows as everyone, `total + 1`.
  A short ladder's bottom: appended (the old "2 ranked players over a #3 pin" is gone). All tested, and the fuzz covers ties at the
  cut both ways.
- **The kept minute.** `tops` holds only the shared top. `ladderFor` builds new arrays and objects and never mutates the kept
  ones, so one viewer's copy can't leak into another's.
- **The wire.** `Standing.leftOut` never leaves the server. The answer is `{ season, mode, total, rows, you }`, the same shape and
  the same queries for everyone (no timing difference worth the name), `no-store`.
- **m4.** Your row in the list is the same object as your pin (`expect(up.rows[2]).toEqual(up.you)`), so they can't disagree.
  Climbing and dropping within the minute are both tested.

What's left is a tell across screens, not inside the answer: see **D2** below.

### m3: `review` in `LEFT_OUT`: fixed, and nobody else's rank changes wrongly

`packages/server/src/ranked-schema.ts:106`.

- **One count everywhere.** Every displayed tier goes through `shownAbove` → `placeOf` → `topPlace` → `rankOf`: home's rank line
  and public profiles (`rankedSummary`, `ranked-schema.ts:192`, with the peak at `:193`), the queue's entrant (`ranked.ts:90`), the
  end screen's before and after (`ranked.ts:165`, `:286`), Squads' rank (`squads-do.ts:69`) and the ladder. So when a top player
  goes into review, everyone below them moves up one place in all of these at once, and they agree with each other. That's the
  intended effect, recorded in the decision note and in ranked.md. No other place count exists (grep for `ladder > ?` and `placeOf`).
- **The reviewed player's own rank is unchanged.** Their place never counted themselves.
- **Who else is affected.** Residents never get a case (fair play records them but never opens one), so they're never left out.
  `watch`, `cleared` and `closed` aren't in the list, so a cleared player comes back (after the kept minute). The IN over three
  statuses still uses `fairplay_cases_status`.
- **Not changed, for the record:** the profile's Top N% still counts players in review (`NOT_POOLED` leaves out only the pool and
  test accounts, `accounts.ts:1236`). That's a different ranking, and review already keeps its effect out by holding results.
  Consistent with `fairplay.ts`'s own description; no action.

### m1: LADDER vs Squads' taps: fixed, proven

`packages/app/src/styles.css:10691` (`.fd-ranked > .fd-modes { position: relative; z-index: 1 }`). Nothing moves (no offsets). It
also covers the search row in the same place (`.fd-modes.fd-search` is a direct child too). The walkthrough's spotlight is cut from
bounding boxes, not z-index, so the new stacking context doesn't hide a lit mode button. The e2e (`home-ranked.spec.ts`) first
asserts that the overlap exists (`right - left > 2`, `b.y + b.height > squads.y + 1`), so the check can't pass vacuously. It then
asserts that `elementFromPoint` on Squads' top edge, past the corner radius, is Squads. Nit: in the overlap columns LADDER's tap
box is effectively about 37 px tall, not 40 px.

### m2: a module `Map` instead of `caches.default`: fixed

`ladder.ts:134`. It follows the `topPlace` pattern, and the docs now say "at most one read a minute per instance", which is true
by construction (settings.ts `LADDER`, ranked.md, the decision note, `index.ts`'s comment). `waitUntil` was dropped cleanly.

### m5: Back keeps the list's place: fixed, proven

`packages/app/src/ladder.ts:39-56`, `profile-nav.ts:26-49`, `screens/Ladder.tsx:29-55`.

- **The scroll is kept apart from the answer's age** (`left`). After a minute the answer is asked for again, and the layout effect
  restores the place on the first frame that has rows. The e2e covers both cases: within the minute (no request, scrolled to the
  end), and after `clock.fastForward("01:05")` (exactly one request, still at the end).
- **The flag can't leak.** `cameBack` needs both the row's `left` and `backFrom()` to be that same target object, which only
  `profileBack` sets and `openProfile`/`closeProfile` clear. Every way of leaving a profile by something other than its Back
  (`goHome`, the town layer's open/close, ProfilePage's locker, settings, shop and friends) goes through `closeProfile`.
- **`forgetLadder`'s comment** no longer claims sign-in uses it.

### n1, n3, n5: fixed

- **n1:** the e2e asserts the radiogroup sits the label's 6 px gap below the label, which would fail if LADDER were in the flow.
- **n3:** each row is `<div role="listitem"><button>`, the label says "(You)", and the e2e checks the structure. `.ld-row` is a
  block-level grid, so the wrapper adds no line-box height and the ghost-to-loaded "nothing moves" still holds.
- **n5:** ranked.md has the line about the kept minute.

## Does `profileBack()` change Back anywhere outside the ladder? No

`profileBack` differs from `closeProfile` in one thing: it sets `backed`, which only `cameBack()` reads (`ladder.ts:55`). That
matters only when `left` is set, which only a ladder row does, and only for the identical target object that row created. The
listeners fire the same way and no URL handling changed.

- **Friends and their search, the town (overlay and layers), a match's podium and the duel/Squads overlays:** their Back behaves
  exactly as before.
- **Your own public profile's Back** still opens your own profile (`PlayerProfile.tsx:270`, `openProfile`). The ladder's own row now
  opens `{ uid, name }` with no `you` flag. `PublicProfileScreen` recognizes it as yours by its uid (buttons greyed), and its Back
  returns to the ladder, as intended.
- **One harmless leftover:** a row tapped, then a duel found while that profile is open, then its Back over the duel. That leaves
  `backed` matching, so the ladder shown after the duel opens at the old place. That's arguably right.

## New findings

### Minor

**D1. After a profile's Back on the front page the URL reads `/` while the ladder still shows. Worth fixing now: a few lines, and it
fixes the same pre-existing slip on `/friends`.**

`packages/app/src/App.tsx:2932-2943` (`ProfilePage`).

**Scenario (phone or computer, front page):**

1. `/ladder` → tap a row. ProfilePage's effect replaces the URL with `/profile/<uid>`.
2. Back runs `profileBack()`, then `replaceState("/")`.
3. `showLadder` is still true, so the ladder shows (at its place), but the address is `/`. A reload, a restored tab or a shared link
   lands on home.

`/friends` already has the same slip on main (a friend's profile, Back: the friends page at `/`). The ladder's own Back then sees
`/` and leaves it alone, so nothing else breaks.

**Fix:** put back the address the profile replaced. Capture it before the effect runs; it survives a profile-to-profile change
because ProfilePage stays mounted:

```tsx
// (The page under the profile keeps its address after the profile's own Back: /ladder, /friends; anything else is home's.)
const [under] = useState(() => (/^\/(ladder|friends)$/.test(location.pathname) ? location.pathname : "/"));
...
onBack={() => {
  profileBack();
  if (location.pathname.startsWith("/profile")) history.replaceState(null, "", `${under}${location.search}`);
}}
```

Add one line to the ladder e2e after the first Back: `await expect(page).toHaveURL(/\/ladder$/)`. Light lane. (The hash is
dropped by ProfilePage's own `replaceState`; that's pre-existing and harmless.)

**D2. A left-out player at the top can see a row's tier disagree with that player's profile, one tap apart (fair play's call:
accept and record, or make every shown tier viewer-relative).**

`ladder.ts:95` (`movedTo`) against `accounts.ts:1259` → `rankedSummary` → `rankOf` → `topPlace`.

**Scenario:** Transcendent is the top 100. P (pooled, or in review) is at #51 by their own count.

1. P's ladder copy, correctly for "as ever", shows the honest #100 X at **#101, Pearlescent**.
2. P taps X. X's public profile counts X's place without P (`topPlace`), so it reads **"Transcendent · N RP"**.

The same happens at the Pearlescent floor's line. Honest viewers only ever see this during a stale minute; for P it lasts. It's the
same family as the review's third-party note (a pooled friend's profile says Transcendent but they're missing from the ladder),
seen from P's side. Before this PR, P had no list to compare against.

Not recounting the rows in P's copy would be worse (#101 Transcendent, a tell on one screen). Closing it properly means
viewer-relative places wherever a tier shows (profiles, end screens), which is a lot of code for the pool's few. **Suggest:** accept
it, and add one line to the decision note and fair play's area page next to the third-party note.

### Nits

1. **The 199-row list** (`ladder.ts:123-124`; pinned by `server/test/ladder.test.ts:295-311`). Within the minute after you drop out
   of a full list, your copy has 199 rows: the next row down isn't in the kept list. There's a sub-case: with exactly 200 on the
   ladder and you dropping to its bottom, you're #200 of 200 but missing from the list. That's M1's old shape, for an honest player,
   for up to a minute. Barely visible, so leaving it is fine. If wanted, it's about four lines:
   - Keep `LADDER.size + 1` rows in `tops` (`LIMIT ?` with `size + 1`).
   - Set `whole = top.rows.length <= LADDER.size`.
   - Slice to `LADDER.size` in `ladderFor`'s early return too.

   This removes both cases, and the left-out paths stay as they are (re-run the fuzz/tests).
2. **`total` one short for a minute** (`ladder.ts:126`). If you finish placements, or are cleared, into the top 200 of a full list
   within the kept minute, `counted` assumes the kept count already held you. Benign.
3. **Back after hopping to another profile.** A profile reached from a ladder row's profile (in practice only via the computer's
   global chat beside it) returns to the ladder at the top. The test pins this as intended (`app/test/ladder.test.ts:84`). Before
   the fix it kept the place. Fine to leave.
4. **`openProfile`'s `backed = null`** (`profile-nav.ts:30`) is redundant given `cameBack`'s identity check. It's harmless; keep it
   as a belt-and-braces line or drop it.

## Test checks changed by the fixes (old → new)

- **`e2e/home-ranked.spec.ts`, "the season ladder …":**
  - LADDER's 40 px box and right-edge checks: phone only → both projects.
  - New: the row sits under the label's 6 px gap (n1); `elementFromPoint` on Squads' top edge is Squads, with the overlap asserted
    first (m1); the pin's `aria-label` has "(You)", and the list is listitems holding buttons, nothing else (n3).
  - Back from a row's profile: only "200 rows again" → the kept answer (no request) and the scroll at the end; then after 65 s, one
    request and the scroll at the end (m5).
  - Not a guard in `docs/rules/eric.md`. The home guard test in the same file is untouched, and the CSS moves nothing.
- **`packages/server/test/ladder.test.ts`:**
  - The edge-cache route test (a fake `EdgeCache`) → the Worker `Map` on the test's clock.
  - "a left-out account still sees its own place" asserted M1's leak (list `[1, 2]`, pooled place 2) → `ladderYou` returns
    `leftOut` for pool, review, banned and test, `place` 2 each time.
  - The LEFT_OUT test now includes `review`.
  - New: your fresh row in the list (up and down within the minute); dropped out of a full list (199 rows, pinned as intended);
    and the five cases of "a left-out viewer sees the ladder as ever" (byte-equal to the honest answer).
- **`packages/app/test/ladder.test.ts`:**
  - `rowsWithYou`'s tests are removed with the function. They pinned M1's leak, including "below the last place: never added".
  - `keepLadderScroll` is removed.
  - New: `cameBack` holds only for the row's own profile's Back, and is consumed once.
