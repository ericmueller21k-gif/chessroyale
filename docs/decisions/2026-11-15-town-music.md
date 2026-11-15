# Chess Town's own music (Nov 15)

Eric: "a song where people literally are like, I want to turn this song on while I'm in the chess town"; "a 3 min theme, and 2 short
piano inserts" that "seamlessly work into the main theme every few play throughs".

**What changed:** `townMusic` (music.ts) loops `town-loop` in the street and in buildings with no theme of their own. After every
`TOWN_MUSIC.passesPerSolo` (3) passes, a solo (a, b, a…) starts at the pass's end and the theme comes back from its top `seconds` later.
Every join is on the audio clock. It loads first after the first frame, then the solos, then the bosses' themes.

**Calls:** a room theme, splash or battle takes over, and when it's gone the theme starts from its top. A challenge's walk-in keeps the
town's theme until the splash. A solo not decoded in time: one more pass. The solos' turns reset when the town closes. All three pieces
stay decoded while the town is open (about 100 MB) and are let go when it closes.
