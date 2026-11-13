# Delta re-review: PR #676 (the street town for everyone), the review round and the CI round

Independent, read-only re-review of `origin/claude/street-for-everyone` at `95135cb7`. It covers the first-parent commits after `d1e6c03a`:

- the review round: `70c3d7e0`, `47cb85d2`, `96c79e5d`, `562dfc78`;
- the CI round: `2377dd02` through `2b406345`, plus the PR body (`ff9e5a91`).

I left aside the files that came in from main through the merges (the Hidden Boss work and Ginger Igloo's key walk, `ca1442fa`, from #686).

## What I ran

- `npm run typecheck`: **passes**.
- `npx vitest run packages/app`: **passes**: 179 files, 2,472 tests.
- The repo's typecheck doesn't cover `e2e/`, so I also type-checked the changed specs and `helpers.ts` with DOM libs. The changed lines have no errors; the errors it did show are all in code this PR didn't touch.
- I ran no e2e tests. I read the CI logs of run 43519221586 (shard 10, the only shard with a non-passing test).

## Summary

The first review's findings are fixed as the PR body says:

- **B1:** the table-7 sitter's checks are now 7 and `18,26`, and the `:484` comment is right.
- **M1:** `busy` is now `(!loaded && !broken) || …`.
- **M2:** the bound is back to `> 4` (5 or more), and the comment agrees.
- **m1:** the guest clock starts once the town is drawn.
- **m2:** a player's first frame is held under 8 s.
- **m3:** "Back to me" has a moved check, and it now also eases a snapped look back.
- **m4:** the dead branch and `softenBand` / `softenFarBand` / `BLUR_OK` are deleted.

`tapInTown` / `townTapPoint` are sound. The game-code changes are correct, and `addTestPlayer` is reachable only from the test hook.

The marble statue flake **is caused by this PR**, and it isn't a slow-runner wait. It is a mid-ease read that this PR added. Main turns red on a test that passes only on its retry, so it should be fixed before merging.

The findings:

- **Blocker:** 1 (the statue test).
- **Minor:** 3.
- **Nits:** 2.

---

## Blocker

### B1. `e2e/town.spec.ts:435` (the marble statue): `before.zoom` is read while the zoom is still easing, so `:464` fails

**What CI showed.** Run 43519221586, shard 10. The test failed once on each project and passed on the retry. The error was the same both times:

```
Error: the − / + zoom itself is untouched      (town.spec.ts:464)
  phone:   Expected 1.0025963445364487  Received 1
  desktop: Expected 1.2601485920002657  Received 1
```

**The cause.** After "Zoom in", the test polls `(await cam(page)).zoom` until it is `< 2`.

- In the street town, `__townCam().zoom` is `zoomCur`, and `zoomCur` eases (`Town.tsx:1563`, `zoomCur = sz.at(now)`) from step 2 to step 1.
- So the poll passes on the first read after easing begins, and `before = await cam(page)` stores a value still on its way to 1, such as 1.0026 or 1.26.
- By the close-up, the zoom has settled at 1, so `expect(close.zoom).toBe(before.zoom)` fails.
- On the retry the read happened to land after the ease had finished.

The bronze statue doesn't zoom in, so it never hits this.

**It's this PR's change.** Main had `.toBe(0)`, the old town's settled zoom. Commit `5498cf73` in this PR changed it to `toBeLessThan(2)`. The same unsettled `before.zoom` would also break `after.zoom` at `:476` if the close-up check ever passed.

**Fix (one line).** Poll until the ease has landed, for example:

```ts
await expect.poll(async () => { const c = await cam(page); return c.zoom === c.zoomTarget ? c.zoom : -1; }, { message: "zoomed in a step, settled" }).toBe(1);
```

`zoomTarget` is the step (`Town.tsx:1552`), and `zoomCur` snaps to it within 0.001 (`:1555`).

**Same test, same root pattern.** This test still uses both tap patterns that this PR's own decision note (`2026-11-13-street-town-taps-on-ci.md`) calls unreliable on CI:

- the "camera settles" check at `:446` compares reads 300 ms apart;
- the tap on the statue (`:449`) and the "tap elsewhere" (`:471`) use `page.mouse.click`, which sends the press and the release separately.

They didn't cause this failure. But moving the statue tap to `townTapPoint(page, "statue", st.id, 20_000)` plus `quickTap`, and the "tap elsewhere" to `quickTap`, would close the next flake before it happens.

---

## Minor

### m1. M1's fix has no test

The fix is right, and a town that fails after loading also stays correct (by then `loaded` is already true).

- **What's missing:** the review asked for a check that a failed town doesn't hold the player present. Nothing was added: no unit test on `watchAway` with `busy` stuck, and nothing in `problems.spec.ts`'s no-WebGL-2 test.
- **What's left:** a broken town still beats presence, shown as "zzz", until the away limit drops the player. That was the review's accepted minimum, so it's not a finding in itself.
- **Suggested test:** in `problems.spec.ts`, under `?afk=` short limits if the spec supports them, expect the out-to-home within the limit.

### m2. `Town.tsx:2430`: what "Back to me" now does to a snapped look is untested

`recenter()` now calls `look.back(now)`. That is correct (`turn.ts:163` clears `snapped` and eases the short way round). But the new check at `town.spec.ts:107–122` only covers the glide case, and nothing covers the snap: drag the view to snap a quarter, tap "Back to me", and expect `__townHeading` back at the normal heading.

This is a player-visible behavior change, so it should also be listed under the PR body's "player-visible changes".

### m3. The PR body is stale on two points

- **`47cb85d2` isn't listed as a game change.** The bot across your table now gets up `botLeaveAfterGameMs` after the first frame, not 4 s after the town was created. That is player-visible, and it's correct: `world.leave.at` uses the same `performance.now()` clock, and the world's `tick` doesn't run under the loading screen. The body's CI round lists only `addTestPlayer` under "Game".
- **A load-only failure it still lists is the one `47cb85d2` fixed.** Under "Left load-only and outside this change", the body still lists "town.spec's bot that gets up before its post-game check". If it still fails under load, say so. If not, drop it.

---

## Nits

- **Model names in commit messages.** The PR body says only `2377dd0` carries a model attribution line. In fact, `0be1538e`, `70c3d7e0`, `47cb85d2`, `96c79e5d`, `562dfc78` and `2377dd02` all carry `Co-Authored-By: Claude Opus …`. A merge commit keeps them in main's history. History can't be rewritten here, so correct the PR body's count, and make sure future commits leave the model out.
- **`perf.spec.ts:444`'s new bound hasn't been run.** CI leaves out the `@perf` run, and the PR body doesn't say the `< 8 s` bound was run locally. It's generous (Nov 10 measured 1.4 s to 2.1 s headless), so this is low risk, but one `--grep @perf --project phone` run would confirm it.

---

## Checked, no finding

### `townTapPoint` / `tapInTown` (`e2e/helpers.ts:631–713`)

- **The stillness check counts frames.** It waits for 3 rAF comparisons within 0.5 px, so a slow frame can't make a moving camera look still.
- **The point is one a finger reaches.** It must be 10 px inside the canvas, and `elementFromPoint` must find the canvas itself there.
- **Coordinates are read as found.** The page coordinates come from the canvas box at that moment, which fixes the stale box after a room's exit.
- **The tap can't turn into a run.** Press and release go out together on one CDP session.
- **Nothing is loosened.** Every assertion after the card opens is unchanged.
- **Retries are no looser than before.** The retry loop (another card closed, one glide, 3 s for the card, 60 s overall) matches the old per-spec loops (20 to 30 s, 1.5 s for the card), which also retried missed taps.
- **The waits are bounded, not hidden.** Each one ends in an `expect` with a message.
- **No wait masks a real bug.** A real hit-test regression still fails: the tap must open that exact card, and the point is the game's own `__townAt` tap point.

### The guard "a home's door (Eric, Nov 5)" (`town.spec.ts:1607–1619`)

Only how the tap is delivered changed:

- `tapInTown` replaces the glide-then-`mouse.click` loop, and it glides only if Folio's house isn't drawn and clear.
- The assertions are unchanged: row 16, within 1 column of 26, then the card.
- `docs/rules/eric.md:140` still names this test.

The PR body flags it for Eric's OK, as the rules ask.

### Game code

- **The guest clock (`Town.tsx:582–606`).** `startGuest` runs on `onLoading(null)`.
  - It is guarded by `gone.current`, so a load that finishes after unmount starts nothing.
  - A failed town never starts it.
  - The cleanup calls the latest `stopGuest`.
  - `t` is used only inside the timer's callback, so there's no temporal-dead-zone risk, since `onLoading(null)` is async.
  - `watchGuest` keeps `guestUsed` across mounts, so starting it later only stops the loading screen from counting.
- **The dead 2D code is gone.** The `else if (!failed)` start branch, `softenBand`, `bandCv` / `bandGrad`, `BLUR_OK` and `TOWN_FEEL.softenFarBand` have no remaining references (typecheck passes).
- **`addTestPlayer` (`world.ts:991`) is test-only.** Its only caller is the `__townPlayer` hook, which is gated by `testSwitchesAllowed()`, plus `town-card.test.ts`.
- **The bot leaving the table (`47cb85d2`)** is correct, as noted under m3.

### Other spec changes

- **The rides test:**
  - frame-counted `squareSettled`;
  - quick taps;
  - a narrower bot guard (it still covers the squares tapped and the squares in front of them);
  - the walk left in two taps;
  - the walk down by the walk hook (listed in the body's changed checks: a tap can't reach behind you on a phone).
- **Folio's doorway** is read from (29, 14).
- **The cards' looks** get a 3-minute timeout.
- **shop.spec:** Timber's and Dash's lots use `townTapPoint(…, 20 s)`, and `goIn` uses `tapInTown`.
- **Also moved onto `tapInTown`:** boss-challenge's `toConfirm` and town-leave's `openCard`.
- **town-tags** zooms out before the walk.

All are consistent with the decision note.

### CI run 43519221586

Every spec file ran on 15 shards (`full-e2e`). The only non-passing results were the two marble statue first tries described in B1.

---
_Generated by [Claude Code](https://claude.ai/code)_
