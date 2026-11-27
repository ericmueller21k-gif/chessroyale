# Eric's asks: every one until it's live (RULES.md, Nov 26). Newest last. States: queued / building / waiting on Eric / merged / live.

- Nov 22 · Chub & Chirp Turf (his prints on his squares, your logo on yours, the count, holds Legs/Fuse/Hop, Chirp's hop-around) · WAITING ON ERIC: round-2 mockup re-sent Nov 26 · never built
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
