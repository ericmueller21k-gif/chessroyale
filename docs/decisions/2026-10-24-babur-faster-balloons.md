# Babur's balloons blow up faster (Oct 24, 2026)

**Eric (Oct 24, after a ~60-move Boss-alone game against Babur):** the balloons were not landing for a full game; "he's way too
easy otherwise". He expects "about a bishop's worth or whatever on average of pieces a game, like a bishop and a pawn… it's
kind of cool to see more balloons… it's still just a little too slow."

**The director's update (Oct 24, relaying Eric):** a bishop and a pawn on average is the floor; a rook's worth now and then is
fine; more balloons popping is fine if that's what it takes.

## What changed

- `balloonStageSec` 30 → **12** (`packages/core/src/settings.ts`): a balloon is ready after 4 × 12 s = 48 s, not 2 minutes.
- `balloonPops` pawn 40 → **50**, knight, bishop and rook 55 → **65**. The fake queen stays 100, the real queen 0, and the
  odds (`balloonOdds`), the stage count (4) and the landing rules are unchanged. About 58% of balloons pop, was about half.
- Player-visible text, old → new: the FAQ's balloon block reads its numbers from the settings, so it now says "It blows up in 4
  stages of 12 seconds" (was 30) and "about 58% of his balloons pop" (was 50%). The thinking line in
  `packages/app/src/characters/tiger-lines.ts`: "Hmm… a giraffe? No. A knight." → "Thinking. Please hold your applause." (the new
  line from the brief; it's said while he thinks about his chess move, unrelated to the balloons).
- Tests that pinned the old numbers now pin the new ones, with the same width of check: `packages/chess/test/tiger.test.ts`
  (stage, pops, the pop share 58.3 with a bound of 55.5 to 61, was 47 to 52.5), `packages/app/test/faq.test.ts` ("about 58%").
  The e2e tiger links use `seedspeed=12` (was 30), so a stage is still a second on the page's clock.
- Docs: `reports/tiger-sim.md` (a new section on top: the runs and the rule's path), `docs/areas/bosses.md` (the tiger row), the
  comment above the boss in `packages/core/src/boss.ts`, and this file.

## The calls, and why

1. **Stage search in the order the director set.** At Eric's pace (the raid with a 5 s pick), `balloonStageSec` 30, 20, 15, 12,
   stopping at the first whose mean landed material a battle is 4.0 or more. Results (20 battles each, seed 41): 2.15, 3.60,
   3.80, then 12 s at 6.35. Over 6.0, so the stage stayed at 12 s and the pops went up 10 points (the director's rule), one more
   run: 5.50, shipped. 10 s was not needed.
2. **Eric's pace is the raid with `"pickSec":5`.** The sim has no Boss-alone mode (checked: `packages/sim/scripts/boss-sim.ts`
   has only the raid). So the crowd is 50 bots, each picking in 5 s: a fast crowd, not one player alone. The pace is an
   approximation, and the report says so.
3. **Landed material** counts a landed balloon at its piece's value (pawn 1, knight 3, bishop 3, rook 5, queen 9); a popped
   balloon counts 0. A fake queen always pops, so it never counts.
4. **Noise.** Each 20-battle mean has a standard error of about ±0.6 to ±0.9, so the 12 s pair (6.35 at the old pops, 5.50 at
   the new) overlap. The shipped value is 5.50 ± 0.83, inside the director's band.
5. **The raid check (the 10 s crowd, shipped values, 20 battles):** 0.35 ± 0.10, against 0.40 in the review's report and 0.42 for
   the same crowd at 30 s today. Not under 0.15, so nothing to flag. The slow crowd (the 0.05 at 30 s) was not run at 12 s.
6. **Comments left as they were, on purpose:**
   - `packages/app/src/characters/tiger-lines.ts`, the speech chance's note "one comes about every two minutes": the brief
     says nothing else in that file changes. A new balloon now comes about once a minute, so the note is out of date.
   - `packages/app/src/characters/tiger-sounds.ts`, the pump's plunger comment "one every 30 s": the plunger is a cue on each
     stage, so it now sounds every 12 s. Its loudness was set for the old cadence; Eric may want it quieter. Not changed here.

## Not changed

Hoops, the bands, `balloonOdds`, `balloonStages` (4), the landing rules, the fake queen and the real queen's pop numbers, and
the rage speed (`rageSpeed.tiger` 1.6). The shared boss kit, the boss bar, the banners and the speech timing belong to other
lanes and are untouched.
