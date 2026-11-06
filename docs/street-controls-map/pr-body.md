# Street town: hold to run, locking a new view, a minimap, and the third zoom step by default

Eric's notes after round 5 (Nov 5). Still the admins' street town only (`STREET_TOWN`); today's town is unchanged.
Decision note: `docs/decisions/2026-11-05-street-controls-map.md`. Area page: `docs/areas/town-square.md` ("Controls and the minimap").

**Lane: full e2e** (the director's call in the brief): please add the `full-e2e` label.

## What changed

- **Three gestures** (`town/press.ts`), told apart by the drag threshold and a hold time (`feel.ts streetHoldMs`, 180 ms, timed from
  the pointer's own event time):
  - a quick tap walks;
  - a press that moves first looks round;
  - a press held still runs.
- **Hold to run** (`town/run.ts`): you run the way your finger is from your pawn, snapped to up, down, left or right of the view, at
  once. It holds that arrow, so it's the arrows' walk: same pace, same card at a home's door.
  - Moving the finger changes the way and never turns the camera.
  - Letting go stops you at the next square.
  - Mouse: the left button.
  - The way is measured from where your pawn stands still, not from where it's drawn mid-run (the camera's follow lets it lead by
    about a square).
- **Locking a new view** (`turn.ts`):
  - A look round let go within 10° (`streetSnapDeg`) of north, east, south or west eases there exactly (`streetSnapMs`).
  - If your next move is a tap or a run, that becomes the base heading. The arrows, the screen step and runs follow it.
  - Not snapped, or an arrow first: your first step eases back, as before.
  - North again as the town opens and after a building's in and out (`freshView`). A home's strip turns the view but leaves the base
    alone (the decision note says why).
- **The minimap** (`town/minimap.ts`, `TownMap.tsx`), built from the plan's data (`street.ts`: ground, lots, walls, park, Colosseum):
  - **Small:** top right, 26% of the width on a phone, 13% in a computer's frame (at most 168 px), 70% opaque, rounded. Your dot shows an
    arrow the way the camera faces, and the Colosseum is a band on the top edge. No labels.
  - **Where the chat takes the box's whole top** (a narrow computer frame, 1024 × 700), it sits just under the chat.
  - **Cost:** drawn once a size; each frame only the dot's transform moves.
  - **Large:** a tap opens it in the middle with every boss home's portrait (the chips' faces), the park and Colosseum icons, and your
    dot. A tap anywhere closes it, and it never walks you.
  - **The map button** sits in the town's icon row and turns it off and on. The choice is stored per device and on by default, and the
    button is greyed inside a building.
- **The default zoom:** Eric answered the director's question ("we're going with number three for the default"), so the town opens at
  the third step (`streetZoomStart` 2). The park's step out goes from there to the overview. The rows' culling stays at the steps it was
  built for (`zoom <= 1`).
- **Merged with the north edge (#511):** the minimap follows its plan (54 × 54, the start at (22, 25) in the park, the back wall with
  its two gates as lines on the top edge). The Colosseum is a thin band on that edge over its columns, and its walls and the plaza's
  (ground `W`) are dark. The boss portraits sit where the homes now stand. `pick()` keeps both the minimap's box and the north edge's
  guard for fronts.
- **Test hooks:** `__townCam()` gains `base`, `snapped`, `gesture`, `run` and `you`.

## Player-visible changes (admins' street town only)

- A press held still runs you; sliding the finger steers the run.
- A look round let go near a quarter snaps to it; a tap or run then keeps that view.
- The minimap is on by default (top right), with a large view on a tap.
- A new **Map** button: its label "Map", its tooltip "Show the map" / "Hide the map". The small map's label is "Open the map"; the large
  map's is "Map of the town".
- The town opens one zoom step further out.

## Changed checks (old → new)

No check that guards a rule in `docs/rules/eric.md` changed.
- `e2e/town-fixed.spec.ts`, `e2e/town-rows.spec.ts` (and the new spec): the look-round `drag` helper (its first move at least 16 px,
  past the 8 px drag threshold) used `page.mouse` down then moves →
  `lookDrag` (`e2e/helpers.ts`), which sends the press and its first move to the browser together. On a slow software-WebGL frame, a
  press that waited longer than the hold time for its first move became a run.
- `e2e/town-fixed.spec.ts` "a tap while turned": `drag(page, 0.5)`, look > 60 ("a quarter turn") → `drag(page, 0.4)`, look > 60 and
  < 80 ("most of a quarter turn", "not snapped to east"). A half-width drag is exactly 90°, which now snaps.
- `e2e/town-rows.spec.ts` "the zoom steps": opens at `zoomTarget` 1 and one "Zoom in" → opens at 2 and two "Zoom in"s.
- `e2e/town-rows.spec.ts` "the park zooms a step out": opening step 1, park 2, `parkBefore` 1 → opening 2, park 3, `parkBefore` 2;
  "+ in the park" once → twice (your press still wins: back out at 1).
- `e2e/town-street.spec.ts` "opens at its default zoom step": `zoom`/`zoomTarget` 1 → 2.
- `packages/app/test/town-rows.test.ts`: `streetZoomStart` 1 → 2.
- `e2e/town-rows.spec.ts` "no sky between the fronts at street level": now zooms in once to the mockup's step (1) first. The town
  opens at step 2 since Nov 5, which sees over the rows, so the check failed there.
- `e2e/town-rows.spec.ts`, after the merge: the north edge's rows (Fountain Street at 28, South Street at 13) with this branch's
  zoom steps (opening at 2).
- New: `packages/app/test/town-controls.test.ts` (28 tests) and `e2e/town-controls.spec.ts` (phone and computer, 2D and WebGL), added
  to the town area in `e2e/areas.json`.

## Frame rate

The same build, minimap on vs off (the stored choice), Canvas 2D, headless. Phone (iPhone 13) and computer (1440 × 900), 5 s walking
east along Fountain Street from (3, 20) into the park, 2 runs each, interleaved. The machine was shared and loaded, so the numbers are
rough: one pass, cut short by the pause.

| | Map on | Map off |
| --- | --- | --- |
| Phone | 55.5, 55.5 | 53.7, 57.0 |
| Computer | 53.5, 52.6 | 53.5, 56.5 |

Within this machine's noise. The map adds no drawing to the world's frame. Each frame it sets one CSS transform, and only when your dot
moves a quarter pixel or turns half a degree. WebGL wasn't measured: the run was lost when the disk filled. Worth one run each in a quiet
moment, or the director's call.

## Stills and GIFs (`docs/street-controls-map/`)

- `1-minimap-small-{phone,desktop}.png`, `2-minimap-large-{phone,desktop}.png`
- `3-hold-to-run-turn-phone.gif`: hold to run right, slide up mid-run
- `4-look-snap-lock-phone.gif`: a look round let go near east, the snap, a tap locking it in, the up arrow going east
- `5-park-step-out-{phone,desktop}.png`: the park from the new opening step's step out (the overview)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
