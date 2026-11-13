## The street town for everyone; the old town gone

Eric (Nov 13): "The old town should never load because people could exploit something ... if the current town doesn't load and it's genuinely because they can't run it, then they just can't play." PR #675 stopped admins falling back to the old town; this makes the **street town (WebGL 2) every player's and guest's town** and takes the old Canvas 2D town out of players' reach entirely.

**Please add the `full-e2e` label** (full lane: it changes what every player sees and most town specs).

### What changed
- **`STREET_TOWN` is gone.** Every town — a guest's, a player's, an admin's — is the street town. `ADMIN_TOWN` still gates only the admin-first bosses' homes (core's `BOSS_ADMIN_FIRST`: Timber's, Dash's, Rolling Dough) and admin tools.
- **The old Canvas 2D town's code is deleted** (preferred: less code, nothing old to exploit): its 46×46 layout, park plan, ten park lamps, start (22,17), zoom-out camera, drag-to-pan, the far-Colosseum draw, and the old Colosseum picture in `houses/coliseum.ts` (the street town's ring keeps only the parts it reuses — the tablet, relief, banners and flags). `painter2d` stays only as the blank canvas under the failure message (no frames run there). ~1070 lines removed, ~400 added.
- **A player's town has no half-built admin-first home.** Their lots are left out before the rows are laid (`street.ts` `lotHere`), so each row fills the place with look-alike fronts, as anywhere else along it. Before this, a player would have seen a roof with no front where Timber's/Dash's/Don's home sits.
- **A boss's goodbye and the away clock start once the town is drawn,** not under its loading screen (every town has one now): a short AFK limit no longer drops you before the first frame, and Alfil's "Good game" bubble isn't missed while the loading card is up.

### Gaps checked (everything the old town did for players)
All present on the street town: the bots and their turns, chat bubbles and the chat log, homes and door-taps, the Colosseum and its statues, the minimap (now shown for everyone), AFK/zzz and the server-side drop, music, the Hidden Boss's walk-up, and guests' limits (watch, read chat greyed, 30-second gate). The minimap/map button is now everyone's (nothing hidden). No gaps found that needed new work.

### Tests — changed checks (old → new)
- `packages/app/test/town-world.test.ts` — the generic mechanics (one-pawn-a-square rings, home-door walk, the park's tables, the Colosseum solid) moved onto the street town; an open spot `(28,13)`; **Eric's door rule** kept, now checked on each home's door square.
- `town-timber.test.ts`, `town-dash.test.ts` — rewritten: the lodge/store layout checks live in `town-street.test.ts`; these keep Rivet/Tick among the bots with the street lot's door.
- `town-camera.test.ts`, `town-lights.test.ts`, `town-bots.test.ts`, `folio-wired.test.ts` — onto the street town (home at `(28,13)`/`(53,3)`; the lamps are the street town's; bots' doors are the lots' entries; Folio's gap to the Colosseum measured both ways).
- **New:** `packages/app/test/town-player.test.ts` — a player's town has every home but the admin-first ones, their lots become the row's look-alike fronts, and the town stays fully walkable.
- e2e: `town.spec.ts` (gate row 41, table 7 by the start, Folio's door `(26,16)`, statue glide to the plaza, the arrow-keys and ride on a clear lane), `town-tags.spec.ts` (walk a clear lane so the fade is caught), `town-street.spec.ts` (the opening test is now a player's too, on WebGL), `shop.spec.ts` (Babur's door `(9,39)`, the drag/report/fps checks), `boss-challenge.spec.ts` (Folio's WebGL-off crumple keeps the town's own WebGL), `problems.spec.ts` (no-WebGL-2 is a player's on the phone), `perf.spec.ts` (both cases are the street town's loading screen).
- Run locally: typecheck; app unit tests (176 files, 2434 passing); the town e2e specs on the **phone** project under the e2e lock, in two
  passes covering all 154 (first pass 7 failures, second 14, all old-town assumptions), then each failing test re-run after its fix: all
  green. A final full rerun was cut off by a container restart. **Not run locally: the desktop project** — the `full-e2e` CI run covers it.

### Frame rate
Before (main, this machine, 4x-slowed phone): a player's old town 2877 ms to its first frame (over its 2.5 s budget here), longest task
1151 ms; an admin's street town 1812 ms to its loading screen, longest task 874 ms. After: both cases are the street town (the spec now
times a player's and an admin's loading screen, < 3 s, longest task < 2 s); not re-measured after the change, as the reruns were spent on
the town specs. The street town is heavier per frame than the old town; on the guest's side it is the same drawing admins already had.

### Docs
- Decision: `docs/decisions/2026-11-13-street-town-for-everyone.md`.
- `docs/rules/eric.md` ("The town never shows an old version") updated: the street town is everyone's, the old code is gone; its guard moved to the player-on-phone / admin-on-computer form.
- `docs/areas/town-square.md` updated.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRvf6UnWNVv6iG4b6zw
