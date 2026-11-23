# One name per thing, and Boss alone talks to one player (Oct 15, 2026)

From the slop audit (V3, V8, V11–V15, V19–V21, V23).

- **Names.** The modes are **Boss raid** and **Boss alone**. The Crowd's ending against the Hidden Boss is the
  **boss final**, everywhere: the FAQ, the cut screen ("the boss final is next"), the results table, and the line over
  the board ("BOSS FINAL", where a raid or Boss alone says "BOSS BATTLE"). **Boss battle** stays the general word for
  any fight against a boss. The vote card keeps the boss's name as its label (Eric, Oct 14); its line now names the
  ending: "Boss final: top 4 team up against him".
- **"The Hidden Boss" in a sentence.** His name is a title, so a sentence says "the Hidden Boss" ("You beat the Hidden
  Boss!", "the Hidden Boss mocks it"); his card, bar and headings say "Hidden Boss". That's `the: true` on his roster
  entry, and `bossInText` (core `boss.ts`) adds the word. If Eric gives him a real name, dropping the flag is the whole
  change.
- **Power names are proper names, in Title Case everywhere** (the director, Oct 15): Freeze, Blizzard, Pie, Funhouse,
  Sparkler, Roman Candle, The Dark, Lights Out, Toy Blocks, Big Bounce, Split Pawn, Saw Cuts, Board Saw, Long Pull,
  Lasso Drag, Showdown, No Help, Bullet. That goes for sentences ("Big Boy's Big Bounce"), the rage warning ("Next
  turn: the Blizzard", the article in lower case), the FAQ, and the boss menu's power words, which say what a passive
  does in lower case and name the power ("freezes a piece · Blizzard"). Banners shout in capitals, as before. Generic
  words stay lower case ("his ultimate", "a power", "a toy block" as the thing on the board). The bosses' own lines
  are speech and are left as written.
- **Ranking:** "Unranked: solo games don't count for ranking", in the queue and on the results alike.
- **Boss alone** (`bossAlone` in `game.ts`: a raid with one player) speaks to you: "You vs the boss.", "You beat …!",
  no "0/1 picked" or "1 vote", no "P1/1", no "most dangerous players" list of one. The scoreboard is just your own row
  ("You"), and on a phone it takes only that row's height, not the space of a crowd.
- **The results table** names what was played: "Boss battle" (a raid, Boss alone), the Crowd's knockouts as one row
  (a stage there is a move or two), then its ending ("Team final", "Boss final", "Duel"), and Classic's stages, then
  its "Final" (`lossRows`, unit-tested). It used to label any match's ending "Duel".
- **Settings' how-to block is gone.** It was a second, hand-kept copy of the FAQ's rules, already wrong ("Ten bosses",
  for 7 bosses over 10 tiers). Its place is two links into the FAQ: how each mode works (`/faq#faq-modes`) and the whole
  FAQ. (The votes-off line and Classic's stepper, also stale, went with their controls in #236, the Settings
  overhaul.) The FAQ names a raid's clock as the vote does: "A boss raid is Rapid 10+5."
- **Numbers from settings:** Home's matchmaking lines take the server's fill time ("bots at 8 s" on the test server,
  60 s live) and the lobby sizes. Before, they had "60", "a minute", "50", "100", "49" and "99" typed in. The landing
  page's numbers come from the settings too, and its "boss battle against Stockfish" is now the boss final against the
  Hidden Boss, which plays Maia, not Stockfish.
- **Crate names stay Eric's** ("Beta Crate · Series 001", "Winter Crate · Series 1"). The series now sits on its own
  line, so no line ends on the " · ". The crate count moved up beside the keys ("Crates × ∞"). The row's cryptic
  "× ∞" went with it.
- **Profile:** "Boss tiers beaten · 0 / 10". The ten are strength tiers, not bosses; there are seven bosses. The
  tiles' tooltips named old placeholder bosses ("The Pawn Golem"); they now say "Boss tier 1400".
