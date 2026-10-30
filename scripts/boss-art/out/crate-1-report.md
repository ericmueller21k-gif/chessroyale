# Boss Series Crate #1: the art

Drawn by the Claude API through the runner's new item and rider modes (`scripts/boss-art/README.md`, "Crate items and
rides"), on Oct 30, 2026. Model `claude-opus-5-5` for every drawing. Nothing is in the game: the drawings are in
`scripts/boss-art/out/`, and no crate code was changed.

- **Contact sheet:** `scripts/boss-art/out/crate-1-sheet.png` shows every piece on a pawn at phone size, at rest and
  mid-motion. The colors shown are my picks; every color scheme comes free.
- **Previews:** `scripts/boss-art/out/crate-1-previews/` has the renderer's look for each piece:
  - the motion frame by frame at 4x;
  - phone size (a 60 px lobby pawn, the 130 px home pawn, the 64 px tile) beside existing items;
  - every color at 75% purity, 100% and shiny.

  Every frame is in `out/<id>/preview/frames.png` (a ride: `idle.png`, `move.png`). These are kept locally and not
  committed; the runner remakes them.

## The pieces

| Piece | Slot, tier (my call) | Model, effort | Real cost | How it reads | Drawing | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| Puddles' Hose | weapon, rare | Opus, medium | **$0.34** | A chunky two-loop garden hose with a brass nozzle; it rests 2.6 s, then a short squirt arcs out in drops. Plain and friendly. At 60 px the squirt is only a flicker. | `out/puddles-hose/puddles-hose.tsx` | `crate-1-previews/puddles-hose.png` |
| Riding Chirp | ride, mythic | Opus, high | **$0.80** | Cute green grasshopper with a saddle and blanket in the item's color, the pawn riding with its lower part hidden. The idle twitches its antennae and blinks; the town move is a clear crouch, spring, arc and land. | `out/riding-chirp/riding-chirp.tsx` | `crate-1-previews/riding-chirp-idle.png`, `-move.png` |
| Babur's Balloon | weapon, rare | Opus, medium | **$0.22** | A glossy knight-head balloon on a curly string, swaying slowly. Reads at 60 px. | `out/babur-balloon/babur-balloon.tsx` | `crate-1-previews/babur-balloon.png` |
| Alfil's Mantle | skin, epic | Opus, medium | **$0.32** | A regal caparison worn as a cape: the item's color in the field, a blue border inside gold trim, gold diamonds and tassels, the hem swaying. One of the strongest. | `out/alfil-mantle/alfil-mantle.tsx` | `crate-1-previews/alfil-mantle.png` |
| Jefferson's Firework | weapon, epic | Opus, medium | **$0.21** | A big banded rocket tube with a gold cap; the fuse at its tip is a small, fizzing sparkler. Clear, but the stripes echo the Candy Cane and Gift-Wrap Tube. A fatter rocket shape would set it apart. | `out/jefferson-firework/jefferson-firework.tsx` | `crate-1-previews/jefferson-firework.png` |
| Hollow's String of Lights | weapon, epic | Opus, medium, then one redo at high | **$0.98** (first $0.24, aborted starts about $0.08, redo $0.70) | First try: seven bulbs tangled over the pawn's body, with a faint glow (read badly). The redo is the one to use: one strand of five big bulbs hanging clear of the body, the lit bulb a white-hot core with a halo, chasing down the strand. | `out/hollow-lights-2/hollow-lights-2.tsx` (first try: `out/hollow-lights/`) | `crate-1-previews/hollow-lights-2.png` (first: `hollow-lights.png`) |
| Folio's Paper Crown | head, legendary | Opus, medium, then one redo at high | **$1.08** (first $0.33, redo $0.75) | First try: it floated above the head, the crane was cut off, and the crane was a smudge at 60 px (read badly). The redo sits on the head and keeps the crane under the cap, folding and unfolding its wings. The weakest piece: at 60 px the crane still reads as "something cream on top" more than a bird. | `out/folio-crown-2/folio-crown-2.tsx` (first try: `out/folio-crown/`) | `crate-1-previews/folio-crown-2.png` (first: `folio-crown.png`) |
| Moon's Ride | ride, mythic | Opus, high | **$0.52** | A sleepy-faced crescent moon on its back, in the item's color, the pawn sitting in its hollow. It floats with a slow bob and little four-point stars twinkle behind it; the move is a smooth glide with a star trail. Dreamy, and reads at town size. | `out/moon-ride/moon-ride.tsx` | `crate-1-previews/moon-ride-idle.png`, `-move.png` |
| Ginger's Candy Cane | weapon, legendary | (no drawing) | $0 | The existing `candy-cane` art and id, kept as they are. Moving it from the Winter Crate is a crate-code change, so it waits for the wiring. | `Items.tsx` (`CandyCane`) | on the sheet |

Each drawing's `summary.md` (in its folder) has the model's own notes on the motion, beat by beat, and on the choices it
made.

## Spend

- **Test run:** $1.13 (Hose $0.34 of its $4 cap; Chirp $0.80 of its $6 cap). Both were well under their caps, so the
  rest went ahead.
- **The rest:** $3.38 of the $20 allowed:
  - the five items' first tries, $1.33;
  - the two redos, $1.45;
  - Moon's Ride, $0.52;
  - two aborted starts of the lights redo, about $0.08: my own process kill cut them off after 2 turns each. One logged
    $0.042; the other's log was deleted, so its cost is an estimate.
- **Total: about $4.51.**
- Each item and its redo stayed within that item's $3: the lights' redo ran under a $2.65 cap so that the first try, the
  aborted starts and the redo together stayed under $3. No cap was raised.

## What couldn't be drawn, and what the game would need

Everything was drawn. Three things the game can't show yet:
- **Motion.**
  - The game's items are still: only the shine moves, by CSS. The drawings carry their motion as frames: each item's art
    takes `f`, the frame number, and `motion.ms` gives each frame's length.
  - To play them, `ItemLayer` needs a frame number from one shared clock (one timer per page, paused when the page is
    hidden and under reduced motion).
  - In the town, the dressed pawn is baked into a picture once (`town/you-look.ts`), so it would bake one picture per
    frame.
- **Rides.** There's no `rider` slot yet:
  - `ItemSlot`, `cleanLook` and the locker need one.
  - The town needs to draw the pawn between the ride's `Back` and `Front`, cut at the pose's `cut` (as the stool-sit's
    clip in `town/render.ts` does), and to play the ride's `move` per square walked, in place of the walk.
  - The full list is in the README, "Item motion".
- **"Hyper rare":** there's no tier above Mythic, so both rides are drawn as Mythic. How rare they are is a crate-odds
  call for the wiring.
