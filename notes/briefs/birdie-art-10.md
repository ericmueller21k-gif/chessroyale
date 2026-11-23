# Birdie's lobby and bartender, round 2 (Nov 23). Art session, paid runner only

Round 1 (`stills/birdie-7`; drawings `scripts/boss-art/out/shop-birdie-interior-2/` and `out/sidekick-birdie/` on `claude/boss-art`)
missed Eric's Nov 23 notes and has layout misses. Read `notes/designs-birdie.md` on `claude/director-notes` (the lobby section and
"Eric, more (Nov 23)": every quote). Eric's words: "the bar should be like fill it up, put some stuff on the back ... put some bird
feeders on the table, and there should be a big ... vat of birdseed that the bartender ... scoops it up and then he pours it ... onto
the birdseed feeders around the table ... The room doesn't need to be that much bigger". Earlier: a 3-sided U bar with little birds on
bar stools; the middle challenge spot is a square white-top table with one bar stool on each side (left and right); crossing gates
kitty-corner.

Eric already said for this lobby "Just finish it don't care the cost" in round 1's session; still say the spend once here (two runs,
about $12 at most) and go on unless he says stop. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print the key;
art matching existing art gets reference pictures). Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`;
`git pull --rebase` before you push; never force-push.

**Reference pictures** (the runner's 3rd argument): round 1's own first frame and the bartender sheet (from `stills/birdie-7`), so the
style, palette and everything that worked stays; say in the brief what to KEEP: the airport seating, the arched windows with tracks,
the split-flap board on the back wall, the floor tiles, the plants and lamps, the doorway, the staggered crossing gates.

**Lobby, change** (a new run starting from round 1's drawing, same 12 x 12 room or at most one tile bigger each way):
1. **Behind the bar, on the back wall:** shelves filled with seed jars, sacks and tins.
2. **The bar itself:** the 3-sided U with the bartender's space inside it, open to the back wall. Stools with little birds on them
   around its **three** outer sides (left, front, right), not only the front.
3. **On the counter:** little bird feeders in place of drinks, several along all three sides.
4. **Inside the bar, by the bartender's spot:** a big vat heaped with birdseed, a scoop in it.
5. **The challenge spot in the middle of the room:** a small square white-top table with exactly one bar stool on its left and one on
   its right. Smaller than round 1's, centered in the open floor (not against the seating).
6. **The crossing in the corner:** rails on ties over gravel (a railroad crossing), not a road with a dashed line. Keep the gates
   kitty-corner (opposite corners of the crossing).

**Bartender, change** (from round 1's drawing): no wine glass. His idle loop scoops seed from the vat with a scoop and pours it into a
feeder, then a short pause, and repeats. Keep his look (pigeon, red vest) and his other animations, swapping the glass for the scoop.

Stills on a new orphan branch `stills/birdie-10`: `lobby-first-frame.png`, `lobby-idle.gif`, `bartender-idle.gif`,
`bartender-frames-sheet.png`, and `compare.png` (round 1 and round 2 side by side). `NOTE.md`: the spend, what changed, any call made.
`.done`, push, stop.
