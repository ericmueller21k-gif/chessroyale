<!-- Kept in the repo Oct 31, 2026 (the director's notes since Oct 29). Partly done: the art (claude/boss-art); the crate's wiring is not built. -->

# Boss Series Crate #1 (Eric, Oct 29; for NEXT WEEK after the usage reset; API credits for the art)

## Eric's rules
- Name: "Boss Series Crate #1". Every item carries its boss's name. Not only weapons; each must feel impactful ("yeah, this thing is sweet"). Every item has a little motion and the usual color schemes.
- Not in the Fischer random spin. A crate of its own: free to open, always.
- Earned only from battling a boss: win or lose, not surrendered, after at least ~10 moves. **Up to 3 a day** (Eric, later the same day). Maybe more for party games or playing with friends (later). Never more for winning (an engine could cheat that).
- Opening: **2%** to reach the bonus spin; otherwise nothing.
- The bonus spin has **six options**: the item of the boss you beat for this crate (always), 4 other bosses' items picked at random, and **a rider in every spin** (the sixth option, about **2.5%**; Eric: riders aren't tied to a boss, so nobody farms one boss for a rider). The five items share the rest equally (19.5% each). With several riders, the rider slot picks one at random (director's reading).
- One or two more riders before launch (maybe with new bosses).
- Who can open: no guests. No extra opening rule now (Eric): the game won't be live until the level system exists (days to weeks away); the level gates come with it. Crates can't be traded between accounts; if trading comes later, items may be, crates never.
- **Purity (Eric):** every boss item, and every Fischer Random item (Legendary and Mythic, in every crate), always rolls **75% purity or higher** (the blotchy low rolls feel like a punishment on a rare). Owned items keep theirs. Today's bands put most items at 30-70% (PURITY_BANDS in crates.ts).
- Art: by the API, **Opus for every item** (Eric: Opus at a lower setting was faster and cheaper than Sonnet's equivalent), with reference images of our item art for the style; the art runner needs an "item mode" (task #205). Cost estimate first ($20 a run cap unless Eric raises it).

## Items so far
- Babur's Balloon (weapon): sways.
- Alfil's robe (the decorated blanket he wears), worn like a robe or cape (skin): sways. Name TBD ("Alfil's Mantle"?).
- Ginger's Candy Cane (weapon): the Winter Crate's legendary `candy-cane` moves here (keep its id so owners keep it); the Winter Crate gets a new legendary.
- Jefferson's Firework (weapon): a big firework, its tip a subtle sparkler.
- Hollow's String of Lights (weapon).
- Folio's Paper Crown (head, director's pick): a folded paper crown with a tiny origami crane on top that slowly folds and unfolds its wings.
- Puddles' Hose (weapon): coiled round, now and then a little squirt of water. Not fancy.
- RIDERS (hyper rare: the bonus spin's rider slot, ~2.5%, in every crate):
  - Riding Chirp (Chub & Chirp's cricket): your pawn rides it, the lower half hidden as when it sits on a park bench; in the town it hops instead of walking.
  - Moon's ride (Moo & Moon): your pawn sits on the crescent moon and floats round the town, little stars sparkling out behind.

## Director's suggestions and notes (to confirm with Eric)
- Riders are a new kind of item (a "ride" slot): drawn under the pawn with its lower half hidden (the bench-sit trick), and its own way of moving in the town (the cricket hops square to square, the moon glides with a slow bob and a sparkle trail). Moderate work, Opus for the town part; it's a frame-loop change, so measured; far riders can hold still.
- Odds math: an item ~1 crate in 50; a rider 2% × 2.5% = about 1 crate in 2,000 (at 3 a day, ~1.8 years on average). Eric: "If we need to titrate it up, we can."
- Show the odds on the crate.
- No duplicates: the spin gives only items you don't own yet.
- In a party Boss Battle each member earns their own crate.
- Wiring: the full lane (stored data, odds, daily limits, account gates: fair play), Opus xhigh.

## Open questions for Eric
1. ~~Rider tied to the boss?~~ Answered: a rider slot in every spin, ~2.5%.
2. ~~Opening gate?~~ Answered: none needed; launch waits for levels.
3. ~~Crates a day?~~ Answered: up to 3.
4. Party/friends bonus crates: later; watch alt-account farming (the opening gate covers most of it).

## The work, in order (estimates given to Eric Oct 29)
1. The art runner's item mode + one rider drawing as a test (Opus via the API): about an hour, a few dollars. Report the real cost per item.
2. The full set drawn (7 items + 2 riders, each in its color schemes): about a day; cost estimate to Eric first.
3. The crate's wiring (earning up to 3 a day, the 2% / six-option spin, the rider slot, the 75% purity floor, no duplicates, odds shown): full lane, Opus xhigh.
4. Item motion (sway, squirt, sparkle) and riders in the town (hop / glide, the bench-sit look): our code, not the API; Opus for the town part; frame rate measured.

## Oct 30 (Eric, from work)
- Art go: "Test, then the rest": test run up to $10 (Puddles' Hose medium $4, Riding Chirp high $6), then the rest up to $20 more if costs track. Name: "Alfil's Mantle".
- Art session: session_01JuCWRrKqzGXmR9SCYtEhWb (env Default, branch claude/boss-art; brief boss-crate/brief-art.md). Check-in scheduled +2 h.
- Still open: the Winter Crate's new legendary (the candy cane moves to the boss crate).
- Winter Crate's new legendary (Eric, Oct 30): a Christmas stocking worn as a "ski mask" (Stocking Ski Mask): head slot, top cuff always white, body the random color, holes for eyes and mouth; goggles/shades sit on top (faceLayer "above"), other face items under it. Fischer Random legendary in winter-1 (takes the candy cane's place), purity 75%+. Art via API after the boss pieces, ~$2–3 (Eric: "Let's do this", read as yes). Description (director's): "A Christmas stocking, worn as a ski mask. Eye holes, mouth hole, no regrets."
- Face items tagged above/below a hat (faceLayer): PR #416.
- Art DONE (Oct 30, 17:31 UTC): 6 items + 2 rides on claude/boss-art (7884aed), $4.51 total (test $1.13, rest $3.38). Report scripts/boss-art/out/crate-1-report.md, sheet crate-1-sheet.png. Weak: Jefferson's Firework (reads as a striped pole like the cane/tube), Folio's Paper Crown (crane doesn't read at 60 px). Proposed: redo both + draw the Stocking Ski Mask in one small run (~$3, inside the approved budget), after Eric's notes.
- Tiers were the art helper's picks (Hose/Balloon rare; Firework/Lights/Mantle epic; Crown legendary; rides mythic): decide at wiring.
