# Birdie's ultimate cutscene, the art (Nov 23). Art session, paid runner only

Eric picked young Birdie B and **Armored Birdie A (sleek)**. Read `notes/designs-birdie.md` on `claude/director-notes` (the
cutscene, Eric's words) and on `claude/boss-art`: `out/boss-birdie/boss-birdie.ts` (young Birdie, his `fall` animation),
`out/birdie-train/` (his train from above), `out/boss-birdie-armored-a/boss-birdie-armored-a.ts` (Armored Birdie). The model for
a full-screen cutscene is Moo's Full Moon: briefs `arena-moo-field.md` and `arena-moo-closeup.md` (the arena mode used only for
its format: one full-bleed 200 x 260 picture per run, shown 3x on a computer and 2x on a phone, keep what matters inside
x 4-196, y 22-238). Eric pre-approved Birdie's spend ("Just approve whatever the spend is for this"), but ask him ONCE here for
this round's total and wait for his own yes. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print the key).
Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`.

## The cutscene (about 6 to 7 s; the game strings these together; you draw the pictures)
1. (In the game, his sprite's `fall`: he tumbles out of his spot on the board.) Then a cut to:
2. **Scene A, the fall** (`arena-birdie-fall`, about 4.5 s): a full-bleed picture, a low-ish camera, NOT super zoomed in, so you can
   see what's below. Young Birdie (cap flying off, wings flailing) tumbling down through the air like a bird falling from a great height,
   almost dying, the background a blurred sky with wind and vertical speed lines, cartoon-style. Below him a **train track** comes into
   view, and **his yellow train barrels toward him along it, closer and closer** (the same train as his ride, seen from the front
   three-quarter: bright yellow, dark roof, red stripe, round headlights). Its **headlights get brighter and brighter** as it nears.
   Animations: `fall` (loops, 4 to 6 frames: him tumbling, the speed lines streaming up) and `approach` (plays once, about 8 to 10
   frames over 3.5 s: the track rising into view and the train growing from small to filling the bottom third, headlights brighter
   each frame, Birdie lower each frame). Draw the headlights as two clean round light shapes in their own palette keys so the game can
   add its existing light glow over them.
3. **The hit:** a white flash (the game draws it).
4. **Scene B, Armored Birdie revealed** (`arena-birdie-armored`, about 1.5 s): a full-bleed close-up, low camera looking up at
   **Armored Birdie (A)**, standing upright in a hero pose amid steam and sparks, the train's yellow, charcoal and red now his armor,
   his shoulder headlights blazing, his eye glinting under the cap. Animations: `reveal` (plays once, 5 to 6 frames: the steam
   clearing to show him, a final glint) and `hold` (loops, 2 to 3 frames: steam drifting, the headlights pulsing).
5. (In the game: the scene fades, and Armored Birdie hops back to his spot on the board.)

## Steps
1. Write `scripts/boss-art/briefs/arena-birdie-fall.md` and `arena-birdie-armored.md` from the text above, in the Moo briefs' form
   (the frame, how it's shown, who they are with their palettes from the drawings above, the picture, the animations with frame
   counts and timings, the export names `ARENA_BIRDIE_FALL` / `ARENA_BIRDIE_ARMORED`). No letters or numbers anywhere.
2. Ask Eric once: "Birdie's ultimate cutscene: two full-screen pictures (the fall with the train coming, and Armored Birdie revealed),
   two runs at about $8 each ($16 at most)". Wait for his own yes.
3. Run each with the arena mode as the Moo runs did, `BOSS_ART_EFFORT=high BOSS_ART_CAP_USD=8`.
4. Commit the drawings, summaries and logs on `claude/boss-art`. Stills on an orphan branch `stills/birdie-3`: each scene's frame
   sheet and a GIF of each animation, plus one GIF that plays fall, approach, a white frame, reveal and hold in a row at roughly the
   cutscene's timing, so Eric can see it all at once. `NOTE.md` with the spend and the runner's notes. `.done`, push, stop.
