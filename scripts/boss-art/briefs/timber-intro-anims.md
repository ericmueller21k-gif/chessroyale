# Timber's intro animations: walk, lift, carry, set down, gnaw, done

This is the second run of Timber's battle intro. The first drew the props in
`scripts/boss-art/out/house-intro-timber/house-intro-timber.ts`. **Read it first, with its brief
`scripts/boss-art/briefs/intro-timber.md` (the timeline) and its notes `scripts/boss-art/out/house-intro-timber/summary.md`.**
Above all, read its `INTRO_TIMBER_LOG` and `INTRO_TIMBER_LOG_LOOK`: the log he carries must be **that same log**, with
the same colors, bark and size.

Your drawing exists and Eric approved it: `scripts/boss-art/out/boss-beaver/boss-beaver.ts` (Timber, with his rig and his
`BOSS_BEAVER_ATTACK`). Add to it with `edit_drawing`; don't rewrite it, and don't change any existing animation or part.

## What to add
**`BOSS_BEAVER_INTRO: Character`**: Timber for his intro, with id `timber-intro`. It uses his own parts and palette
(spread `BOSS_BEAVER`, as `BOSS_BEAVER_ATTACK` does), in a frame wide and tall enough to hold the log in his arms, and
its foot at his feet.
- **Facing:** he works on the left side of the board, so draw him **facing our right** (toward the middle). Say so.
- **Animations:**
  - `walk`: 6 frames at about 110 ms, looping. A waddling walk, empty-handed; code moves him.
  - `lift`: about 6 frames, 600 ms in all. He bends, hugs the log lying at his feet (east to west, as the log's `lying`),
    and heaves it up into his arms, held across his chest, or onto a shoulder. Cue `hup` as it comes up. "Doesn't have
    to look too realistic" (Eric).
  - `carry`: 6 frames at about 110 ms, looping. He waddles with the log, a little strained (cheeks puffed), with the
    log bobbing. Code moves him to the middle.
  - `setDown`: about 5 frames, 500 ms. He swings the log down and stands it on end in front of him, on our right (the
    log's `standing`, where the table goes). Cue `thump` on the frame it lands. From the last frame on, the log is the
    separate piece (code shows `INTRO_TIMBER_LOG`'s `standing`), so **his last frame has no log**; his paws are just
    leaving it.
  - `gnaw`: 8 frames at about 90 ms, looping. Leaning in toward the log on our right, he gnaws furiously, his big teeth
    chattering and his head bobbing, with chips spraying. The log itself is the separate piece: draw only him and the
    flying chips near his mouth. Cues `gnaw` and `chomp` in turn.
  - `done`: about 6 frames, 800 ms. He steps back, dusts off his paws, and grins with a `chitter`.

**Export `TIMBER_INTRO_REACH`:** where the log sits relative to his foot in `setDown`'s last frame and in `gnaw` (in his
frame pixels), so code can place the log piece right in front of his teeth.

## Looks
- Render each animation frame by frame at 2x on both backgrounds (at most about 8 frames side by side, under 3,000 px).
- Render `idle` beside Big Boy (`with: "bigboy"`) for his size.
- Check that the log in his paws matches the props file's log, that he faces our right, and that the motion is smooth.

Call done with notes: the frame size and foot, each animation beat by beat with its times, every cue, the facing, and
`TIMBER_INTRO_REACH`.
