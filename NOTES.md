# Trailer v2 (Nov 11): two cuts, two soundtracks, for Eric's review

Nothing here is in the game yet. Everything is recorded from the real game on the local server; the music is written note by
note in code (no AI audio, no samples, no known tune).

| | Song A (the chiptune) | Song B (the new song) |
|---|---|---|
| Wide, 1920 x 1080 (YouTube) | `trailer-wide-A.mp4` | `trailer-wide-B.mp4` |
| Phone, 860 x 1544 (the landing page) | `trailer-phone-A.mp4` | `trailer-phone-B.mp4` |
| The music alone | `track-A.ogg` / `.mp3` | `track-B.ogg` / `.mp3` |

All four are 54.4 s. Both cuts share one timeline, so each song fits both.

## The scenes, in order
The music runs at 150 beats a minute, and every cut falls on a beat.

| Time | Scene | Caption, as written |
|---|---|---|
| 0.0 s | 50 v 50: your pick, the team's picks, the reveal, the move played | "100 players. One board." |
| 4.8 s | Today's town by day: a run from the park past the Colosseum, along Colosseum Row, down Seam Avenue and back by Fountain Street; the chat's lines moving in the top left | "Explore the town." |
| 14.4 s | A fade to the same town at night, riding Moon's Ride past Ginger Igloo and Jefferson's Fireworks to Big Boy's Crib | "Ride through the night." |
| 19.2 s | Big Boy: his card (0.8 s), in at his door with him (0.8 s), his blocks building the table (3.2 s) | "Battle bosses. Earn special rewards." |
| 24.0 s | His candy swirl over the whole screen | (the same) |
| 25.6 s | A fade into the boss mashup, four cuts of 2.4 s: Hollow drinking the lights of his strand until the blackout; Alfil fusing two pawns into an elephant; Big Boy's Big Bounce on the board; Sawyer sawing the board | "Every boss has its own tricks." |
| 35.2 s | Squads: Round 1's card, the tiny boards over yours, your move | "Squad up. 8 squads of 4." |
| 40.0 s | Ranked: a few moves of a 1 v 1 | "Climb the ranked ladder." |
| 42.8 s | The run up the ranks; Transcendent lands at 44.8 s | "Become Transcendent." |
| 46.4 s | The Hidden Boss: no caption, a very slow zoom in (16% over 8 s), fading to black over the last 0.8 s | none |

## What changed from the first reel
- The blank ranked stage (two pawns side by side) is gone.
- The town is today's town (the street town), recorded after its "Building the town…" loading screen.
- The demo player is "Player", everywhere.
- The boss caption is "Battle bosses. Earn special rewards."
- The Hidden Boss is the same picture as before (a hooded silhouette, no face, no name), now 8 s, with no caption.

## Calls I made (yours to change)
- **Order:** as above. The town leads into Big Boy through the night ride, so his card is at night and you're still on the ride.
- **Three new captions** you didn't ask for: "Ride through the night.", "Every boss has its own tricks.", "Squad up. 8 squads of 4."
- **The ride:** Moon's Ride (a crescent, for the night).
- **Mashup:** Hollow, Alfil, Big Boy, Sawyer. Smudgy's Repaint is recorded too, as a spare. "Hollow smashing bulbs" I took as
  his challenge intro in Hollow Peak, where his strand's lights go out. His Boss alone bulbs (one goes out per wrong try) are also
  recorded, but they read small on screen.
- **Wide cut, the town:** on a computer with a mouse the town sits in the middle column, about a third of a 1920 px frame. For the
  wide cut I recorded the town scenes as a touch screen of the same size shows them, where the town fills the frame. The other
  wide scenes are the computer layouts. The chat's text is small in the wide town.
- **The run is a little slower than in the game** (about 0.8x by day) so it fills its 9.6 s.
- **No end card.** A title and "hunchess.com" after the Hidden Boss would suit YouTube; say if you want one.
- **Ranked** keeps 2.8 s of the duel before the ranks. Say if you want the ranks alone.

## The music
Both: 150 beats a minute, 136 beats, 4/4 (the mashup in four phrases of six beats, one per boss). Mastered to -16.0 LUFS,
peaks at about -1 dBFS, no clipping. Both loop cleanly (written into a circular buffer; the `.ogg` loops without a gap, an `.mp3`
always carries a few milliseconds of padding).

**Song A, the chiptune.** D minor; the town in F major, Transcendent on D major. Voices: two pulse waves (the lead and a quick
broken-chord voice), a 16-step triangle bass, noise drums, an echo on the lead. The fanfare, the town tune, Big Boy's stomp, the
run up the ranks and the Transcendent burst are yesterday's. New: a tag after the fanfare, an answer to the town tune, a slow
tune for the night, the battle theme under the mashup, a two-voice march for Squads, and a low line under the Hidden Boss.

**Song B, new.** E major; the town in A major, the night in F sharp minor, the bosses in E minor, Transcendent on E major, the
Hidden Boss on a low E with an F leaning on it. Voices, all computed: strings, a breathy flute, a plucked harp, bells, a reed, a
round bass, timpani, soft drums. Brass plays three short stabs only (the first beat, the candy swirl, Transcendent).

**The Hidden Boss is louder.** Yesterday it was nearly silent. Now it sits 3 to 8 dB under the loud scenes: a low held note, a
slow low line, a heartbeat, breaths and three glints.

I can't listen to audio: levels, timing and the loop are checked by measurement, the notes and balance on paper. Expect to want
balance tweaks.

## Editing it
On branch `claude/trailer-v2`:
- `scripts/reel/record-reel.ts`: records each scene (`npx playwright test -c scripts/reel/reel.config.ts -g " town$" --project reel|wide`).
- `scripts/reel/encode-trailer.py`: the cut list (scene, from, to, beats; times are named moments of each recording) and captions.
- `scripts/reel/hidden-boss.ts`: the captions' words. `scripts/reel/music/`: both songs (`build.sh`).
- A caption or cut change is a few minutes; a re-recorded scene about 2 to 5 minutes each.
- The old `scripts/encode-demo.sh` is replaced; the landing page's current reel files are untouched.
