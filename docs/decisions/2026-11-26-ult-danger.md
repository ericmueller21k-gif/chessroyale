# Bosses' ultimates come when the boss is in danger (Nov 26, 2026)

**Eric, Nov 26, after beating Birdie in a test game (Birdie down only a bishop and two pawns, positionally lost) with no Fall:** "his ult is supposed to fire. It's not about like how many moves have been played. It should have detected like he was basically in danger, or like it was already heavily in my favor, and it should start triggering very quickly thereafter, like a turn or two at most."

- **The cause:** an ultimate waited for material loss or a slow rage meter. Against a crowd that plays well, a winning crowd waited about 12 crowd moves.
- **The danger line** is `BOSS_POWERS.dangerAt` (0.70): a crowd move the judge scores at 0.70 or more for the crowd.
  - **Rage meter** bosses (all but Birdie, Chandy, Wrangler and the Hidden Boss) get a full meter as the crowd's turn begins, so the ultimate comes in his second turn in danger.
  - **Chandy's Dodge** is warned as if his meter were full.
  - **Birdie's Fall** comes after two danger moves in a row, since one-move blips are common.
  - **One ultimate a danger:** after one comes at the line, the meter fills at its usual pace until a move below it, so the shortest ultimates don't chain.
- **Below the line nothing changes.**
- **Each ultimate's own conditions stay**, such as the Carrot Patch's pass guard. Changing them would reverse the rules those powers were built on, so that is for the director and Eric.
- **Flagged for Eric:** Chandy's Dodge before his 5 upgrades, which goes against his Nov 16 words.

Full design and measurements: PR #968.
