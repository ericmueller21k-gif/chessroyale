# Birdie, first idle drawings (Nov 23)

Two variants of Birdie's idle, drawn by the paid art API (Opus 5.5, effort high). Eric approved the spend in the session
("Yes, run both"). Plan usage: none; the drawings were made by the runner, not by hand.

## Files
- `a-frames.png`: variant A, every idle frame (closer to the photo).
- `a-idle.gif`: variant A, the idle loop.
- `a-compare.png`: variant A at phone size beside the tiger (1x and 2x), and his poses frame by frame.
- `b-frames.png`, `b-idle.gif`, `b-compare.png`: the same for variant B (a touch more charming: bigger head and eye).

## Spend (API dollars; cap $5 each)
- A: $1.94, 30 turns, 15 renders. Model claude-opus-5-5, effort high.
- B: $1.77, 18 turns, 10 renders. Model claude-opus-5-5, effort high.
- Total: $3.71 of $10 approved.

## What the runner noted
- A: 28 frames, about 5.9 s. Frame 100 x 96. He's bigger than Chub & Chirp (84 x 84) and about as tall as the tiger with
  his balloons; the train is the easiest thing to shorten. Plumage is soft grey-brown and could go darker and browner
  to match the photo. The cap is tipped back by one pixel and can be jauntier.
- B: 21 frames, about 5.6 s. Frame 74 x 78, about the tiger's width but shorter. The train is about 1.4 times his
  length. The hatch sits mid-roof so he sits balanced. Looking right is done by mirroring the head and cap, so the
  light is from the top right for that moment.
- Both: the drawing has no letters or numbers. The "BIRDIE" caption on the preview's comparison.png is a label the preview
  tool adds, not part of the drawing, so it's not in these stills. `a-compare.png` and `b-compare.png` are the runner's
  own phone-size looks (beside the tiger), because the preview's comparison.png shows Birdie alone.
- Both files export their id as "boss-birdie-a" / "boss-birdie-b". The brief's id is "boss-birdie", so rename it when
  a variant is picked.
- Only the idle is drawn; the other animations are still to come, as the brief asked.

## Not committed
The two reference photos (Eric's own bird and train) stay out of the repo: `scripts/boss-art/refs/` is gitignored and
the repo is public.

Drawings, summaries, logs and briefs are on `claude/boss-art` (commit e778ed5e7).
