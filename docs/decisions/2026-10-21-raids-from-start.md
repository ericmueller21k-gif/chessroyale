# Boss raids start from the starting position (Oct 21, 2026)

## What Eric asked for

Eric (Oct 21): "I want to make boss raid. Everything starts from the starting position... the more I play it, the more
it's a must. Maybe we'll make one boss where he does opening positions, but for now, just make that change and push it
live as soon as you can."

## What changed

- **Every raid starts from the starting position** (Boss raid online, Solo raids and Boss alone: they all go through the
  runner's `startRaid`). Before, most bosses started from a named opening 5 moves in (`RAID_SETTINGS.openingMoves`), and
  only the bosses marked `opening.fromStart` (Hollow, Big Boy, Wrangler, Smudgy, the Hidden Boss) from the start.
- **Sides are as before:** the crowd is White in a raid (Black only with the test switch `?side=b`, when the boss moves
  first, as the from-the-start bosses already did). Hollow still claims Black.
- **Set-ups before move 1 are unchanged** (Big Boy's snack, Smudgy's and Chub & Chirp's test positions, the mate and win
  test switches): they run after the reset, as before.
- **The intro** already says "A fresh game from the starting position. You play White." for a board with no named
  opening, and skips the opening roulette: nothing new on screen.
- **Not changed:** the Crowd's boss final still takes over the game just played (its boss, the Hidden Boss, plays from
  the start anyway), and `opening.fromStart` still means that there. The runner still builds its usual first board, so the
  match's random draws (the boss, his powers' seed) come out as before.

## Player-visible text

- FAQ, Boss raid: "Most bosses start from a named opening, 5 moves in." → "Every boss starts from the starting position."

## Judgment calls (director)

- The bosses' strength offsets were tuned in sims from a named opening; from the starting position the crowd has no
  ready-made opening edge either way, so no retune now. Eric's playtesting and the results feedback (later) will tell.
- A boss whose gimmick is openings (Eric's idea) would add an opt-in on his `BossRules.opening`; not built now.
