# PARKED idea: the Hidden Boss's epic drop lands on the countdown's 0 (Eric, Nov 15)

**Status: parked by Eric, Nov 15** ("make a note of it for now, just so we don't forget ... I just don't want to spend the resources
on it right now"). Start only on his word. Do it after the round 4b final form ships (it touches the same sequence).

## His words
"there's like a big drop in ... his song ... the epic most ... when he's talking to his child form and then he transforms, and then
he says ... something ... and then he's like, now like, let's play. And then when he splits the board up ... I want the epic part
of the song to start right when the timer ... does the 5, 4, 3, 2, 1 countdown ... right when it goes to 1 and then 0, like it
starts up the epic part of the song ... we don't need to even have audio or like a song playing. Like right when he splits the
board, we can like almost fade it out. So then when it starts with the epic part, it can just start like right from there ...
that'll make it even easier to stitch together."

## What it means (the director's reading)
- The sequence: child form talk -> transformation -> his line(s) -> "let's play" -> the board splits into four -> phase 2's
  countdown (5, 4, 3, 2, 1: `CenterCount`) -> play.
- Wanted: as the boards split, the music fades out (to silence or near it); the countdown runs quiet; on the countdown's 0 (as
  1 turns to 0, the moment play opens) the song's epic part starts, hard, from its first beat.
- So no crossfade from wherever the song is: a fade-out at the split, then a clean start at the drop. That makes it simple: start
  the piece at the drop's offset, scheduled on the audio clock for the countdown's 0.

## Where "the epic part" is (to confirm with Eric before building)
- Most likely `recluse-phase3`'s drop: themes.json marks { pause 2.44, slam 2.64, build 3.04, breath 16.435, drop 17.435 }, intro
  17.435 s then its loop (88.37 s). Today the boards split at the transformation's start + phase3's introSeconds, i.e. ON this
  drop (bosses.md; `src/music.ts` `recluseMusic`/`switchPlan`). Eric's ask moves the drop later: to the countdown's 0, after
  the split and the countdown, with silence in between.
- If he means another moment ("the full song": the music helper's full-length version on `claude/trailer-v2`), ask him or the
  music session (session_01JuCWRs7vACHciUbhC3eY8V) for the timestamp; Eric offered to "go trace it" himself if needed.

## Build notes for the helper (later)
- Lane: god-king (the boss battle's presentation) with music.ts; targeted. Effort high (timing, audio clock).
- Fade at the split (`MUSIC.fadeMs`-style ramp, maybe longer), silence through the countdown, then start the loop's drop on the
  audio clock exactly at the countdown's 0 (solo and online: online's countdown comes from the server: align to its end time).
- Check: an e2e/unit check that the drop's start time equals the countdown's 0 within a frame or two; Eric hears it on his phone.
