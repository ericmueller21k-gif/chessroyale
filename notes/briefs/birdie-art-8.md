# Birdie's ride: his little train under your pawn (Nov 23). Art session, paid runner only

Read `notes/designs-birdie.md` on `claude/director-notes` (Eric's answers: "His ride: pretty much going to be exactly what its train looks
like, but probably a little lower quality to match ... the drawn ones, but same color scheme"). Eric pre-approved Birdie's spend, but ask
him ONCE here for this round and wait for his own yes. Follow `notes/RULES.md` on art (the paid API draws; never by hand; never print the
key). Start: `git fetch origin claude/boss-art && git checkout claude/boss-art && git pull`; `git pull --rebase` right before you push;
never force-push (another art session works on that branch too).

Read `scripts/boss-art/README.md` ("Crate items and rides": `--rider`, `--rider-views`, `--rider-trail`) and a finished ride's three
briefs as the model (e.g. `boingo-pogo.md`, `boingo-pogo-views.md`, `boingo-pogo-trail.md`; or `bigboy-buggy*`). Write
`birdie-train-ride.md`, `birdie-train-ride-views.md` and `birdie-train-ride-trail.md` from them (copy their technical sections; replace
only what the ride is):
- **The ride:** Birdie's yellow toy diesel train as a pawn's ride: the pawn rides in the open cab (as Birdie does). The same look and
  colors as his train (`scripts/boss-art/out/boss-birdie/` and `out/birdie-train/`): bright yellow, the dark roof, the thin red stripe,
  round headlights, grey wheel trucks. **At the rides' level of detail** (simpler than the boss drawing, matching the other rides). No
  letters or numbers.
- **Its move:** it rolls along, wheels turning, a little puff from the roof. **Its trail mark:** a short pair of little rail-tie marks
  or a wisp of steam.
Run the three as the README says (`--rider` at `BOSS_ART_CAP_USD=6`, `--rider-views` and `--rider-trail` at their defaults). Ask Eric
once: "Birdie's ride (his little train under your pawn): three runs, about $11 at most". Commit on `claude/boss-art`. Stills on an orphan
branch `stills/birdie-8`: `idle.png`, `move.png`, `views.png`, `trail.png` and `ride.gif` (the README's). `NOTE.md` with the spend.
`.done`, push, stop.
