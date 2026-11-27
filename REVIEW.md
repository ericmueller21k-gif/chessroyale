# Review: the Stranger's storm redrawn (branch `claude/stranger-storm-art`, head b302e5ca)

Quick boss-lane pass, read-only. Art and wiring only; no rule, timing or protocol change found in the diff (none claimed).

## Blockers
None.

## Should-fix
1. **The sheets are never released, and they're bigger than planned.** `packages/app/src/components/Stranger.tsx:331-347` (`sheets`, `sheetOf`)
   keeps both sheets in a module-level cache for the rest of the session: nothing closes the `ImageBitmap`s or drops `sheets.storm`/`sheets.rift`
   when his battle ends. Decoded size: storm 2040 x 1750 RGBA = 14.3 MB, rift 1616 x 808 = 5.2 MB, so **about 19.5 MB**, not ~12 MB.
   Failing case: play one Stranger battle, then go to the town or another boss: ~19.5 MB of bitmaps stay resident for good (a low-memory
   phone can lose tabs over it). Fix: a `releaseStranger()` that calls `.close()` on each bitmap and deletes the cache entries, called where the
   battle screen unmounts (BossCharacter's prewarm has the battle's lifetime). Other bosses' frame canvases are cached forever too, so this
   follows the house pattern, but the brief asked for release, and these two sheets are the biggest single item.
2. **The ring repaints every rAF even when nothing changes.** `Stranger.tsx:427-438` (`StormRing` `draw`) clears and blits 2 to 5 cells on every
   frame (60 Hz) for the whole storm, although in its turns (`scene === null`) the picture changes only at 12 fps (`ringFrame`) and `lead`
   changes once a turn. Each call also allocates a `level` object, three closures (`cell`, `own`, `twice`) and an array literal
   (`paintRing`, `Stranger.tsx:384-400`). Failing case: a 3-turn storm on a slow phone does ~5x the canvas work and steady garbage it needs to.
   Fix: as `StormRift` already does, keep the last `(frame, lead)` drawn and return early when unchanged while `scene === null`; hoist the
   closures. (The note's p95 about 22 ms at 4x says it's within budget, so should-fix, not a blocker.)

## Nits
1. `e2e/stranger.spec.ts:176-180`: the new checks fail without the change (no `__stormArt` on main), good. They don't check the rift's layer,
   though: drawing it over the pieces would still pass. One number check would guard it (the brief's "the rift under the pieces"): e.g.
   `getComputedStyle(.sg-rift).zIndex` is `1` and a `.hb piece` / `square.last-move` is `2`, read in the page as the storm shows.
2. `Stranger.tsx:356` comment says the opening ends "on stage 1", and `riftFrame` (`:458`) then loops frames 0-3, which the rest of the code calls
   stage 0 (`stage = p.turn - storm.at`, `:670`). Same frames, two names; say "stage 0 (whole)" in both places.
3. `styles.css` `.power-board .sg-dim`: a 200vmax box-shadow dims everything outside the board, the boss dock and buttons included. Taps pass
   (`pointer-events: none`). Check that it sits under the battle's end overlay / result card when a storm turn ends the battle (see Not reached).
4. Reduced motion: neither the ring nor the rift honors `prefers-reduced-motion` (both loop by the clock). The old ring didn't either, so not
   a regression; a still frame (frame 0 / the stage's first frame) would match `still` in BossEffect.
5. `Stranger.tsx:342`: no `img.onerror`; a failed fetch just leaves the storm without its ring and rift (silent, graceful). Fine, but a
   `console.warn` would make it visible in the e2e `errors` list only if wanted; leave as is if silence is intended.

## Checked
- Sheets load only for his battle: `sheetOf` is called from `prewarmStranger` (BossCharacter's prewarm, `kit.ch.id === "stranger"`) and the
  two canvases; the `?url` imports don't decode at boot. (Release: should-fix 1.)
- No canvas resize per frame: both canvases have fixed `width`/`height` attributes (250 and 202); sizing is CSS. `imageSmoothingEnabled = false`
  set once per mount.
- `StormRift` draws only when its sheet frame changes (`shown`), clears to nothing at -1, and its frame is from the clock and stage alone.
- Layering: `.board-wrap > .sg-rift` is z-index 1 with the other boss under-layers; square marks (`last-move`, `check`, `move-dest`,
  `selected`) and pieces are z-index 2, so they draw over it; fire's marked tiles are inside `.power-board` (z-index 2, `layer.over`), also over
  it. The ring stays at z-index 3 over the pieces, now 88% opaque.
- Taps: `.sg-rift`, `.sg-dim`, `.sg-storm` and `.power-board` are all `pointer-events: none`.
- Stage math: `stormOn` is `at <= turn < at + stormTurns`, so `stage = turn - at` runs 0, 1, 2 over the three turns; the scene's tail loops
  stage 0's frames, so the hand-off from scene to the first turn is seamless.
- Ending: both canvases stop their frame loop and reset `__stormArt` on unmount (resign, leaving the screen, the storm's last turn passing);
  the ring and rift are rendered only while `storm` (scene running, or `stormOn`), so a reconnect mid-storm redraws from the clock and stage.
- Solo and online: both boss battles render `BossScreen` (`App.tsx:2878`) with `moments`/`now`, the same path. `Crowd.tsx`/`Play.tsx` pass no
  moments, so there the rift shows its turn stage without the opening tear (same as the old ring's steady state there).
- No rule, timing, protocol or settings change; `e2e/areas.json` maps the new `.webp` files to the Stranger spec.

## Not reached
- The art itself (no stills or GIFs looked at; Eric approved round 4) and whether the rift's impact point lines up with `STORM_STAND`'s swords
  on both orientations and on a computer.
- The dim's stacking against the end-of-battle overlay when a storm turn decides the battle (nit 3), and a live reconnect mid-scene.
- `scripts/storm-art/*.py` (offline renderer) beyond a skim; not shipped code.
