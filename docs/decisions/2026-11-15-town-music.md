# Chess Town's own music: the theme, with two piano solos slotted in (Nov 15)

Eric (Nov 14-15, via the music session): "a song where people literally are like, I want to turn this song on while I'm in the chess
town"; "have them alternate playing say every 10 min in the town, and the main theme stays the original we composed without the piano
solo, but we add these 2 files and they ... can seamlessly work into the main theme every few play throughs? ... then it's only 3
files, a 3 min theme, and 2 short piano inserts."

**What changed.** `town-loop`, `town-solo-a`, `town-solo-b` (`.mp3`, from `town-music/` on `stills/trailer-v2`, commit 296f7e0c) are in
`public/music/`, their numbers in `themes.json`'s new `town` entry. `music.ts` `townMusic`: the theme loops as a boss loop does (from
`pad`, between `pad` and `pad + loopSeconds`); after `TOWN_MUSIC.passesPerSolo` (3) passes the solo whose turn it is (`TOWN_MUSIC.order`,
a, b, a…) starts exactly at the pass's end, the pass stopping there, and the theme starts again from its top `seconds` later, the solo's
file ringing out over it. Every join is a Web Audio start or stop time; a timer only puts the next solo and the theme's return on the
clock `TOWN_MUSIC.aheadS` (120 s) before it (a hidden tab's timers can be a minute late). Same gain, `MUSIC.volume`, as the boss themes.

**Calls made (the brief's "simplest" where it left the choice):**
- It plays while the town is open (`townMusic(true)` from Town.tsx, `MUSIC.townPreloadAfterMs` after the first frame, with the bosses'
  fetching) and nothing else is: a room whose theme is in themes.json, a challenge's splash, a battle. A room with none (a shop, the
  walk-up's hall and landing) keeps it. A challenge's walk-in and intro keep it until the splash, as before (the splash takes over).
- Out of a room, or a called-off splash: the theme from its top at once, while the room's fades out (1.5 s). Stopped mid-solo: the solo
  stops with it; a solo put on the clock but not yet heard stays next. The passes count again from each start; the solos' turns carry
  on through room visits and start from a again when the town closes (a battle, the Colosseum, the Hidden Boss's summoning).
- A solo not decoded by its tick (still loading, or it failed): the theme plays one more pass, no break, and the solo comes at that
  pass's end.
- Loading: the theme first (decoded to play), then the solos (decoded, kept while the town is open: about 30 MB for both at 48 kHz, the
  theme about 70 MB), then the bosses' (fetched only). Let go as the town closes. All through `brc-music`, hashed (the build hashes
  every file in `public/music/`: no change needed there).
- Music off or the page hidden: faded to nothing, the schedule running on (as a boss theme keeps its place). Music off as the town
  opens: nothing fetched.
- A new audio context: every piece still to sound carried onto it at its place (`handOverTown`, the boss music's clock shift).
