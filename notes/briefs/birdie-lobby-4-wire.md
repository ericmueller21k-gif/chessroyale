# Wire Birdie's lobby round 4 into the game; gates come down at the battle's start (Nov 23). Opus high, boss lane

Eric's notes on round 3 in the game (Nov 23, his words, with his marked screenshot `scripts/boss-art/refs/shop-birdie-interior-4/eric-marks.png`
on `claude/boss-art`): "Look at the left and right of the bar. It's flat for some reason. It should be, actually like risen, and then their
stools should actually be there as well." "make the birdseed pile bigger so it's clear." "That thing at the bottom, like where the train
tracks are, that should move over on top of the table. I drew little red lines where those things should be, like the train crossing things
that come down. And then that little like red light thing ... it should start like flashing as the battle starts. Those things come down
and the train warning signs flash." "There's bird feeders sitting around that table, which there shouldn't be. And then that table should
be a squared table with a chessboard on it, just like every other boss has."

The art: `scripts/boss-art/out/shop-birdie-interior-4/shop-birdie-interior-4.ts` on `claude/boss-art` (1d94041d; summary.md beside it;
stills `stills/birdie-12`, NOTE.md: read it, the runner redrew the room by eye, so its export shapes differ from round 3's). Copy it in
as drawn, as `birdie-lobby-art.ts` was (never redrawn here; no hand drawing).

Start: `git fetch origin main && git checkout -B claude/birdie-lobby-4 origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/town-square.md` (Birdie's Station), `shops/birdie-art.ts` (how round 3's one picture is cut into the room's pieces, standing at
their feet), `ShopRoom.tsx`, and Babur's room for a challenge spot with a table. Effort high: drawing, rendering and animation.

1. Replace round 3's art with round 4's in `shops/birdie-art.ts` (cut into pieces the same way; update BARTENDER_FOOT, the vat, the pour
   feeder, his crate's place on the bar (#906's `SHOP_BIRDIE_CRATE_AT`), the board box, the battle circle and the two marks).
2. **In the game's own view, each of Eric's notes must hold**, because round 3 looked fine as art and wrong in the game:
   - the bar's two arms read **raised** (a counter with a side face), the same height as the front run, stools against them;
   - the **chess table reads as a table with a flat square chessboard top** seen from the room's camera, like the town's park table
     (`houses/park.ts` PARK_TABLE) and every boss's battle table, **not a board standing up like a sign** (round 3's white table stood like a
     sign in the game: if the art's table top would stand up, lay its top flat as the floor tiles are and stand only its leg, or use
     PARK_TABLE's geometry in his colors as `alfil-intro-art.ts` did; your call, recorded);
   - the tracks run across the room under the table; no crossing in the front-left corner; no feeders on or around the table;
   - the vat's seed heap reads big from the room.
3. **The gates** (`SHOP_BIRDIE_GATES`, `SHOP_BIRDIE_GATE`: idle arm up and lights dark; `lower`; `down` arm level, lights flashing): idle
   while you walk the room; when a battle with Birdie starts from his room (the challenge's start, `town/shops/challenge.ts`), both gates
   play `lower` then `down` (lights flashing) through the challenge's intro until the battle screen takes over. The west gate is the
   art's gate flipped. No new frame loop: the room's existing piece animation.
4. Prove: typecheck; `shop-birdie` and the room's unit tests (the pixel-for-pixel check re-pointed at round 4, the crate's place, the
   pour); e2e `birdie-home.spec.ts` / `shop.spec.ts` Birdie's Station and the challenge (phone and computer). **Stills on a new orphan
   branch `stills/birdie-lobby-4`: the WHOLE room in the game as a player first sees it on walking in (phone and computer), one of the
   gates lowered at the challenge's start, and a close-up of the table and the bar's arm in the game.** In `NOTE.md`, one line per Eric
   note above saying what the in-game still shows for it. Frame rate once (`@perf` phone) since the room's drawing changed. Decision note
   about five lines. Area page. PR body in `.pr-body.md` (what changed, player-visible, changed checks old → new). `.done`, push, stop.
   Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name. American English.
