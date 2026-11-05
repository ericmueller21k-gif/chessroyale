# Brief: the street town, round 4: joined rows of buildings (art + code; Opus high)

Worktree `/home/user/cr-townrows`, branch `claude/town-rows`, made from `origin/claude/town-boxes` (round 3, not merged yet).
When round 2 (#499) or round 3 merge to main, merge main in (a real merge, never a rebase). Run `npm ci`. Push as you go.
Ports are 8993, inspector 9493. Include notes/briefs/rules-common.md.

## Eric's correction (Nov 5), in his words
"That's not correct. I described it like the Toontown streets where everything is literally connected… factor in some of the
housing will be replaced, some of the sizes. So like you literally need to connect the houses. They don't need to be like a super
clean looking connection, but… they should kind of blend together."

He sent a reference: `notes/briefs/assets/town-rows/eric-reference-nov5.jpg`. In that kind of street:
- an unbroken wall of fronts runs down each side;
- widths and heights vary, with odd, bulgy, cartoon shapes and rooflines that step up and down;
- there's no sky and no grass between neighbours;
- one taller landmark front stands out in the row;
- the sidewalk runs along the base, with lamps and trees on the sidewalk.

Toontown is a **feel reference only**: original buildings, colours and shapes; no copying its art, signs or layout. Our style stays
our own pixel art. Today's problem, round 2: `assets/town-rows/round2-gaps.png`. There, houses stand apart on lawns, with chessboard
and sky showing between them.

## Do
1. **Rows, not lots.** Every built side of every street is one continuous frontage from corner to corner.
   - Fronts sit on one building line at the back of the sidewalk.
   - Neighbours share a party wall: no gap, lawn or hedge between them, and no sky between them at street level.
   - Front lawns and hedges in front of rows go. Back gardens and the park stay.
   - The chessboard road and the sidewalk stay as they are.
2. **The joins blend, roughly.** It doesn't need to be clean. Use a mix:
   - one front slightly overlapping the next;
   - a shared pilaster, downspout or trim strip covering the seam;
   - a stepped roofline;
   - an odd narrow in-between front (a stair tower, a slim shop, an arch over an alley that shows nothing behind it).
   - No hard gap and no line where the art just stops.
3. **Rows are data, and slots can change size.** A row is a list of slots, each with:
   - an art id;
   - a width in squares (1 to 4 for everyday fronts; boss homes keep their own size);
   - a height class.

   Eric will swap buildings and sizes later. Replacing a slot with a wider or narrower one must still leave no gaps: the row
   re-flows, and a filler front fills what's left. Build a filler that makes believable narrow fronts (1 to 2 squares,
   different colours, windows, doors and roof caps) from parts, so any leftover gap fills itself.

   Unit-test that every street side is fully covered for the shipped plan and after random slot swaps.
4. **Boss homes are slots in the row.**
   - Each of the 16 homes keeps its look and stands out (wider or taller, its own roof and sign).
   - Its door faces the street. A tap or an arrow into it still opens its card (Nov 5 rules in `docs/rules/eric.md`).
   - They stay always visible (Eric approved this).
5. **Everyday fronts need row art.** Today's standalone houses have side yards and margins.
   - Make or adapt fronts that run edge to edge: shops, flats, a bakery, narrow townhouses, a tall landmark or two per street, at
     least 8 kinds plus the filler parts.
   - Draw them as before: hand-drawn by code on the art branch's tools if you need them, with no paid API. Match the town's
     palette and pixel scale.
   - Some can be a bit wonky or bulgy, like the reference, but in our own style.
6. **Depth (keep round 3's boxes).** A row is one block, with roof faces and the end walls at corners.
   - Corner buildings turn the corner: they show a front on both streets, so a crossing looks closed, not open.
   - Inner party walls are never drawn.
   - Draw count should fall, not rise.
7. **Behind the rows,** bigger buildings form a skyline (as planned), with the sky still visible above them. They're a hint of
   more town beyond.
8. **Unchanged:**
   - the town's size (46×46, wrapping) and the seam street;
   - the park plus (12 tables) and the Colosseum (front-on);
   - the turning camera, taps through the heading, and the name labels just over their roofs;
   - `STREET_TOWN` stays admins only.

## Order
1. **Mockup first:** render one street (Fountain Street) from the player's view, on phone and computer, at day and dusk, plus one
   corner during the turn.
   - Put them in `docs/street-town-rows/mockup/`, commit, push, and stop with a short report. The director shows Eric.
   - Only fix-ups the director sends back come before the build.
2. **The build:** the rest. It happens in the same run if the director's message says go, or in a new run.

## Done
- **Unit:** full coverage per street side (shipped plan and random swaps); every join gets a blend treatment; corners closed; boss
  doors reachable; draw counts.
- **e2e:** keep round 3's (phone and computer, both renderers, the turn, taps and arrows mid-turn, figures on screen). Add a
  screenshot-based check that no sky colour shows between fronts at street level on two streets.
- **Frame rate:** measure as round 3 did; no worse than round 3 on phone.
- **Stills** in `docs/street-town-rows/`: each street by day, one at dusk, a corner, a boss home in its row, and the turn, on phone
  and computer.
- **PR body** in `docs/street-town-rows/pr-body.md` (full e2e lane). A decision note in `docs/decisions/2026-11-05-street-rows.md`
  covering slot sizes, the filler rules and the blend types.

## Eric's clarification (Nov 5, later)
"They don't need to like literally be drawn together. Like the colors are different. They just need to be attached like that. And
then most of them aren't actually like real buildings… they look alike."
- **Separate fronts, butted together.** Each building keeps its own colour and shape, set edge to edge. The seams aren't painted
  over; a blend treatment is used only to hide a real gap or crack.
- **Most fronts are dummies.** They're look-alikes that can't be entered, made by a parts generator (body, colour, windows, door,
  roof), which also fills any width.
- **Boss homes** are the distinct real buildings.

## Eric's references, round 2 (Nov 5, later): the feel to match
Files in `assets/town-rows/`: `eric-ref2-plaza.png`, `eric-ref3-overhead.webp`, `eric-ref4-street.jpg`, `eric-ref5-square.webp`.

Eric: "look at how the background shows. There's depth to the buildings, but … they even did the same thing of like making the
buildings flat when they could … it'll feel immersive when you're running through the town. Like you won't actually be able to see
the Colosseum unless you're like running towards it … which is also why the zoom in by default is more zoomed in now. So it feels like
you're actually running through the streets of Chess Town."

**What to take from them.** These are the structure and the feel. We still don't copy the game's buildings, signs, statues, colours
or layout.
- **The rows wall in each street and square.** You see the street you're on, and a sky above a skyline of taller roofs peeking over
  the rows: towers, a gable or two, treetops. You don't see across the town.
- **Flat fronts wherever they work.** Real depth (box sides and roofs) goes only where the eye catches it: corners, free-standing
  buildings, landmarks sticking up.
- **Landmarks stay hidden until you head toward them.** The Colosseum shows only when you're on a street or square that opens onto it
  and facing it; the rows hide it otherwise. This replaces round 3's "far drawing within 45 degrees of north" rule with real
  occlusion by the rows. The same goes for the park.
- **The camera is closer and lower,** so the rows are the main thing on screen, the street runs away from you, and fronts read at
  eye level.
  - Tune the pitch down from round 3 until a street looks like the references. Keep the chessboard roads readable underfoot.
  - Keep taps and arrows working through the heading.
  - The zoom out button still allows a higher view.
  - Every figure must stay fully on screen (Eric, Nov 4).
- **Plazas.** Squares can have a free-standing building on a raised plot (a boss home or the fountain), with sidewalks that have a
  kerb edge.
- **Our palette and pixel style.** Warm, cartoon and varied, but our own.
