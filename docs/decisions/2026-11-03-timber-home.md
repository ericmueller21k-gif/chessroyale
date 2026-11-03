# Timber's home, Rivet in the town, Timber's shop (Nov 3, 2026)

Eric's art (on `claude/boss-art`: `scripts/boss-art/out/house-timber-nov3.md`, `shop-timber-nov3.md`): Timber's Lumber Lodge on the
town square, and inside it his shop. How it works: [town-square.md](../areas/town-square.md) ("Timber's Lumber Lodge and Rivet",
"Inside a shop").

The calls made:
- **Admins only, as Timber is.** He's in the game for admins first (`BOSS_ADMIN_FIRST`): only an admin's boss select has him, and he
  had no town presence at all. So his lodge, his roaming, his chatter and Rivet are in an admin's town only (`town/admin-town.ts`,
  read once as the town's code loads; the page waits up to 3 s for your account). His crate is listed to admins only (or whoever holds
  one), not in the FAQ, and the server posts no town-chat line when an admin challenges him (everyone reads that chat). Taking him out of
  `BOSS_ADMIN_FIRST` puts it all in everyone's town.
- **Where: (11, 32), west of the Colosseum.** The only ground left where a 3 x 3 plot and its roaming ring fit on plain board, off the
  park, the apron and the Colosseum: between Boingo's Funhouse and Moo & Moon Meadow. Four open squares to the Colosseum's wall (Folio's
  first place had three, and Eric had it moved); that costs a little spacing: 7.8 squares from Boingo's (the map's rule is 8 to 10), 8.5
  from Moo's, and its roaming ring shares two squares with Boingo's. Its door faces the park.
- **Rivet's town sheet** is baked as every kid's (`npx tsx scripts/bake-sidekicks.ts`: the other fourteen came out byte for byte the
  same). He walks with the bots (after the ladder's twenty, so seats keep their meaning), rated 1650: Timber's sim (0.18) sits between
  Moo & Moon's (0.21, Twinkle 1600) and Puddles' (0.17, Drizzle 1700). He's off the ladder's 100s while he's a guest there. Name: Rivet.
- **The shop** as Big Boy's: Rivet behind the middle of the 30 px workbench, "Timber's Boss Crate" with The Log Roller (his ride) first,
  the day tone, a lodge's ceiling (the mockup's dark planks and beams), the circle's marks passed as drawn, the carved king upright.
  The art's file gave the showpiece 3 x 2 squares while its picture and notes are 4 x 2 (columns 15-18): the app's copy says 4 x 2, so it
  stands on its dais and its four columns are solid. Nothing drawn changes.
- **His challenge: the default intro** (the table pops in, his attack swung, the flash and wipe), which every home with a shop gets,
  until his own art comes. His line is his entrance's first: "Hard hats on. We're building today."
- **Chatter:** Timber "The Lumber Lodge is open. Mind the sawdust!", "A good board starts with good wood."; Rivet "Rat-a-tat! Rivet's
  on the job!", "Hard hats on! Rivet says so."
- **Frame rate:** a player's town draws exactly what main's does (the drawing code only gained Timber's entries); an admin's adds one
  house, one boss and one bot. Measured at the lodge (headless, 5 s walking, medians of four runs in turn): phone 43.8 fps (19.2 ms a
  draw) as a player, 43.1 (18.8 ms) as an admin; computer 50.3 (14.6 ms) and 50.8 (14.1 ms). No difference beyond the noise.
