# The Hidden Boss's phase 2: the scoreboard shows who's still playing (Nov 14)

Found by the same-frame job (#703) from Eric's playtest: from phase 1's end the scoreboard read "out" for all four, their points
blank, and a phone's Players tab was empty, while all four were playing their boards.

**Cause.** As his battle ends (`MatchRunner.finishBossBattle`, solo and online alike), core `finishBoss` places everyone still in
(`alive: false`, a placement), and the leaderboard reads `out: !alive`. His fall, cutscene, phase change and phase 2 come after that,
so every screen showed the four as knocked out. The same "out" also silenced his phase 2 chatter (`talkWhen`: never a player who's
out) and hid the party's pawns during his fall and cutscene (the dock kept them from the phase change on with its own patch).

**Fix (what's shown only).** `phase2Standings` (packages/chess, recluse-phase2.ts, shared): from his fall (phase 2 to follow) until the
results, each board's player is in (`out: false`) with their board's state (`board`: playing, won, lost, drawn), first, in the order
they stood; everyone else as they were. NetMatch and SoloMatch `standings()` apply it (who's on the boards: the phase 2 view, or his
fall's word before it). RaceTower shows a board's result after the name once it ends: "WON" (green), "LOST" (red), "DRAWN"; on
the small rows of a phone's panel, a mark (✓, ✕, ½) with the word as its title (the sheet a tap opens has the words).

Calls made:
- **No word while a board is on.** The row is in, with its points, as any player still playing; "PLAYING" on every row cut a
  phone panel's names to one letter (its name column is about 57 px) and a computer's to a few.
- **Placements stay phase 1's, untouched.** Results, XP, rank and everything stored read them; the server sends the same standings
  as before (the results' included). No server code changed.
- **Points: phase 1's, as they stood.** Phase 2's boards are won or lost; no move scores points.
- **Someone who leaves a board is out** (their placement), and the bot playing it on has no row; nor does a fresh bot on an empty
  board (none in his room's fight or the Crowd final, where all four boards are taken by players of the match).
- **The exit note online once every board is decided** keeps "You're already out, so your result stands." (it read the row's `out`).
- **His phase 2 chatter now plays for those on his boards**, as `talkWhen` and bosses.md always meant (it never did: they were out).
- A Crowd final against him uses the same path (the server's startPhase2, solo's phase change), so it's fixed there too.
