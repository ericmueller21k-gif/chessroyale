# Birdie's ride, redrawn from his real train (Nov 23). Art session, paid runner only

The first pass (`stills/birdie-8`, `scripts/boss-art/out/birdie-train-ride/`) came out as a tall red steam engine with an arched cab
roof. Birdie's train in the game is a **long, low, flat yellow toy diesel with a thin red stripe** (see the still the director attached:
`stills/birdie-build:phone-ride.png`, the train on rank 3). Cause: the run had no reference pictures (the third argument of
`npm run boss-art`), only words. Eric: "pretty much going to be exactly what its train looks like, but probably a little lower quality
... same color scheme".

Eric pre-approved Birdie's spend, but ask him ONCE here for this round ("Birdie's ride, redrawn from his real train: three runs, about
$5 at most") and wait for his own yes. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print the key).
Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`; `git pull --rebase` right before you push; never
force-push.

1. **Reference pictures first (no API spend).** Render Birdie's own train to PNGs in `scripts/boss-art/refs/birdie-train/`: a few
   frames of `scripts/boss-art/out/birdie-train/birdie-train.ts` (the board train) and of `scripts/boss-art/out/boss-birdie/boss-birdie.ts`
   (Birdie riding it), at 4x on the dark ground. Use `scripts/boss-art/boss-refs.ts` if it can load them; otherwise the runner's own
   render helpers (`scripts/boss-art/render.ts`, how the runner made its previews: `npm run boss-art -- --help`/README). Add the game
   still too: `git show origin/stills/birdie-build:phone-ride.png > scripts/boss-art/refs/birdie-train/in-game.png`. Look at them
   before going on: they must show the long, low yellow train. Commit them (small PNGs under scripts/, not docs/).
2. **Rewrite `scripts/boss-art/briefs/birdie-train-ride.md`:** the ride is **that train**: long and low (wider than tall), a flat or
   barely curved low roof, no tall cab and no steam-engine shape, bright yellow as drawn with the thin red stripe, round headlights,
   grey wheel trucks; the pawn sits in it where Birdie sits. At the rides' level of detail. Its item color takes the yellow body (so
   the Yellow color matches his train exactly; the director decides the default color later). Say plainly: "match the reference
   pictures' shape and proportions; not a steam locomotive". Keep the brief's technical sections. Move: rolls along, wheels turning,
   a small puff from the hood stack. The item description: short, no letters or numbers drawn on the train.
3. **Run** `--rider` over the old drawing's id (`birdie-train-ride`) **with the refs dir as the third argument** at
   `BOSS_ART_CAP_USD=3`; then `--rider-views` and `--rider-trail` (rail-tie pair, as before) at their defaults.
4. Stills on a new orphan branch `stills/birdie-9`: `idle.png`, `move.png`, `views.png`, `trail.png`, `ride.gif` and
   `compare.png` (the new side view next to `in-game.png`). `NOTE.md`: the spend, and any call made. `.done`, push, stop.
