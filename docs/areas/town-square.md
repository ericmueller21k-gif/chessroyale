# The town square (/town)

Boss raid's coming home: a small round world where players walk around and meet the bosses at their homes (the plan:
`ROADMAP.md`, "Boss raid: the town square"). **Slice 1** is the world alone, on a hidden address: the sky, the curved
ground, five boss homes with their bosses roaming near them, six bots and you. Nothing links to it yet; open
`hunchess.com/town` (behind Cloudflare Access like the rest of the site). Phone and computer.

## How it works

- **The page.** `App.tsx` mounts it at `/town` the way it mounts `/autochess`; `town/TownPage.tsx` loads the rest with a
  dynamic `import()`, so none of its code, art or styles are in the main bundle. The back button goes home (and the
  address back to `/`). Stockfish isn't warmed on this page.
- **Layout.** A slim bar (the back button and "Town square"), then the world fills the rest of the screen. The world never
  assumes a screen size: it fills its box and works its camera out from the box's shape, so the panels Eric designs
  around it can change without touching it. The back button, the zoom pair and "Back to me" stay put.
- **The camera** (`town/camera.ts`, pure math): a pitched pinhole camera over a ground that drops away from the focus
  point (a small round world), cut at a rim that forms the horizon. Two tuned sets, the phone's and the computer's,
  blended by the box's width / height (0.6 = all phone, 1.4 = all computer). Zooming out raises the camera, moves it back,
  pitches it down and lets the rim reach further. The world is 40 × 40 squares and wraps both ways. A tap picks the
  nearest drawn square under it (`pickSquare`). The far band of ground dissolves into the sky; things in it fade, haze
  and blur, and are drawn whole, never cut by the rim.
- **The world** (`town/world.ts`): the homes (3 × 3 plots), the walk (square to square, around the homes, by
  breadth-first search), the bosses' roaming and their lines (their `SELECT_LINES`, one at a time, only from a boss on
  screen), and the bots. **Everyone in the square is a `Person`** (`{ id, name, look, you, walker }`) in one list,
  `town.people`; the bots are one source that moves its people. The drawing and the taps read only that list, so real
  players (rooms of up to about 75 to 100, fed by a server, later) can replace the bots without touching either.
- **The drawing** (`town/render.ts`): one canvas, one `requestAnimationFrame` loop (in `Town.tsx`), stopped when the screen
  closes or the tab is hidden; device pixel ratio capped at 2; nothing allocated per frame on the hot path (square colors,
  fonts, gradients, clouds, pawns and every boss and home frame are made once, the frames the first time they show).
- **Taps.** A square: you walk there. A home, a boss or a bot: you walk to the nearest free square next to it. Drag to look
  around; "Back to me" brings the camera back; − / + (and the mouse wheel) zoom. The chips at the box's edge show the
  bosses whose homes are off screen (nearest first); a tap glides the camera there.
- **Names.** Each home's name is written by the game, never drawn into its art, two ways for Eric to compare (each one
  line in `feel.ts` to turn off): floating over the home, landmark style, as you come within a few squares
  (`floatingNames`), and on its sign board in the game's pixel font, only when it's big enough to read (`signNames`).

## The feel: `town/feel.ts`

Every number that shapes how it feels is in `TOWN_FEEL`, one line each: the walk (90 ms a square, the hobble), the camera
sets, the zoom, the camera's follow and glide, the drag, the haze, the clouds' parallax, how often bosses roam and talk,
how often bots walk, the sizes, the names. The prototype's own value is noted wherever slice 1 changed one.

## Adding a home

1. Draw it in `town/houses/<boss>.ts` like the others (the game's pixel art: `characters/sprite.ts` parts and frames,
   painted with `houses/kit.ts`), about 144 × 120 pixels standing on its foot, with a blank sign board (`signBoard`) and
   an `idle` of a few frames. Export the `Character` and its sign's face (`signFace`).
2. Add it to `HOUSES` in `houses/index.ts`, its boss's sprite to `BOSS_ART` in `render.ts`, and a `Home` to `HOMES` in
   `world.ts` (its id, its boss's name, its name, its chip color and its plot's middle square).
3. Look at it at real size and at 2× (`npm run preview:characters -- <dir> extra=packages/app/src/town/houses/<boss>.ts
   only=house-<boss> looks=none`), and in the square.

## Files

- `packages/app/src/town/`: `TownPage.tsx` (the lazy load), `Town.tsx` (the screen, the loop, input, chips), `camera.ts`,
  `world.ts`, `render.ts`, `feel.ts`, `town.css`, `houses/` (tiger, gingerbread, grex, hollow, moo, the kit and the index).
- References: `docs/mockups/town-square/` (the prototype Eric tested, and his pictures for the igloo, the peak and the
  meadow).

## Tests

- `packages/app/test/town-camera.test.ts`: the projection (the focus in the middle column, wrapping both ways, a tap picks
  the square drawn there, far squares shrink, zooming out shows more rows, the phone / computer blend), the walk around a
  home, and the eased steps meeting the even ones at the same speed.
- `e2e/town.spec.ts` (phone and desktop; `e2e/areas.json`, "the town square"): the page loads, the world is drawn and
  fills its box, a tap ahead walks you there, the zoom pair works, back goes home. Test hooks: the canvas's `data-you`
  (your square) and `data-ready` (a frame is drawn).

## Not built yet

The bottom strip, cards ("Challenge alone", "Invite to party"), the shop, the Arena, the other bosses' homes, dressed
pawns, the Simple map setting, real players and rooms, sounds.
