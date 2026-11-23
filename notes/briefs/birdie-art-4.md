# Birdie's home in Chess Town: the station (outside) and its lobby (inside), Nov 23. Art session, paid runner only

Read `notes/designs-birdie.md` on `claude/director-notes`, section "His home in Chess Town" (Eric's words). Eric pre-approved
Birdie's art spend, but ask him ONCE here for this round's total and wait for his own yes. Follow `notes/RULES.md` on art (the
paid API draws; never by hand; never print the key). Start: `git fetch origin claude/boss-art && git checkout claude/boss-art &&
git pull`. Read `scripts/boss-art/README.md`.

Two runner briefs, built on the closest finished ones (copy their technical sections word for word: the format, the kit imports,
the frame sizes, the box numbers, how it's checked; replace only what it is and what's in it):
1. `scripts/boss-art/briefs/house-birdie.md`, the station from the street, modeled on `house-tower.md`. A little, charming train
   station (a small platform canopy, a station clock shape with no numbers, warm windows, a ticket window, benches out front),
   and on its roof a **big bird's nest** of woven twigs, clearly a nest, cozy, its rim drooping a little over the eaves. The colors
   tie to Birdie and his train (the yellow, charcoal and red of the train as trim; warm wood; the nest's browns). Idle: a little life
   (a pennant flutter, a wisp from the chimney, a twig shifting in the nest). Id `house-birdie`.
2. `scripts/boss-art/briefs/shop-birdie-interior.md`, the lobby inside, modeled on `shop-tower-lobby.md` and the other
   `shop-*-interior.md` briefs (same frame and layers). A cozy station lobby:
   - airport-style rows of seats;
   - a small sit-down café/bar counter with stools;
   - shrubbery and potted plants filling corners;
   - warm lamps;
   - **on the back wall, a big split-flap board** like an old airport's arrivals board. **No letters or numbers:** its flaps show
     little pictures (a train, a clock face, a nest, an arrow, a tiny bird). Animation: rows flipping now and then.
   - **Behind, through big windows or open arches at the back**, 2 or 3 tracks running away into the distance in perspective, and
     a train sliding in and out now and then. That background is scenery, not walkable, and gives depth.
   Animations: the idle with the board's flaps flipping in turn and a train passing on one of the back tracks every few seconds.
   Id `shop-birdie-interior`.
Ask Eric once: "Birdie's home: the station outside and its lobby inside, two runs at about $6 each ($12 at most)". Run each as its
model brief was run (the same mode and settings, `BOSS_ART_CAP_USD=6`). Commit on `claude/boss-art`. Stills on an orphan branch
`stills/birdie-4`: each one's frames, a GIF of each idle, and the house in the street at phone size if its preview makes one.
`NOTE.md` with the spend and notes. `.done`, push, stop.
