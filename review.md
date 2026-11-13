# Review: PR #676, the street town for everyone (old town deleted)

Independent, read-only review of `origin/claude/street-for-everyone` at `d1e6c03a` against `origin/main` (`1bb9b73b`).

## What I ran

- `npm run typecheck`: **passes**.
- `npx vitest run packages/app`: **passes**: 176 files, 2,434 tests. (I also ran a throwaway probe of a player's town, described below; it was deleted afterwards.)
- No e2e runs (per the brief). The PR's `full-e2e` CI run was still in progress when I checked.

## Summary

The old Canvas 2D town is out of players' reach:

- No URL parameter, switch or fallback reaches it.
- `painter2d` now runs only under the failure message, and no frame is drawn there: `loading` is false, `frame()` returns on `failed`, and the `else if (!failed)` branch is skipped.
- Every `STREET_TOWN` branch is gone, and typecheck finds nothing that still points at deleted code.

A player's town checks out in a probe with `ADMIN_TOWN` mocked off:

- Timber's, Dash's and Rolling Dough's lots carry look-alike fronts.
- Their door squares, rest squares and wander squares are walkable sidewalk.
- No new bare lot squares show, except 4 behind Dash's fronts at row 43, in line with the row's own back strip.
- Bots, sidekicks (filtered by `HOMES`), chat, doors, the Colosseum, the minimap, music, guests' limits and the Hidden Boss's walk-up are all still wired.
- Admins and players now share one set of coordinates in the `town` room. Before, admins on 54 × 54 and players on 46 × 46 shared it, so this also fixes the presence mismatch.

The findings:

- **Blocker:** one e2e test will fail.
- **Major:** a town that can't run keeps the player present forever.
- **Major:** one guard check was loosened below the bug it guards.
- **Minor:** five smaller items.

---

## Blocker

### B1. `e2e/town.spec.ts:730`, `:743`, `:752`: the "a bot sitting at a table" test still expects table 6 at (18, 13)

The test was moved to table 7 (`seat(page, 7, 1)`, `sitter = …find((b) => b.table === 7)`, `you` at `20,26`). Three assertions were left on the old town:

- `:730` `expect(…sitter…!.table).toBe(6)`
- `:743` and `:752` `toMatchObject({ at: "18,13", table: 6 })`

**Failing case:** the phone project (the test is `@phone-only`). The bot seated by `__townSeat(7, 1)` sits on table 7's west stool, (18, 26), with `table: 7`, so `:730` fails at once. The PR body says all 154 town tests passed on the phone. This test can't have passed as pushed, so either it wasn't in that run or a later commit regressed it.

**Fix:** `table` should be 7 and `at` should be `"18,26"`. The street town's table 7 is at (19, 26), with stools at (18, 26) and (20, 26).

**Related comment fix:** the comment at `:484` says "table 10, square (19, 24), its stools (18, 24) and (20, 24)". The test uses table 7, and its stools are on row 26 (the assertion at `:499` is right). The comment should say table 7, (19, 26).

---

## Major

### M1. `packages/app/src/town/Town.tsx:582`, `:608`: a town that fails holds the away clock forever, so the player stays in everyone's town and is never dropped

`loaded` turns true only through `onLoading(null)`. When the town fails, `onFail` runs instead and `onLoading(null)` never does. That happens on "Chess Town can't run on this device." (no WebGL 2) and on "The town didn't load. Please retry." `busy()` then stays true for the life of the page.

`AwayClock` then works like this:

- `setBusy(true)` → `idleMs()` is always 0.
- Every beat (`TOWN_AFK.beatSec`) tells the server the player just acted.
- `TownHere` resets `idleSince` on each beat, so it never reaches the "zzz" or the boot.

**Failing case:** a signed-in player on a phone without WebGL 2 opens `/town` and leaves the tab in front. They see only the message. Meanwhile:

- Every other player sees their pawn standing at the start (22, 25), never "zzz", for as long as the tab stays open.
- The pawn takes one of the `TOWN_AFK.maxShown` places.
- It likely counts toward the town's live presence.

Before this PR, a broken town was an admin's only, and its away clock still ran out to home. This PR makes the broken state reachable by every player (Eric: "they just can't play"), so the leak is new in practice.

**Fix (smallest):** don't watch or beat at all once the town has failed. For example, have `onFail` call a `stopAway` that is in scope, or keep a `brokenRef` and make `watchAway` a no-op when it is set. At minimum, change `busy` to `!loaded && !broken`.

**Test:** a unit test on `watchAway` with `busy` stuck true, or a few lines added to the no-WebGL 2 test in `e2e/problems.spec.ts`: no `/api/town/here` beat, or one with `leave`.

### M2. `e2e/shop.spec.ts:309`: the "?fps in a room" check is loosened below the bug it guards, and its comment disagrees with the code

- **Before:** `> room / 5`, about 12 against 60 fps inside.
- **Now:** `toBeGreaterThan(3)`.
- **The new comment says:** "> 5 … a reading spanning the whole visit read 1 to 4, so 5 tells them apart."

With `> 3`, a reading of 4 passes, and 4 is inside the bug's own range (Eric's iPhone, Nov 11: "2-4 going out"). The check no longer reliably catches the regression it was written for. Commit `c25b7cf2` ("looser shop fps bound") moved it from 5 to 3 after the comment was written.

**Failing case:** reintroduce the Nov 11 bug (the pill's first reading out spans the whole visit) on a run where it reads 4. The test passes.

**Fix:** keep the threshold above the bug's range (≥ 5, as the comment argues). If software WebGL on CI really reads 4 to 5 in the first second out, measure a later second or read the second reading rather than lowering the bound. Either way, make the comment and the code agree. This is a guard check changed for a reason the PR body doesn't list under "Changed checks".

---

## Minor

### m1. `packages/app/src/town/Town.tsx:615`: a guest's 30 s town time runs under the loading screen

`watchGuest` starts at mount. The PR moves the away clock and a boss's goodbye to start once the town is drawn, but not the guest's clock.

**Failing case:** a guest on a slow phone. The loading screen alone takes 1.4 s to 5 s or more (perf.spec's numbers; Eric accepted "3 or 5 seconds"). That is up to about a sixth of their 30 s spent before the town is playable.

Before this PR, a guest's old town had no loading screen, though its first frame took about 1.7 s to 2.9 s.

**Fix:** start `watchGuest` from the same `loaded` moment, for example by starting it in the `share === null` branch. A broken town should not burn guest time either.

### m2. `e2e/perf.spec.ts:442`: a player's time to a playable town is no longer bounded

- **Before:** a player's town was held to tap → first frame < 2.5 s.
- **Now:** only tap → loading screen < 3 s. `loaded` is logged and not asserted, so only the 90 s `data-ready` timeout bounds it.

The intent was "the town is quick to play for a player". The admin case was already unbounded, but this PR moves every player onto it.

**Fix:** add a loose bound on `loaded`, for example under 8 s on the slowed phone (Nov 10 measured about 1.4 s headless), so a load regression for every player shows up in the `@perf` run. The PR body also says "Not re-measured after the change". The frame-rate rule in `docs/rules/eric.md` asks for a measurement against main when what the town draws changes, and it does change for players: 2D to WebGL, three homes swapped for fronts. One measured pass of the player's town on the phone, against an admin's on main, would close this.

### m3. `e2e/town.spec.ts:105` (the deleted lines were on main around `:121–137`): "Back to me" lost its only check of what it does

The removed half dragged, then checked that the button brought the camera's focus back. In the street town a drag turns the camera about you rather than moving it, so that check can't be ported as written. But nothing else in e2e taps `.town-recenter` and checks the result. `town-controls.spec.ts` checks only its placement.

What `recenter()` does now (`Town.tsx:2414`): it ends a `glide`. It doesn't ease a snapped look round back.

**Fix:** move the check rather than drop it. Glide away (`__townGlide`, or a minimap home), tap "Back to me", and expect `__townCam().focus` within about 2 squares of you. Also decide whether it should call `look.back()` too: after a drag that snapped to south, "Back to me" currently does nothing you can see.

### m4. `packages/app/src/town/Town.tsx:2391–2396`: dead branch

`else if (!failed) { preloadMusic(); onLoading(null); run(); draw(); }` runs only when `painter.kind !== "webgl"` and the town hasn't failed. That can no longer happen, because the 2D painter now exists only after `fail()`.

It's harmless today. But it is the one remaining path that would run frames on a 2D painter if `makePainter` ever changed. Deleting it, and setting `let loading = true` at `:1371`, finishes the "nothing old to exploit" goal.

`render.ts:1433` (`softenBand` when `paint.kind === "2d"`) is likewise unreachable now.

### m5. `e2e/town-tags.spec.ts` (around `:180`): Eric's name-tag rule's guard now walks through a test hook, not real taps

The fade-with-distance test used to tap the canvas. It now calls `__townWalk`. The intent (the tag fades as you walk away, square by square) is kept, and the rule's guard text in `eric.md:135` still names this test, so this is acceptable.

But `.claude/LESSONS.md` asks for real taps on movement changes. A tap on a clear lane (column 24 from the start, which the PR already uses elsewhere) would keep the guard closer to what a player does.

---

## Checked, no finding

- **Old-code reachability:**
  - The `?street=off` switch is gone.
  - No other town query switch selects a backend.
  - The town's canvas gets `painter2d` only inside `makePainter`'s failure path.
  - `boss-challenge.spec.ts`'s Folio no-WebGL case now exempts `.town-canvas`, and the clone made on failure keeps that class.
- **Admin-first homes in a player's town:**
  - `lotHere` and `HOMES` agree for every id (`blitz` → `dash`).
  - `TOWN_BOTS` filters the admin-first sidekicks.
  - `ALL_HOMES` now gives a missing home its plan lot, but it is used only by `HOMES` and tests.
  - `town-player.test.ts` covers the lots, the fronts and full walkability.
- **Rolling Dough:** `BOSS_ADMIN_FIRST` is `["timber", "dash", "zebra"]`. Rolling Dough is Zebra's shop, so a player loses that shop's lot as well. This matches what `HOMES` already did on main.
- **Eric's rules (`docs/rules/eric.md`):**
  - The no-old-fallback rule's guard text is updated, and the test still runs on both projects: a guest on the phone, an admin on the computer through `asServerAdmin`.
  - The door rule's unit guard keeps its intent, now on each home's door square.
  - No other rule's guard names a test this PR renamed.
- **The Hidden Boss (#673):** the room's server takes the room's squares only, not town squares, so the town's coordinates changing doesn't touch it.

---
_Generated by [Claude Code](https://claude.ai/code)_
