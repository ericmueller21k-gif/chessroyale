# Boss alone: the difficulty sets the boss's chess level directly

Eric, Oct 18, after playing Chub & Chirp on Hardest: "it's way too easy… he literally just let me take his queen for
free… if this is an 1850 player, I'm like a 900 rated player."

## Why it was too easy

- Boss alone's strength was your rating, plus the boss's offset, plus the difficulty (Easy −300 … Hardest +500): for
  Eric (1580) against Chub & Chirp (−250) on Hardest, 1830.
- Maia then played at `maiaRatingFor(1830)`, about **640**: the curve (`BOSS_BRAIN.maiaRating`) was tuned against bot
  crowds and lone bots (reports/maia-calibration.md), whose ratings run far above people's at the same number. It
  bottoms out at 600, so for Eric Easy, Normal and Hard were all the same 600 boss, and Hardest barely different.
- A 640 Maia with its sampling (temperature 0.8) hangs pieces: the free queen was the brain, not a power or a bug.

## The change

- In **Boss alone**, the difficulty picks Maia's rating directly, whatever your rating: **Easy 1000, Normal 1400,
  Hard 1800, Hardest 2200** (`BOSS_DIFFICULTY`'s `maia`). These are Maia's own ratings: a human's at that level. The
  boss's own brain (Maia, no guard), no bridge share; the powers on top.
  - Eric picked the harder of two ladders offered (the other: 800 / 1100 / 1500 / 1900): "better they are a bit harder
    rn, doesn't feel like a boss at all when they give up pieces so easily."
- The number shown for a boss before Boss alone (the Boss raid screen's stage and Boss alone's menu) is that level,
  with its skulls and "vs you" from it. The Hidden Boss keeps his fixed strength.
- Unchanged: the boss's strength (rating + offset + difficulty Elo) still feeds its powers' own brains (the carrot race's
  weight, the hop's search), raids, a Solo raid (bots: a crowd) and online battles; an admin's Brain pick still wins;
  a test link's `?boss=<tier>` keeps its fixed strength.

## Next

- A "too easy / too hard / just right" choice on the results screen (Eric), to tune the ladder from real players.
- Raids use the same bot-tuned curve, so a typical crowd also meets a Maia near 600 under the powers. Look at it with
  real raid results.
