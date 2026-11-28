# Eric's asks: every one until it's live (RULES.md, Nov 26). Newest last. States: queued / building / waiting on Eric / merged / live.

- Nov 22 · Chub & Chirp Turf (his prints on his squares, your logo on yours, the count, holds Legs/Fuse/Hop, Chirp's hop-around) · LIVE #1024 eb9893a; holds lowered to 32/36/40 in #1025 (Eric)
- Nov 26 · Chandy: Dodge also on checkmate + its art · MERGED #973 #982
- Nov 26 · Birdie room: longer crossing arms; ~50 birds at the bar · MERGED #974
- Nov 26 · Chub & Chirp + Puddles: ult waits at most 3 times after its warning · MERGED #972
- Nov 26 · Puddles: watering regrows the piece he'd lose by passing · LIVE (#983 0e3b5804, main green at 5134b2e7)
- Nov 26 · Dash: Time Scramble 5 s x3 then 3 s x3; "Hang on" replaces his 2nd pop-off · LIVE #975; round 2 below
- Nov 27 · Dash Hang on round 2: he visibly presses; cheetah speed the fastest ever, a few seconds; head up, leaning back, mouth to the sky; jumps to the board center; a few seconds longer · LIVE #986 6532b216 (main green; Eric to play it)
- Nov 26 · Audit: every ask of the last ~2 weeks checked against what's live · queued (next free slot)
- Nov 26 · Beta bots (HunBot, waits 15/30 s, no online count, ⚠ popover) · design, 5 decisions waiting on Eric
- Nov 26 · Payments PR 7 (coin screen), 8 (Stripe), 9 (refunds), 10 (admin) · queued
- Nov 26 · Dash lying-down clock tap: bigger, redrawn · MERGED #980
- Nov 26 · Dash Hang on follow-up: the review's 3 display nits (premoves over the slid-back board; move list row; late join) · queued

## From the Nov 26 audit (notes/asks-audit-2026-11-26.md): never built / partly done
- Nov 9-25 · 50 v 50 and Squads get their own ranks (RP from placement + engine score vs the lobby; ladder for all rank modes; a ranked leaver's seat filled by a bot at their level) · PR 1 of 5 #993 HELD: review (claude/mode-ranks-review) found a blocker (Squads strength averaged over bots moves a person's rating) + 3 should-fix (join-snapshot CAS loses matches; catch-up makes last place lose more; perMove over different moves, last place can gain: ask Eric); fix round next; PRs 2-5 after (sim; 50v50 recorded, full lane; Squads recorded, full lane; screens)
- Nov 9-10 · Riders in the regular crates (5 non-boss riders, crate exclusives; the shopping cart) · PR #997 HELD for Eric: players earn Winter Crates, Beta only via the bonus roll (~1 in 18,200 openings gives a rider); Tommy Gun / Parrot 0.2% -> 0.057%. Review blocker fixed (add6239c). Ask: Winter too, or make Beta earnable?
- Nov 10 · Auto chess: play against people (unranked, in match history) + a landing page (queue with a bot or search) · NEVER BUILT · ask Eric if still wanted (was parked "only on Eric's word")
- Nov 12 · Rare items: a gold/diamond tier frame + tap to preview on a pawn (with the rider) · MERGED #995 7c813c68 (deploying)
- Nov 13 · Hidden Boss in match history: his three forms, the beaten ones greyed · LIVE #990 b6206491 (main green)
- Nov 25 · 1 v 1: rank emblem by every name in game + tap a rank for the ranks pop-up · LIVE #988 d699d71c (main green)
- Nov 11 · Landing page: sound toggle · WAITING ON ERIC: the reel files have no audio; pick chiptune or orchestra (both sent Nov 26 23:40, from stills/reel-music; audio on design/trailer-music reel-music/), then mux + toggle
- Nov 10 · Banana Suit as the secret crate's prize (nothing rolls it) · PR #998 (Mythic Crate rolls it at 2%; full lane review running)
## Waiting on Eric (re-ask in the next message)
- Turf mockup (Nov 22) · beta bots 6 decisions (+ "expect more bots" note) · burst cheat detection build y/n (Nov 11) · Boss Battle select 2x vs bigger (Nov 12) · Boingo room revisions (Nov 12) · trailer v2 edits + Song C (Nov 11) · Settings cleanup look (Nov 25) · lossless music masters location (Nov 16) · Discord webhook (Nov 10) · payments: Access bypass, Stripe Tax, LLC details
- Nov 26 · OK to merge #978 (ranked flake fix edits the vote-zone guard test; the guarded check unchanged)? · WAITING ON ERIC
- Nov 26 · Battle Tower: bad players on floors 1-8/10 (a 1000 player breezes 1-6), no queen gifts but missed threats OK, then a felt climb, not too slow by 30 · PR #991 (boss-lane review session_01JuCWRt3BSThe4a2DyAezB4; CI)
- Nov 27 · Ranks pop-up: a rough Elo range next to each rank ("Elo approximation") · LIVE #988 d699d71c (main green)
- Nov 27 · New boss "___ Stranger" (working id stranger): human, anime/JRPG swordsman (generic), long white hair, trench coat, fire sword + ice sword (X on his back, drawn before moves), a better Fire & Ice crown, aura; unlock after 10 tower floors (in the picker, locked until then); shows up in the tower a few times at different strengths; no town building; a fire+ice move (freeze then burn) · building: art (claude/stranger-art, Opus high), rules (claude/stranger-rules, Opus xhigh). Eric: freeze 1 turn then flee; ult "I'll provide an ult shortly"; unlock "Beat him in the tower" (floor 10); director: floors 10/30/50 lone, target most valuable non-king, kings never burn
- Nov 27 · Stranger hair: REVISED by Eric with a crop of the first version: "this is basically the length", nothing behind him, framing the face to the collar; thin strands, no twigs sideways · building (claude/stranger-art, the shut-off keeper)

- Nov 27 03:30 Stranger: lines theme (stranger far from home, hunting the strongest, senses the hidden one; chess the same everywhere) [#992]; unlock = beat him [#1000 fix]; banners guard OK [#1000]; swords: draw every few moves, slash variants on capture, block/hit when a non-pawn is taken; his strikes play Eric's recorded shouts at random [swords round]; ult: capture shown as a leap-down strike (flame/ice/cut/combo, ~5 s) [ult PR].

- Nov 27 05:50 Stranger ult: Storm of Two Worlds (fire/ice ring; up to 2/game, ~70% see 2; 3 turns, random first; ice: all but 2 frozen, best move free; fire: 3-4 marks, <=1 on a non-pawn; engine fairness: best play loses nothing, decent loses <= ~1 pawn) [ult PR]

- Nov 27 09:10 crates: staff barber-pole twist; Welcome Crate on first visit, open at level 5 (view before); opening: still strip -> rubber-band pull-back -> spin [crates-nov27]
- Nov 27 · Chub & Chirp: 5-carrot line "Chub & Chirp wins" (was "they win") · PR #1021
- Nov 27 · Animated items in Chess Town (tube, candy cane first) · LIVE #1022 5645e3a. Next: crown flames, parrot, tommy gun, confetti (a table line each)
- Nov 27 · Stranger storm redrawn (GBA ring, rift, opening crack animation) · LIVE #1023 7811257
- Nov 27 · Don Dough: back room (his head covered by the table), timer bottom-left of the board on a computer + bigger, counts down 1 every turn (not 2 on his), tick 30% quieter; no destination ring on a ride · MERGED #1026 1e1fe3a
- Nov 27 · Town tables: Ranked live (1v1 search overlay; seated during the match with the opponent's pawn; others spectate from the town; back to town after); Casual stays Coming soon · PR #1027 (full-e2e; review queued)
- Nov 27 · Stranger: an elevator entrance on his tower floors (~10 s, 2 lines, a fire/ice touch, blades drawn as it starts); Big Boy: his line after the block toss (box not moving) · entrance moved into stranger-polish.md; Big Boy part QUEUED
- Nov 27 · Tower: Back to town loaded the town twice and dropped him in the plaza; land in the tower at the clerk; remember the last town spot (account) · LIVE #1028 5a3d65a (memory: 780 MB -> 40 MB; tower its own load; last building kept on the device). Account-saved spot: full-lane follow-up
- Nov 27 · Stranger polish: ult frame by frame (no ring before the leap, the ring builds), size on hop-down, dim everything but the board, rift 50%, blue 'now available' pop-up, elevator entrance · BUILDING (stranger-polish.md, Fable)
- Nov 27 · Stranger farewell in the tower lobby after the first win (stays until it plays, even across reloads; 'not my real strength', walks out the exit door, 'look forward to our next battle'; then the blue pop-up) · QUEUED (stranger-farewell.md), after town-return + stranger-polish merge
- Nov 28 · Town shop building (a facade near the center gets a door): board keeper (board skins: one per rank Gold+, a few basic; list + preview with an opening; lazy loaded), Apple-store display tables, more keepers later (God King, seasonal) · OK'D Nov 28 03:10 ("there's no questions": my picks stand) · QUEUED: brief town-shop-build.md (xhigh, full lane), after town phase 1 (built the new way)
- Nov 28 · Admin: set the Battle Tower floor from Settings (a number box) · PR #1030 (CI)
- Nov 28 · Tower: bots in a party (admin playtests), friends can join a solo climb up to floor 10 (locked solo after), profile best solo + best squad · QUEUED (tower-party-bots-solo.md, xhigh, full lane)
- Nov 28 · Shop: rank piece sets (K+Q or full set; white/black clear: gradient piece vs gradient border, solid border to compare); setting 'Always default board and pieces' (main + in-game) · DROPPED Nov 28 03:25 (Eric: no artwork for now, usage); was B gradient rim
- Nov 28 · Rank nameplates instead of piece sets: your name in a game in your rank's colors (Eric: "give the names when you're in a game… nameplates"; he can't see his own name in a boss battle today). IDEA, LATER (usage): first find where names show in each mode; mockup before any build.
- Nov 28 · God King chromas: one per rank (Gold+), plus other chromas later. IDEA, LATER.
- Nov 28 · Town load stutter ("I don't want it to lag at all when the town loads") · IN PROGRESS (town-load-smooth.md)
- Nov 28 · Menu sounds (item tap, magnifier) half as loud · PR #1034
- Nov 28 · Town structure overhaul for loading + drawing (Eric: "permanent change… might make the town bigger… ask Fable") · DESIGN DONE Nov 28 05:30; Eric 05:40: do ALL phases, no questions · IN PROGRESS: town-phases.md (0 → 1a/1b/1c → 2 → 3 → 4), Fable each
- Nov 28 · Stranger crash on 2nd ult · FIXED PR #1044 (pieceAt reads a drawn board without the rules)
- Nov 28 · Power banner looks inconsistent (sizes, fonts, name) · QUEUED banner-consistent.md
- Nov 28 · Ledger check: 4 accounts disagree (found in ops:report) · QUEUED ledger-mismatch.md (xhigh)
