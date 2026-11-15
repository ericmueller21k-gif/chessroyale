# The town's music: a theme that loops, and two piano solos that slot in between passes

Eric (Nov 14-15) asked for a theme for the town ("a song where people literally are like, I want to turn this song on
while I'm in the chess town because it's so good"), then wrote a piano solo for it and liked two versions of the solo.
His ask for the game: "is there any way to ... have them alternate playing say every 10 min in the town, and the main
theme stays the original we composed without the piano solo, but we add these 2 files and they ... can seamlessly work
into the main theme every few play throughs? ... then it's only 3 files, a 3 min theme, and 2 short piano inserts."

| File | What it is | Length |
|---|---|---|
| `town-loop` | the theme, one seamless loop | 178.604646 s (2:59) |
| `town-solo-a` | piano solo 1 (his first write-up's solo, its fast runs rewritten) | 37.209313 s, plus 4 s ringing out |
| `town-solo-b` | piano solo 2 (the melodies he played himself) | 37.209313 s, plus 4 s ringing out |

Each as `.mp3` (stereo, 192 kbps) and `.ogg`, like the boss themes' files since Nov 14. `town.json` has the numbers.
Made in code by `scripts/reel/music/town.py --stereo --kbps 192 <folder>` on `claude/trailer-v2` (the song is
`song_ad.py`). Level: the theme is -16 LUFS, peak -2.3 dBFS, like the boss themes; the solos share its gain, so they
sit a little under it, as written.

## How to play them

The pieces fit together the way a boss theme's intro and loop do, with the order turned round.

- **The theme.** `town-loop` has `pad` (0.5 s) of its own end before it and of its own start after it: loop it between
  `pad` and `pad + loopSeconds`, starting at `pad`, exactly as a boss theme's loop.
- **A solo.** When a pass of the theme ends (a multiple of `loopSeconds` after it started), don't let the next pass
  start: start the solo's file at that moment, from its beginning. `seconds` after the solo started, start the theme
  again from its top (offset `pad`) and carry on looping; let the solo's file play to its end over the theme's first
  bars (its last 4 s are the piano ringing out, already faded). The solo's first second already has what the theme's
  last bars leave ringing, so nothing is cut at either join.
- Both joins want the same sample-accurate scheduling the intro-to-loop join has (Web Audio start times), not a
  timer: a solo's first note and the theme's first beat after it are on the beat.

I put the game's own files together this way and checked both joins: nothing is cut and there is no step that isn't
a note starting. The level rises about 3 dB as the piano comes in and falls about 3 dB back into the theme's quiet
opening.

Nov 15, after Eric heard them: the solos have no brush now ("that shaking thing ... completely drowns out every other
thing going on ... for even the solo, just get rid of it completely") and the piano's left hand, the bass and the
strings are a little louder; he heard a clip and said "perfect". Same file names, lengths and numbers as before, so
nothing in the wiring changes: only the two solo files (and town.json's peaks) differ.

## When to play a solo (Eric's words, then a proposal)

His words: "alternate playing say every 10 min", "every few play throughs". A proposal that gives that with no clock:
after every third pass of the theme play one solo, taking turns (a, then b, then a ...). Three passes and a solo are
9:33, so a player hears a solo about every ten minutes and each solo about every twenty. Put the number of passes in
settings so he can change it by ear. Which solo comes first, and whether the count survives leaving the town, don't
matter to the music: whatever is simplest.

If the town's music is stopped or faded for any reason during a solo, treat the solo as the music (stop or fade it the
same way), and start again from the theme's top.
