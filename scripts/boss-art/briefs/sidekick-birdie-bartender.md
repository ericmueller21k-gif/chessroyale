# Birdie's bartender, third pass: the same friendly pigeon, now scooping birdseed into the feeders

You are redrawing **the bartender** of Birdie's station: the friendly pigeon who runs the little bar in the station's lobby and is also the
shop's clerk. He is nobody's kid and belongs to HunChess's Chess Town. Players walk up to the bar and tap him ("Bartender", Talk).

**Start from round 1's drawing:** `scripts/boss-art/out/sidekick-birdie/sidekick-birdie.ts` (its export id is `sidekick-birdie-bartender`).
Read it first, all of it, if your tools can reach it. (A previous run couldn't open round 1's file, so if the read fails, work from the
reference sheet below, and don't spend turns on it.) Keep his look, his size, his outline and his palette; change only what this brief changes.

**Reference pictures** (the runner's third argument): `bartender-frames-sheet.png` (round 1's sheet: his idle and wave) and
`lobby-first-frame.png` (round 1's lobby, where he stands behind the bar). Match their style. Look at both before you draw.

## What changes (Eric, Nov 23: the bar is full of birdseed now, and the bartender scoops it into the feeders)
Eric: "the bar should be like fill it up, put some stuff on the back ... put some bird feeders on the table, and there should be a big ...
vat of birdseed that the bartender ... scoops it up and then he pours it ... onto the birdseed feeders around the table."

1. **No glass, no towel.** Round 1 had him drying a wine glass with a white towel. Take the glass and the towel out. In their place he holds
   **a scoop**: a short handled metal scoop (a cup on a stick), held in one wing.
2. **The idle loop, about 5 s, scoops and pours:** the big vat of birdseed stands beside him, inside the bar (it's a piece of the room). He
   dips the scoop into the heaped seed, lifts it, turns toward the counter in front of him, and tips the seed out over a bird feeder on the
   counter: a few seeds fall from the scoop in a short arc. Then a **short pause** (he watches the feeder, a small nod), and the loop starts
   again. Now and then he blinks slowly. No letters or numbers anywhere.
3. **The wave (plays once, about 1.2 s):** he sets the scoop down on the counter and gives a welcoming wave with one wing, a happy hello when
   you tap him, then settles back into his idle pose. (Round 1's wave, with the scoop in place of the glass.)
4. **Keep everything else:** his look (a friendly grey pigeon, a red vest over a white apron, a little bow tie, an iridescent green-violet
   sheen on his neck, the red-orange feet, the dark beak), his size, his outline, his eyes, and his head tilt. He stays behind the counter,
   so **no walk and no sit** animation.

## Rules you must keep
- **Size:** a frame about 48 to 60 px tall, feet near the bottom, about the size of the other sidekicks. He stands **behind the bar counter,
  about 31 px tall**, so his head, neck sheen, bow tie and the top of his vest show over it. **Keep his face and head in his top 24 px.**
  Call out the height of his face and bow tie above his feet in your notes, so he can be placed.
- **The scoop stays visible over the counter** in every frame, the seed it pours falls onto the counter's feeder (not onto the floor), and
  nothing in his frames spills past his frame box.
- **Whole pixels, true pixel art,** a dark outline (the palette's `k`, about `#0e1014`), three-quarter view facing our right (as the other
  sidekicks do), light from the top left.
- **Export** as `SIDEKICK_BIRDIE_BARTENDER`, id `sidekick-birdie-bartender`, name "Bartender".

## The animations (a few frames each)
- **idle** (loops, about 5 s): the scoop dip, the lift, the tip over the feeder, the seed falling, the short pause with a nod, the loop.
  Mostly calm and friendly. This is what's on screen most.
- **wave** (plays once, about 1.2 s): the scoop set down, a welcoming wave, the settle back into idle.

## The bar and the room
He stands at (6,2) inside the bar's U, facing south over the bottom run, and the vat stands at (6,1) beside him. The room draws the bar, the
vat and the feeders; you draw only him and his scoop.

## Quality bar
Look at each animation at 4x, and the idle at phone size beside the bar (the lobby's counter, round 1's `lobby-first-frame.png`), before
calling done. It should read at a glance as a friendly grey pigeon in a red vest and apron, scooping seed and tipping it into a feeder,
calm and welcoming, and belong in the same game as the other sidekicks. Clean, cute and readable beats intricate.

Call done with notes: the frame size; how tall he stands from his feet to the top of his head; the height of his face and bow tie over his
feet (to place him behind the bar); the scoop's position in each idle frame; and the pour's arc (where the seed lands, so the feeder is
placed under it).

## How to write it
Start from round 1's file (copy it in, then edit). Render round 1's idle once so you see what you're changing, then swap the glass and towel
for the scoop, and add the pour. Keep each turn's writing under about 600 lines.
