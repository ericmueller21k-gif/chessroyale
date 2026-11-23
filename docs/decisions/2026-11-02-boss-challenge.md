# Alfil's home, and challenging a boss from the town (Nov 2, 2026)

Eric, Nov 2: "when you challenge a boss in town, they walk into their store with you and you each walk to the middle area on the
floor spaces that are reserved in the battle area, he says a line out loud… for elephant a sand pyramid forms between you… then
the chess board emerges on a table… For Alfil, it's a sandstorm that blows across and covers the screen… exiting puts you back
standing where you were before, like a Pokémon gym." Then: the challenge is per player (no "boss busy"); the server posts a
start line and an outcome line in the town's chat, with the moves, a surrender after 10 moves, a token dropped, and no spam.
How it works: [docs/areas/town-square.md](../areas/town-square.md), "Alfil's Pyramid" and "Challenging a boss".

The calls made:
- **Alfil's home is a shop** as Babur's and Puddles' are: the art copied from `claude/boss-art` (its imports moved, its review
  sheets left there), Woolly behind the middle of the low counter (the mockup's place), the sandstone ceiling the mockup drew,
  the chat's day tone (a light room), "Alfil's Boss Crate" in core's BOSS_CRATES with his ride, `alfil-howdah`.
- **The entry stays "Challenge alone".** For a boss with an intro its confirm is its own: "Challenge Alfil?" / "You'll fight
  Alfil in Boss Battle, then come back here." / **Fight** / Stay (the old "Leave the town square?" isn't true any more). Every
  other boss is challenged as before.
- **The battle is Boss alone's**, as Boss Battle's START starts it: that boss picked (`rememberBossPick`), your remembered
  difficulty, Maia fetched ahead the same way (`prefetchBossAlone`, shared with START), a token counting.
- **Order:** the line starts as you face each other and the pyramid rises 0.4 s into it, holding (its idle) until the line's
  1.8 s are up; then crack, crumble, the table on its own for 0.35 s, the storm. That's the art's own plan (rise, then "idle
  while he says it"), and it keeps the whole thing under 6 s: about 1.2 s walking in, 3.9 s of intro, 0.6 s of storm in.
- **The boss's God King attack** (Eric, Nov 2: "fire off the boss attack animation… a few seconds before the screen overlay hits
  … until the screen is fully cloaked"): its kit's `kingAttack` with its kit's sounds, from 2 s before the storm covers
  (`attackLeadMs`: during the crumble), its target the board on the table (it drops in beside the table, as beside a king), at its
  room size; past its leap-off it lashes again and again, so it's still going as the storm covers and the battle loads. Any boss
  whose kit has one gets it; one without (Timber today) skips it. Its hit effects on the king's square aren't drawn in the room:
  the attack's own figure and sounds read on their own.
- **No skipping** (a tap does nothing during the intro). It's short; a skip can come if Eric wants it. The back button calls it
  off until the storm starts.
- **The board** on Alfil's table is the town's park-table board (the same code, without its cache), white's ranks nearest you.
- **Sounds:** Alfil's own synthesized pack has fitting ones: rumble (rise), crunch (crack), thud (crumble), glow (the board),
  whoosh (the storm).
- **Back to town:** the result screen's "Home" reads "Back to town" and puts you on the square you stood on as you tapped
  Fight, facing the same way; so does the gear's Leave ("You'll go back to the town square."). A reload during the battle
  forgets it (lands home, as before).
- **The server's lines** go out on the battle's start (`/api/boss/solo/start {town}`) and finish (`/api/boss/solo/finish
  {battle, outcome, moves}`), not on the Fight tap, so calling it off in the room posts nothing. The token mark is plain text,
  " + Alfil token" (no emoji: our own packs come later). A finish with no moves of yours says no count ("Alfil beat Ann.").
  What the server verifies: the account, that the battle was started as that challenge and finished once, and its own token
  drop. What it can't: the outcome and the move count (a solo battle is played on the device). The unfinished challenge is
  kept in the live hub's memory (forgotten after a day, and on a restart).
- **What others see of you while you're inside:** the town has no presence sync yet (no real players walk in it), so there's
  nothing to send. When it lands: you stand at the home's door while you're inside (a shop or a challenge), and reappear where
  you come out (or where you stood, after a battle).
