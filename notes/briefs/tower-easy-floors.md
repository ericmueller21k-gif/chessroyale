# Battle Tower: bad players on the first floors, then a climb you feel (Eric, Nov 26 night)

Eric's words: "everybody should be getting through the first like 6, 7, 8 without like any issue, unless you're like a terrible,
terrible chess player. Like 1,000 ELO chess player should be breezing through the first 5 or 6... I don't want these bosses to...
[be] giving up your queen for nothing, but... sometimes if they leave their queen hanging because they just like miss a move...
that's normal for a bad player... I want these guys to play like bad players for the first 8 to 10 levels. And then, it should be
like progressively getting harder at that point, but you want to feel the progression... it shouldn't dial too slowly where you're
30 levels deep... and you're like, this is super easy still" (their powers help there).

Today (settings.ts): BATTLE_TOWER.maiaStart 600 with maiaSteps (two-boss floors 600, 680 at 5, 830 at 10, 1630 at 30, 1710 at 50;
a lone boss soloBonus +100); Stockfish from floor 51. Maia's floor is 600 (BOSS_BRAIN.maiaRatingMin), and BOSS_BRAIN draws Maia
sharper than a human (temperature 0.8, topP 0.9). reports/maia-calibration.md: Maia at 600 already beat the "casual" bots
(about 0.13 for the player) and "can't be made easier" by rating. So the rating knob is exhausted: the early floors need a weaker
way of picking moves, not a lower number.

Build (the engine lane's call on details; keep it simple and cheap on a phone: no extra engine search):
1. A "careless" pick for the early tower floors: Maia drawn looser than today (temperature above 1, topP 1: more of a low
   player's real slips), easing back to today's draw by about floor 10, and the existing Maia climb from there.
2. Never a gift: a sampled move that puts the moved queen (and rook, your call) where it's simply lost (a static exchange check with
   chess.js, no engine) is redrawn. A piece already hanging may stay hanging: a missed threat is allowed ("they just miss a move").
3. From about floor 10 on: a climb Eric can feel, steeper than today's if the sim says floors 10 to 30 stay too easy (powers count).
4. Tower floors only (solo and party floors alike, solo and online the same answer); Boss alone, raids and everything else unchanged.
5. All numbers in settings.ts (BATTLE_TOWER), commented with Eric's words.

Prove it with the climb sim (reports/tower-sim.md; its script): targets, roughly: a ~1000 player clears floors 1-6 nearly always
and usually reaches 8-10; a ~1500 player reaches the 20s; nobody coasts past 30. One baseline run (today) and runs at your setting
(the helper testing budget allows a few sim runs here: this is a calibration job). Unit tests for the pick (the gift filter, the
temperature by floor), the boss kit, typecheck. Update reports/tower-sim.md and the tower's area page.
