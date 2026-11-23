# Birdie's lobby redrawn, and his bartender (Nov 23). Art session, paid runner only

Read `notes/designs-birdie.md` on `claude/director-notes`, the sections "His home in Chess Town" and "The lobby: Eric on the first
drawing" (Eric's words). The drawing to redo is `scripts/boss-art/out/shop-birdie-interior/` on `claude/boss-art` (its brief
`shop-birdie-interior.md`). Eric pre-approved Birdie's spend, but ask him ONCE here for this round and wait for his own yes. Follow
`notes/RULES.md` on art (the paid API draws; never by hand; never print the key). Start: `git fetch origin claude/boss-art && git checkout
claude/boss-art && git pull`; `git pull --rebase` right before you push; never force-push. Run with `BOSS_ART_MAX_TOKENS=96000`
(the last run needed it) and `BOSS_ART_EFFORT=high`.
1. `scripts/boss-art/briefs/shop-birdie-interior-2.md`: the lobby redone. **Keep:** the back wall's split-flap board (pictures, no text),
   the arched windows onto the tracks running away with trains passing, the airport-style seats, lamps and plants, the palette and style.
   **Change, as Eric said:**
   - Make the room **a little bigger** than the first (more floor), as far as the interior format allows (read how other
     `shop-*-interior` drawings size their room and its floor; if the size is fixed, rearrange to fit).
   - **A separate bar area:** a **three-sided (U-shaped) bar counter** with its stools around the outside, **little birds perched on
     some stools** (small doves and sparrows, cozy patrons; a little idle life: a head bob, a sip), and **behind the counter the spot
     where the bartender stands** (the game draws him there: leave his place clear, as the other shops leave their clerk's place).
   - **The challenge spot in the middle:** a plain **square table with a white top**, with **one of the bar's stools on its left and
     one on its right**, facing each other. Nothing else on it.
   - **The crossing gates staggered like a real road crossing:** one gate before the tracks on one side, the other after the tracks on
     the opposite side (kitty-corner), **never side by side on the same line**. No chairs or table on the crossing.
2. `scripts/boss-art/briefs/sidekick-birdie.md`: Birdie's bartender, who is also his shop's clerk, modeled on the finished sidekick
   briefs (e.g. `sidekick-babur.md`, `sidekick-smudgy.md`: copy their technical sections). A **friendly pigeon** (grey with an iridescent
   green-purple neck sheen), a **red vest and a white apron**, maybe a little bow tie, standing behind a counter, drying a glass with a
   towel; idle: drying, a nod, a blink. No letters or numbers.
Ask Eric once: "Birdie's lobby redrawn (a bigger room, the U-shaped bar with birds on its stools, the square white table with two stools,
the crossing gates staggered) and his bartender: two runs, about $10 at most". Commit on `claude/boss-art`. Stills on an orphan branch
`stills/birdie-7`: the lobby's first frame as a PNG (not a giant sheet), its idle GIF, the bartender's frames and idle GIF. `NOTE.md`
with the spend. `.done`, push, stop.
