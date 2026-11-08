# Dash fixes (Eric, Nov 8 playtest on his phone)

## Job 1 (Opus, rules): the Scramble Rush extra move didn't happen
Eric failed the put-back, Dash's verdict line said he did it wrong, but the move list shows no second Dash move (moves 13…/14
alternate normally; a quiet extra move would show two Dash moves in a row). settings.ts `dashScramble`: under `needCorrect` (4) of
six back, judged on "the crowd's people's mean, its bots' too (each bot puts each back with botHit 0.6)", he moves again at once.
- Find why: suspects (a) the verdict line is per player but the extra move uses the crowd mean with bots, so a solo player's fail is
  outvoted by bots; (b) the extra move fires but the move list doesn't show it; (c) it's skipped in some state (check, turn order).
- **Eric (Nov 8): "there should be no average when I'm playing in solo mode … a different rule set for that."** Solo: only YOUR
  put-back counts (no bots, no mean). Online crowd: the mean stays.
- Eric's intent: if YOU fail (solo), he moves twice, and the move list shows both moves. Online with a crowd: the line and the extra
  move must agree (same verdict). Fix so the line and the move never disagree.
- e2e: a solo fail → two Dash moves in a row in the move list; a pass → one. Boss lane (boss kit + one review pass).

## Job 2 (Haiku): the pop-off twice + fewer "fam"
- `dashPopOff` happens TWICE a battle now (was once): two different turns, drawn from the battle's seed, at least ~6 of his turns
  apart, both inside his turns range (widen `to` if needed). Each keeps its full beat (pop-off line, 10 fast smacks, love line).
  Different lines the second time if there are spares.
- "fam" is overused: packages/app/src/characters/dash-lines.ts (13), boss-select.ts (2), town/chat.ts (1), town/shops/challenge.ts (1).
  Keep "fam" in at most 3 lines in all; reword the rest in his voice (silly, try-hard young slang: bro, broski, cuz, "this game is
  chopped"; American English). List every changed line in the PR body (old → new).
- e2e: the existing dash spec's pop-off check counts 2. Light/targeted lane.
