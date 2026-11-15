# Chess Town's own music (Nov 15)

Eric: "a song where people literally are like, I want to turn this song on while I'm in the chess town"; "a 3 min theme, and 2 short
piano inserts" that "seamlessly work into the main theme every few play throughs".

**What changed:** `townMusic` (music.ts) loops `town-loop` in the street and in buildings with no theme of their own. After every
`TOWN_MUSIC.passesPerSolo` (3) passes, a solo (a, b, a…) starts at the pass's end and the theme comes back from its top `seconds` later.
Every join is on the audio clock. It loads first after the first frame, then the solos, then the bosses' themes.

**Calls:** a room theme, splash or battle takes over, and when it's gone the theme starts from its top. A challenge's walk-in keeps the
town's theme until the splash. A solo not decoded in time: one more pass. The solos' turns reset when the town closes. Everything
decoded is let go when the town closes.

**Memory (Nov 15, the director's brief; the first build kept all three pieces decoded):** about 100 MB decoded beside the town's WebGL is a reload risk on a phone (iOS kills a tab
over its memory). Now only the theme stays decoded while the town is open (~69 MB, as a boss loop does). A solo is decoded
`TOWN_MUSIC.aheadS + decodeS` before it plays (`decodeS` 30 s, a setting: headroom for a slow phone's decode) and let go once it has rung
out, so at most the theme and one solo are in memory. A decode still running when the solo goes on the clock is waited for; one that
lands too late, or fails, is one more pass. A room, splash or battle taking over lets the solo go after its fade (the theme stays while
the town is open). The bytes stay in `brc-music`, so decoding again costs no download.
